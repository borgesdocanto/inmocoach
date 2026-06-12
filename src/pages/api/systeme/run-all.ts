// POST /api/systeme/run-all
// Ejecuta sync de Systeme para todos los teams activos y configurados
// Llamado desde daily-sync para evitar el límite de 2 crons de Vercel Hobby
import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";

export const config = { maxDuration: 300 }; // 5 min — sync puede tardar 90s+

const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL = process.env.NEXTAUTH_URL ?? "https://www.inmocoach.com.ar";

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  // Auth: CRON_SECRET de Vercel O token externo guardado en app_config (GitHub Actions)
  const authHeader = req.headers.authorization ?? "";
  let authorized = authHeader === `Bearer ${CRON_SECRET}`;
  if (!authorized && authHeader.startsWith("Bearer ")) {
    const candidate = authHeader.slice(7);
    const { data: tokenRow } = await supabaseAdmin
      .from("app_config")
      .select("value")
      .eq("key", "systeme_cron_token")
      .is("team_id", null)
      .maybeSingle();
    authorized = !!tokenRow?.value && tokenRow.value === candidate;
  }
  if (!authorized) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { data: configs } = await supabaseAdmin
    .from("sync_configs")
    .select("team_id")
    .eq("is_active", true)
    .eq("is_configured", true);

  if (!configs || configs.length === 0) return res.json({ ok: true, ran: 0 });

  const results: { team_id: string; ok: boolean }[] = [];

  for (let i = 0; i < configs.length; i++) {
    const { team_id } = configs[i];
    try {
      const r = await fetch(`${BASE_URL}/api/systeme/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CRON_SECRET}`,
        },
        body: JSON.stringify({ teamId: team_id }),
        signal: AbortSignal.timeout(50000),
      });
      results.push({ team_id, ok: r.ok });
    } catch {
      results.push({ team_id, ok: false });
    }
    if (i < configs.length - 1) await sleep(3000);
  }

  return res.json({ ok: true, ran: results.length, results });
}
