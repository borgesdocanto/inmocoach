// POST /api/admin/systeme-backfill
// Sincroniza contactos de Tokko para una fecha específica (YYYY-MM-DD)
// El frontend llama esto día por día para evitar timeout
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { isSuperAdmin } from "../../../lib/adminGuard";
import { runSync } from "../../../lib/systemeSync";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!isSuperAdmin(session?.user?.email)) return res.status(403).end();

  const { date, teamId: bodyTeamId } = req.body as { date: string; teamId?: string };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Parámetro date requerido (YYYY-MM-DD)" });
  }

  const teamId = bodyTeamId || "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93";

  const { data: syncConfig } = await supabaseAdmin
    .from("sync_configs").select("*").eq("team_id", teamId).single();
  if (!syncConfig?.systeme_api_key) return res.status(400).json({ error: "Sin config Systeme" });

  const { data: team } = await supabaseAdmin
    .from("teams").select("tokko_api_key").eq("id", teamId).single();
  if (!team?.tokko_api_key) return res.status(400).json({ error: "Sin Tokko key" });

  const [{ data: whitelist }, { data: fixed }] = await Promise.all([
    supabaseAdmin.from("sync_tags_whitelist").select("tag_name").eq("team_id", teamId),
    supabaseAdmin.from("sync_tags_fixed").select("tag_name").eq("team_id", teamId),
  ]);

  // Traer contactos de Tokko para esa fecha específica
  interface TokkoContactRaw {
    id: number;
    email: string;
    name: string;
    cellphone?: string;
    tags?: { name: string }[];
    agent?: { name?: string; email?: string } | null;
    lead_status?: string;
    is_owner?: boolean;
  }

  const base = "https://tokkobroker.com";
  const key = team.tokko_api_key;
  const contacts: TokkoContactRaw[] = [];
  const seen = new Set<string>();

  async function paginate(startUrl: string) {
    let url: string | null = startUrl;
    while (url) {
      const fetchUrl: string = url;
      const r: Response = await fetch(fetchUrl, { signal: AbortSignal.timeout(25000) });
      if (!r.ok) throw new Error(`Tokko error ${r.status}`);
      const data = await r.json();
      for (const c of (data.objects ?? []) as TokkoContactRaw[]) {
        if (c.email && !seen.has(c.email)) {
          seen.add(c.email);
          contacts.push(c);
        }
      }
      const next: string | undefined = data.meta?.next;
      url = next ? `${base}${next}` : null;
    }
  }

  await paginate(`${base}/api/v1/contact/?key=${key}&deleted_at__gt=${date}&format=json&limit=100`);
  await paginate(`${base}/api/v1/contact/?key=${key}&created_at__gt=${date}&format=json&limit=100`);

  if (contacts.length === 0) {
    return res.json({ date, contacts: 0, created: 0, updated: 0, skipped: 0, errors: 0 });
  }

  const result = await runSync({
    tokkoKey: key,
    systemeKey: syncConfig.systeme_api_key,
    whitelistTags: (whitelist || []).map((r: { tag_name: string }) => r.tag_name),
    fixedTags: (fixed || []).map((r: { tag_name: string }) => r.tag_name),
    overrideContacts: contacts,
  });

  return res.json({ date, contacts: contacts.length, ...result });
}
