// Sincroniza propiedades y usuarios de Tokko Broker hacia Supabase
// Corre diariamente — también puede llamarse manualmente desde admin
import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";

export const config = { maxDuration: 300 };

interface TokkoProperty {
  id: number;
  reference_code?: string;
  publication_title?: string;
  address?: string;
  type?: { name: string };
  operations?: Array<{ operation_type: string; prices: Array<{ price: number; currency: string }> }>;
  status?: number;
  producer?: { id: number; name: string; email?: string };
  branch?: { id: number; name: string };
  photos?: Array<{ image: string; is_blueprint?: boolean }>;
  last_update?: string;
  created_date?: string;
}

interface TokkoUser {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  cellphone?: string;
  picture?: string;
  position?: string;
  branch?: { id: number; name: string };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isVercel = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  const isManual = req.headers["x-cron-secret"] === process.env.CRON_SECRET;
  if (!isVercel && !isManual) return res.status(401).json({ error: "No autorizado" });

  // Leer API key de DB
  const { data: configRow } = await supabaseAdmin
    .from("app_config")
    .select("value")
    .eq("key", "tokko_api_key")
    .single();

  const apiKey = configRow?.value;
  if (!apiKey) return res.status(200).json({ ok: true, message: "No hay API key de Tokko configurada" });

  const results = { properties: 0, users: 0, errors: [] as string[] };

  // ── Sincronizar propiedades ───────────────────────────────────────────────
  try {
    let allProperties: TokkoProperty[] = [];
    let nextUrl: string | null = `https://www.tokkobroker.com/api/v1/property/?key=${apiKey}&format=json&limit=500&lang=es_ar`;

    while (nextUrl) {
      const fetchRes: Response = await fetch(nextUrl);
      if (!fetchRes.ok) throw new Error(`Tokko properties error: ${fetchRes.status}`);
      const pageData: any = await fetchRes.json();
      allProperties = allProperties.concat(pageData.objects || []);
      nextUrl = pageData.meta?.next ? `https://www.tokkobroker.com${pageData.meta.next}` : null;
    }

    // Upsert en lotes de 50
    const BATCH = 50;
    for (let i = 0; i < allProperties.length; i += BATCH) {
      const batch = allProperties.slice(i, i + BATCH);
      const rows = batch.map(prop => {
        const op = prop.operations?.[0];
        const price = op?.prices?.[0];
        const photosCount = (prop.photos || []).filter(p => !p.is_blueprint).length;
        const now = new Date();
        const daysSinceUpdate = prop.last_update
          ? Math.floor((now.getTime() - new Date(prop.last_update).getTime()) / (1000 * 60 * 60 * 24))
          : null;

        return {
          tokko_id: prop.id,
          reference_code: prop.reference_code || null,
          title: prop.publication_title || null,
          address: prop.address || null,
          property_type: prop.type?.name || null,
          operation_type: op?.operation_type || null,
          status: prop.status ?? null,
          price: price?.price || null,
          currency: price?.currency || null,
          photos_count: photosCount,
          days_since_update: daysSinceUpdate,
          producer_id: prop.producer?.id || null,
          producer_name: prop.producer?.name || null,
          producer_email: prop.producer?.email || null,
          branch_id: prop.branch?.id || null,
          branch_name: prop.branch?.name || null,
          synced_at: new Date().toISOString(),
        };
      });

      await supabaseAdmin
        .from("tokko_properties")
        .upsert(rows, { onConflict: "tokko_id" });

      results.properties += batch.length;
    }
  } catch (e: any) {
    results.errors.push(`properties: ${e.message}`);
    console.error("[tokko-sync] properties error:", e.message);
  }

  // ── Sincronizar usuarios/agentes ─────────────────────────────────────────
  try {
    const r: Response = await fetch(`https://www.tokkobroker.com/api/v1/user/?key=${apiKey}&format=json&limit=200`);
    if (!r.ok) throw new Error(`Tokko users error: ${r.status}`);
    const data = await r.json();
    const users: TokkoUser[] = data.objects || [];

    if (users.length > 0) {
      const rows = users.map(u => ({
        tokko_id: u.id,
        name: u.name,
        email: u.email || null,
        phone: u.phone || u.cellphone || null,
        picture: u.picture || null,
        position: u.position || null,
        branch_id: (u as any).branch?.id || null,
        branch_name: (u as any).branch?.name || null,
        synced_at: new Date().toISOString(),
      }));

      await supabaseAdmin
        .from("tokko_agents")
        .upsert(rows, { onConflict: "tokko_id" });

      results.users = users.length;
    }
  } catch (e: any) {
    results.errors.push(`users: ${e.message}`);
    console.error("[tokko-sync] users error:", e.message);
  }

  console.log("[tokko-sync] completado:", results);
  return res.status(200).json({ ok: true, ...results });
}
