// Sincroniza propiedades y agentes de Tokko por equipo
// Cada equipo tiene su propia API key en teams.tokko_api_key
import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";

export const config = { maxDuration: 300 };

async function syncTeam(teamId: string, apiKey: string): Promise<{ properties: number; users: number; errors: string[] }> {
  const results = { properties: 0, users: 0, errors: [] as string[] };

  // Propiedades
  try {
    const fetchAll = async (url: string): Promise<any[]> => {
      let items: any[] = [];
      let next: string | null = url;
      while (next) {
        const fr: Response = await fetch(next);
        if (!fr.ok) throw new Error(`Tokko properties ${fr.status}`);
        const pd: any = await fr.json();
        items = items.concat(pd.objects || []);
        next = pd.meta?.next ? `https://www.tokkobroker.com${pd.meta.next}` : null;
      }
      return items;
    };

    const baseUrl = `https://www.tokkobroker.com/api/v1/property/?key=${apiKey}&format=json&limit=500&lang=es_ar`;
    // Tokko API solo devuelve disponibles — reservadas no disponibles via API pública
    const allProperties = await fetchAll(baseUrl);

    const BATCH = 50;
    for (let i = 0; i < allProperties.length; i += BATCH) {
      const rows = allProperties.slice(i, i + BATCH).map((prop: any) => {
        const op = prop.operations?.[0];
        const price = op?.prices?.[0];
        const now = new Date();
        return {
          tokko_id: prop.id,
          team_id: teamId,
          reference_code: prop.reference_code || null,
          title: prop.publication_title || null,
          address: prop.address || null,
          property_type: prop.type?.name || null,
          operation_type: op?.operation_type || null,
          status: prop.status ?? null,
          price: price?.price || null,
          currency: price?.currency || null,
          photos_count: (prop.photos || []).filter((p: any) => !p.is_blueprint).length,
          thumbnail: (prop.photos || []).find((p: any) => !p.is_blueprint)?.thumb || null,
          days_since_update: (prop.deleted_at || prop.last_update)
            ? Math.floor((now.getTime() - new Date(prop.deleted_at || prop.last_update).getTime()) / 86400000)
            : null,
          days_online: (prop.deleted_at || prop.created_at || prop.created_date)
            ? Math.floor((now.getTime() - new Date(prop.deleted_at || prop.created_at || prop.created_date).getTime()) / 86400000)
            : null,
          producer_id: prop.producer?.id || null,
          producer_name: prop.producer?.name || null,
          producer_email: prop.producer?.email?.toLowerCase() || null,
          branch_id: prop.branch?.id || null,
          branch_name: prop.branch?.name || null,
          synced_at: now.toISOString(),
        };
      });
      await supabaseAdmin.from("tokko_properties").upsert(rows, { onConflict: "tokko_id" });
      results.properties += rows.length;
    }

    // Borrar propiedades que ya no existen en Tokko
    const activeIds = allProperties.map((p: any) => p.id);
    if (activeIds.length > 0) {
      await supabaseAdmin.from("tokko_properties").delete()
        .eq("team_id", teamId)
        .not("tokko_id", "in", `(${activeIds.join(",")})`);
    }
  } catch (e: any) {
    results.errors.push(`properties: ${e.message}`);
  }

  // Agentes
  try {
    const fr: Response = await fetch(`https://www.tokkobroker.com/api/v1/user/?key=${apiKey}&format=json&limit=200`);
    if (!fr.ok) throw new Error(`Tokko users ${fr.status}`);
    const ud: any = await fr.json();
    const users: any[] = ud.objects || [];
    if (users.length > 0) {
      const rows = users.map((u: any) => ({
        tokko_id: u.id,
        team_id: teamId,
        name: u.name,
        email: u.email?.toLowerCase() || null,
        phone: u.phone || u.cellphone || null,
        picture: u.picture || null,
        position: u.position || null,
        branch_id: u.branch?.id || u.office?.id || null,
        branch_name: u.branch?.name || u.office?.name || null,
        synced_at: new Date().toISOString(),
      }));
      await supabaseAdmin.from("tokko_agents").upsert(rows, { onConflict: "tokko_id" });
      results.users = users.length;

      // Patch branch_id from tokko_properties for agents whose branch is null
      // tokko_properties has producer_email + branch_id from the property listing
      const nullBranchEmails = rows
        .filter(r => !r.branch_id && r.email)
        .map(r => r.email);

      if (nullBranchEmails.length > 0) {
        const { data: propsWithBranch } = await supabaseAdmin
          .from("tokko_properties")
          .select("producer_email, branch_id")
          .eq("team_id", teamId)
          .in("producer_email", nullBranchEmails)
          .not("branch_id", "is", null);

        if (propsWithBranch?.length) {
          // Build map email -> branch_id (first occurrence)
          const branchMap: Record<string, number> = {};
          for (const p of propsWithBranch) {
            if (p.producer_email && !branchMap[p.producer_email]) {
              branchMap[p.producer_email] = p.branch_id;
            }
          }
          // Update tokko_agents for each agent
          for (const [email, branchId] of Object.entries(branchMap)) {
            await supabaseAdmin
              .from("tokko_agents")
              .update({ branch_id: branchId })
              .eq("team_id", teamId)
              .eq("email", email);
          }
        }
      }
    }
  } catch (e: any) {
    results.errors.push(`users: ${e.message}`);
  }

  return results;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isVercel = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  const isManual = req.headers["x-cron-secret"] === process.env.CRON_SECRET;
  if (!isVercel && !isManual) return res.status(401).json({ error: "No autorizado" });

  const { targetTeamId } = req.body || {};

  let query = supabaseAdmin.from("teams").select("id, name, tokko_api_key").not("tokko_api_key", "is", null);
  if (targetTeamId) query = query.eq("id", targetTeamId);
  const { data: teams } = await query;

  if (!teams?.length) return res.status(200).json({ ok: true, message: "No hay equipos con API key de Tokko" });

  const allResults: Record<string, any> = {};
  for (const team of teams) {
    console.log(`[tokko-sync] equipo: ${team.name}`);
    allResults[team.name] = await syncTeam(team.id, team.tokko_api_key);
    await new Promise(r => setTimeout(r, 500));
  }

  return res.status(200).json({
    ok: true,
    teams: teams.length,
    properties: Object.values(allResults).reduce((s: number, r: any) => s + (r.properties || 0), 0),
    users: Object.values(allResults).reduce((s: number, r: any) => s + (r.users || 0), 0),
    details: allResults,
  });
}
