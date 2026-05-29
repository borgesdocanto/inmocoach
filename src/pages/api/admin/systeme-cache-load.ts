// POST /api/admin/systeme-cache-load
// Carga todos los contactos de Systeme en la tabla systeme_contact_cache
// Se llama UNA vez antes del backfill
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { isSuperAdmin } from "../../../lib/adminGuard";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!isSuperAdmin(session?.user?.email)) return res.status(403).end();

  const teamId = (req.body?.teamId as string) || "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93";

  const { data: syncConfig } = await supabaseAdmin
    .from("sync_configs").select("systeme_api_key").eq("team_id", teamId).single();
  if (!syncConfig?.systeme_api_key) return res.status(400).json({ error: "Sin config" });

  const key = syncConfig.systeme_api_key;
  const batch: { team_id: string; email: string; systeme_id: number }[] = [];
  let startingAfter: number | null = null;
  let hasMore = true;
  let total = 0;

  while (hasMore) {
    const url = startingAfter
      ? `https://api.systeme.io/api/contacts?limit=100&startingAfter=${startingAfter}`
      : "https://api.systeme.io/api/contacts?limit=100";

    const r = await fetch(url, {
      headers: { "X-API-Key": key, accept: "application/json" },
      signal: AbortSignal.timeout(25000),
    });
    if (!r.ok) return res.status(502).json({ error: `Systeme ${r.status}` });

    const d = await r.json();
    const items: { id: number; email: string }[] = d.items ?? [];
    total += items.length;

    for (const item of items) {
      if (item.email) batch.push({ team_id: teamId, email: item.email.toLowerCase(), systeme_id: item.id });
    }

    // Guardar en lotes de 500
    if (batch.length >= 500) {
      await supabaseAdmin.from("systeme_contact_cache")
        .upsert(batch, { onConflict: "team_id,email" });
      batch.length = 0;
    }

    hasMore = d.hasMore === true && items.length > 0;
    if (hasMore) startingAfter = items[items.length - 1].id;
  }

  // Guardar el resto
  if (batch.length > 0) {
    await supabaseAdmin.from("systeme_contact_cache")
      .upsert(batch, { onConflict: "team_id,email" });
  }

  return res.json({ ok: true, total });
}
