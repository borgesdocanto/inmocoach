// Corre diario — registra watches para usuarios nuevos y renueva los que vencen
import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { registerCalendarWatch, renewExpiringWatches } from "../../../lib/calendarWatch";

export const config = { maxDuration: 300 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isVercel = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  const isManual = req.headers["x-cron-secret"] === process.env.CRON_SECRET;
  if (!isVercel && !isManual) return res.status(401).json({ error: "No autorizado" });

  const results = { renewed: 0, registered: 0, skipped: 0, failed: 0 };

  // 1. Renovar channels que vencen en 24hs
  const renewResult = await renewExpiringWatches();
  results.renewed = renewResult.renewed;
  results.failed += renewResult.failed;

  // 2. Registrar watches para usuarios activos o en trial que no tienen watch activo
  const { data: activeUsers } = await supabaseAdmin
    .from("subscriptions")
    .select("email, google_refresh_token, plan, status, created_at, trial_ends_at")
    .in("status", ["active", "trial"])
    .not("google_refresh_token", "is", null);

  // Filtrar free expirados en memoria
  const { isFreeExpired } = await import("../../../lib/brand");
  const validUsers = (activeUsers || []).filter(u => !isFreeExpired(u));

  if (validUsers?.length) {
    // Usuarios que ya tienen watch vigente
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
      const ok = await registerCalendarWatch(user.email);
      if (ok) results.registered++;
      else results.failed++;
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log("[watch-renewal] results:", results);
  return res.status(200).json({ ok: true, ...results });
}
