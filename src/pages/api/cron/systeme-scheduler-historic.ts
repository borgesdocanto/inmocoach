// GET /api/cron/systeme-scheduler-historic
// Cron para CRON 2 (sync histórico) — corre TODOS LOS DÍAS a las 23:00 UTC (20:00 ARG)
// Cada corrida retrocede 7 días. En 52 corridas (52 días) cubre 1 año completo hacia atrás.
// Itera todos los teams con sync activa, ejecuta CRON 2 (hacia atrás en el tiempo)
// secuencialmente con 5 segundos de pausa entre cada uno.
import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";

const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL = process.env.NEXTAUTH_URL ?? "https://www.inmocoach.com.ar";
const DELAY_MS = 5_000; // 5 segundos entre cada team

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Aceptar tanto Authorization header como x-cron-secret, igual que los otros crons
  const authHeader = req.headers.authorization ?? "";
  let authorized =
    authHeader === `Bearer ${CRON_SECRET}` ||
    req.headers["x-cron-secret"] === CRON_SECRET ||
    req.query.secret === CRON_SECRET;

  if (!authorized) {
    // Token de app_config: por header Bearer o por ?secret=
    const candidate = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : (typeof req.query.secret === "string" ? req.query.secret : "");
    if (candidate) {
      const { data: tokenRow } = await supabaseAdmin
        .from("app_config").select("value").eq("key", "systeme_cron_token")
        .is("team_id", null).maybeSingle();
      authorized = !!tokenRow?.value && tokenRow.value === candidate;
    }
  }

  if (!authorized) {
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
  const results: { team_id: string; ok: boolean; created?: number; updated?: number }[] = [];

  for (let i = 0; i < configs.length; i++) {
    const { team_id } = configs[i];
    try {
      const r = await fetch(`${BASE_URL}/api/systeme/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CRON_SECRET}`,
        },
        body: JSON.stringify({ teamId: team_id, cronMode: "historic" }),
        signal: AbortSignal.timeout(55_000), // 55s por team
      });
      const d = await r.json();
      results.push({ 
        team_id, 
        ok: r.ok,
        created: d.created,
        updated: d.updated
      });
      console.log(`[systeme-scheduler-historic] team ${team_id.slice(0, 8)} — OK (${d.created} creados, ${d.updated} actualizados)`);
    } catch (err) {
      console.error(`[systeme-scheduler-historic] team ${team_id.slice(0, 8)} — ERROR: ${err instanceof Error ? err.message : "unknown"}`);
      results.push({ team_id, ok: false });
    }

    if (i < configs.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  return res.json({ ok: true, ran: results.length, results });
}

// maxDuration no declarado — usa el default del plan
// Duración esperada del sync histórico: ~52 días (1 año de contactos retrocediendo 7 días/día)
// Visibilidad en dashboard: última corrida de CRON 2 y próxima ventana
