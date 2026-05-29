// GET /api/admin/systeme-backfill?teamId=xxx&days=10
// Ejecuta UNA SOLA VEZ una sincronización de los últimos N días
// Solo super admin
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { isSuperAdmin } from "../../../lib/adminGuard";
import { runSync } from "../../../lib/systemeSync";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!isSuperAdmin(session?.user?.email)) return res.status(403).end();

  const teamId = (req.query.teamId as string) || "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93";
  const days = parseInt((req.query.days as string) || "10");

  const { data: syncConfig } = await supabaseAdmin
    .from("sync_configs").select("*").eq("team_id", teamId).single();
  if (!syncConfig?.systeme_api_key) return res.status(400).json({ error: "Sin config" });

  const { data: team } = await supabaseAdmin
    .from("teams").select("tokko_api_key").eq("id", teamId).single();
  if (!team?.tokko_api_key) return res.status(400).json({ error: "Sin Tokko key" });

  const [{ data: whitelist }, { data: fixed }] = await Promise.all([
    supabaseAdmin.from("sync_tags_whitelist").select("tag_name").eq("team_id", teamId),
    supabaseAdmin.from("sync_tags_fixed").select("tag_name").eq("team_id", teamId),
  ]);

  // Parchear fetchTokkoContactsToday para usar N días en lugar de hoy
  // Calculamos la fecha de inicio
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split("T")[0];

  // Traer contactos directamente con el rango extendido
  const base = "https://tokkobroker.com";
  const key = team.tokko_api_key;
  const contacts: { email: string; name: string; cellphone?: string; tags?: { name: string }[]; agent?: { name?: string; email?: string } | null; lead_status?: string; is_owner?: boolean }[] = [];
  const seen = new Set<string>();

  async function paginate(startUrl: string) {
    let url: string | null = startUrl;
    while (url) {
      const fetchUrl: string = url;
      const r: Response = await fetch(fetchUrl, { signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(`Tokko error ${r.status}`);
      const data = await r.json();
      for (const c of (data.objects ?? [])) {
        if (c.email && !seen.has(c.email)) {
          seen.add(c.email);
          contacts.push(c);
        }
      }
      const next: string | undefined = data.meta?.next;
      url = next ? `${base}${next}` : null;
    }
  }

  await paginate(`${base}/api/v1/contact/?key=${key}&deleted_at__gt=${sinceStr}&format=json`);
  await paginate(`${base}/api/v1/contact/?key=${key}&created_at__gt=${sinceStr}&format=json`);

  // Usar runSync pero con los contactos ya cargados — lo hacemos inline
  const result = await runSync({
    tokkoKey: key,
    systemeKey: syncConfig.systeme_api_key,
    whitelistTags: (whitelist || []).map((r: { tag_name: string }) => r.tag_name),
    fixedTags: (fixed || []).map((r: { tag_name: string }) => r.tag_name),
    overrideContacts: contacts,
  });

  return res.json({ sinceStr, totalContacts: contacts.length, ...result });
}
