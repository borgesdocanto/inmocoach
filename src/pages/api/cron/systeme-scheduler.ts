// GET /api/cron/systeme-scheduler
// Cron maestro — corre cada día a las 22:00 UTC (19:00 ARG)
// Itera todos los teams con sync activa y configurada, los ejecuta
// secuencialmente con 30 segundos de pausa entre cada uno.
import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";

const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL = process.env.NEXTAUTH_URL ?? "https://www.inmocoach.com.ar";
const DELAY_MS = 30_000; // 30 segundos entre cada inmo

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
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

  // Responder inmediatamente para que Vercel no time-out la respuesta del cron
  // Nota: usamos waitUntil si está disponible, sino procesamos igual
  res.json({ ok: true, queued: configs.length });

  // Ejecutar secuencialmente (fire-and-forget desde la perspectiva del cron)
  // Como Vercel puede matar el proceso, hacemos el await explícito antes de responder
  // PERO ya respondimos — esto funciona en Vercel Pro con funciones de hasta 900s
  for (let i = 0; i < configs.length; i++) {
    const { team_id } = configs[i];
    try {
      await fetch(`${BASE_URL}/api/systeme/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CRON_SECRET}`,
        },
        body: JSON.stringify({ teamId: team_id }),
        signal: AbortSignal.timeout(120_000), // 2 min por inmo
      });
    } catch {
      // Si una falla, continuamos con la siguiente
    }

    // Pausa entre inmos (excepto después de la última)
    if (i < configs.length - 1) {
      await sleep(DELAY_MS);
    }
  }
}

export const config = { maxDuration: 900 };
