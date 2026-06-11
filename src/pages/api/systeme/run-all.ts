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
  if (req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
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
