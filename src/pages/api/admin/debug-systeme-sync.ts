// GET /api/admin/debug-systeme-sync — ver qué contactos traería Tokko hoy
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { isSuperAdmin } from "../../../lib/adminGuard";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!isSuperAdmin(session?.user?.email)) return res.status(403).end();

  const { data: team } = await supabaseAdmin
    .from("teams")
    .select("tokko_api_key")
    .eq("id", "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93")
    .single();

  if (!team?.tokko_api_key) return res.status(400).json({ error: "Sin API key" });

  const now = new Date();
  // Fecha en UTC y también en Argentina (UTC-3)
  const todayUTC = now.toISOString().split("T")[0];
  const argNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const todayARG = argNow.toISOString().split("T")[0];

  const results: Record<string, unknown> = { todayUTC, todayARG };

  for (const [label, date] of [["UTC", todayUTC], ["ARG", todayARG]]) {
    for (const [field, fieldName] of [["deleted_at__gt", "modificados"], ["created_at__gt", "creados"]]) {
      const url = `https://tokkobroker.com/api/v1/contact/?key=${team.tokko_api_key}&${field}=${date}&format=json&limit=5`;
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
        const d = await r.json();
        results[`${label}_${fieldName}`] = {
          url,
          total: d.meta?.total_count ?? "?",
          first3: (d.objects ?? []).slice(0, 3).map((c: { email?: string; name?: string }) => ({ email: c.email, name: c.name })),
        };
      } catch (e: unknown) {
        results[`${label}_${fieldName}`] = { error: e instanceof Error ? e.message : "Error" };
      }
    }
  }

  return res.json(results);
}
