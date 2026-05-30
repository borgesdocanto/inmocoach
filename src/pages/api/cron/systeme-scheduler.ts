// GET /api/cron/systeme-scheduler
// Cron maestro — corre cada día a las 22:00 UTC (19:00 ARG)
// Itera todos los teams con sync activa y configurada, los ejecuta
// secuencialmente con 30 segundos de pausa entre cada uno.
import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";

const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL = process.env.NEXTAUTH_URL ?? "https://www.inmocoach.com.ar";
const DELAY_MS = 5_000; // 5 segundos entre cada inmo (aumentar si hay muchas)

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Aceptar tanto Authorization header como x-cron-secret, igual que los otros crons
  const isVercel = req.headers.authorization === `Bearer ${CRON_SECRET}`;
  const isManual = req.headers["x-cron-secret"] === CRON_SECRET;
  if (!isVercel && !isManual) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Traer todos los teams con sync activa y configurada
  const { data: configs, error } = await supabaseAdmin
    .from("sync_configs")
    .select("team_id")
    .eq("is_active", true)
    .eq("is_configured", true);

  if (error) return res.status(500).json({ error: error.message });
  if (!configs || configs.length === 0) return res.json({ ok: true, ran: 0 });

  // Ejecutar secuencialmente y DESPUÉS responder (Vercel mata el proceso al responder)
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
        signal: AbortSignal.timeout(55_000), // 55s por inmo
      });
      results.push({ team_id, ok: r.ok });
    } catch {
      results.push({ team_id, ok: false });
    }

    if (i < configs.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  return res.json({ ok: true, ran: results.length, results });
}

// maxDuration no declarado — usa el default del plan
