// Endpoint para triggerear el sync de Tokko de un equipo específico desde el admin o desde tokko-setup
// Puede ser llamado por superadmin (cualquier equipo) o por el owner (solo su propio equipo)
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { isSuperAdmin } from "../../../lib/adminGuard";
import { supabaseAdmin } from "../../../lib/supabase";

export const config = { maxDuration: 120 };

async function syncTeamTokko(teamId: string, apiKey: string) {
  const fetchAll = async (url: string): Promise<any[]> => {
    let items: any[] = [];
    let next: string | null = url;
    while (next) {
      const fr = await fetch(next);
      if (!fr.ok) throw new Error(`Tokko error ${fr.status}`);
      const pd: any = await fr.json();
      items = items.concat(pd.objects || []);
      next = pd.meta?.next ? `https://www.tokkobroker.com${pd.meta.next}` : null;
    }
    return items;
  };

  const [properties, users] = await Promise.all([
    fetchAll(`https://www.tokkobroker.com/api/v1/property/?key=${apiKey}&format=json&limit=500&lang=es_ar`),
    fetchAll(`https://www.tokkobroker.com/api/v1/user/?key=${apiKey}&format=json&limit=200`),
  ]);

  // Sync propiedades
  if (properties.length) {
    const BATCH = 50;
    const now = new Date();
    for (let i = 0; i < properties.length; i += BATCH) {
      const rows = properties.slice(i, i + BATCH).map((prop: any) => {
        const op = prop.operations?.[0];
        const price = op?.prices?.[0];
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
    }
  }

  // Sync agentes
  if (users.length) {
    const rows = users.map((u: any) => ({
      tokko_id: u.id,
      team_id: teamId,
      name: u.name || null,
      email: u.email?.toLowerCase() || null,
      picture: u.picture || null,
      branch_id: u.branch?.id || u.office?.id || null,
      branch_name: u.branch?.name || u.office?.name || null,
      synced_at: new Date().toISOString(),
    }));
    await supabaseAdmin.from("tokko_agents").upsert(rows, { onConflict: "tokko_id" });
  }

  return { properties: properties.length, agents: users.length };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).end();

  const { teamId: rawTeamId } = req.body;
  if (!rawTeamId) return res.status(400).json({ error: "teamId requerido" });

  const email = session.user.email;
  const isAdmin = isSuperAdmin(email);

  // Obtener subscription del usuario
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, team_role")
    .eq("email", email)
    .single();

  // __own__ = el owner quiere sincronizar su propio equipo
  const teamId = rawTeamId === "__own__" ? sub?.team_id : rawTeamId;
  if (!teamId) return res.status(400).json({ error: "No tenés un equipo configurado" });

  // Verificar acceso: superadmin puede cualquier equipo, owner solo el suyo
  if (!isAdmin) {
    if (sub?.team_id !== teamId || sub?.team_role !== "owner") {
      return res.status(403).json({ error: "Sin acceso" });
    }
  }

  const { data: team } = await supabaseAdmin
    .from("teams")
    .select("tokko_api_key, name, agency_name")
    .eq("id", teamId)
    .single();

  if (!team?.tokko_api_key) {
    return res.status(400).json({ error: "Este equipo no tiene API key de Tokko configurada" });
  }

  try {
    const result = await syncTeamTokko(teamId, team.tokko_api_key);
    return res.status(200).json({
      ok: true,
      team: team.agency_name || team.name,
      ...result,
    });
  } catch (e: any) {
    console.error("[tokko-sync-team]", e?.message);
    return res.status(500).json({ ok: false, error: e?.message || "Error al sincronizar" });
  }
}
