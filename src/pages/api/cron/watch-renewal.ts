// Corre diario — registra watches para usuarios nuevos y renueva los que vencen
import { NextApiRequest, NextApiResponse } from "next";
import { waitUntil } from "@vercel/functions";
import { supabaseAdmin } from "../../../lib/supabase";
import { registerCalendarWatch, renewExpiringWatches } from "../../../lib/calendarWatch";

export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Auth: CRON_SECRET (Vercel) O token externo (GitHub Actions via app_config)
  const authHeader = req.headers.authorization ?? "";
  const cronSecret = process.env.CRON_SECRET;
  let authorized = authHeader === `Bearer ${cronSecret}` || req.headers["x-cron-secret"] === cronSecret || req.query.secret === cronSecret;
  if (!authorized) {
    // Token de app_config: aceptado por header Bearer o por ?secret= (para poder probar desde el navegador)
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
  if (!authorized) return res.status(401).json({ error: "No autorizado" });

  // Responder ya y trabajar en background: cron-job.org corta a los 30s.
  waitUntil(runWatchRenewal());
  return res.status(202).json({ ok: true, message: "Watch renewal iniciado" });
}

async function runWatchRenewal() {
  const results = { renewed: 0, registered: 0, skipped: 0, failed: 0 };

  // 1. Renovar channels que vencen en 24hs
  try {
    const renewResult = await renewExpiringWatches();
    results.renewed = renewResult.renewed;
    results.failed += renewResult.failed;
  } catch (e: any) {
    console.error("[watch-renewal] renovacion:", e?.message);
  }

  // 2. Registrar watches para usuarios activos o en trial que no tienen watch activo
  const { data: activeUsers } = await supabaseAdmin
    .from("subscriptions")
    .select("email, google_refresh_token, plan, status, created_at, trial_ends_at")
    .in("status", ["active", "trial"])
    .not("google_refresh_token", "is", null);

  const { isFreeExpired } = await import("../../../lib/brand");
  const validUsers = (activeUsers || []).filter(u => !isFreeExpired(u));

  if (validUsers?.length) {
    const { data: existingChannels } = await supabaseAdmin
      .from("calendar_watch_channels")
      .select("user_email")
      .gt("expiration", new Date().toISOString());

    const usersWithWatch = new Set((existingChannels || []).map(c => c.user_email));

    for (const user of validUsers) {
      if (usersWithWatch.has(user.email)) {
        results.skipped++;
        continue;
      }
      try {
        const ok = await registerCalendarWatch(user.email);
        if (ok) results.registered++;
        else results.failed++;
      } catch {
        results.failed++;
      }
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log("[watch-renewal] results:", results);
}
