// /api/calendar/sync-now
// Llamado por el dashboard al cargar — sincroniza si los datos tienen más de STALE_MINUTES minutos
// Responde inmediatamente (no bloquea el render) y sincroniza en background
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { getOrCreateSubscription, isFreemiumExpired } from "../../../lib/subscription";
import { supabaseAdmin } from "../../../lib/supabase";
import { syncAndPersist } from "../../../lib/calendarSync";
import { getValidAccessToken } from "../../../lib/googleToken";
import { computeAndSaveStreak } from "../../../lib/streak";
import { saveWeeklyStatsAndRank } from "../../../lib/ranks";

const STALE_MINUTES = 10; // sync si los datos tienen más de 10 min

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).end();

  const sub = await getOrCreateSubscription(session.user.email);
  if (isFreemiumExpired(sub)) return res.status(403).end();

  // Check last sync time
  const { data: subData } = await supabaseAdmin
    .from("subscriptions")
    .select("last_webhook_sync, google_access_token, streak_best, team_id")
    .eq("email", session.user.email)
    .single();

  const lastSync = subData?.last_webhook_sync
    ? new Date(subData.last_webhook_sync)
    : null;
  const minutesSince = lastSync
    ? (Date.now() - lastSync.getTime()) / 60000
    : 999;

  // If synced recently, skip
  if (minutesSince < STALE_MINUTES) {
    return res.status(200).json({ synced: false, reason: "recent", minutesSince: Math.round(minutesSince) });
  }

  // Respond immediately — sync in background
  res.status(200).json({ synced: true, reason: "stale", minutesSince: Math.round(minutesSince) });

  // Background sync (after response sent)
  try {
    const accessToken = await getValidAccessToken(session.user.email);
    if (!accessToken) return;

    await syncAndPersist(accessToken, session.user.email, subData?.team_id ?? null, 90);

    // Update last_webhook_sync so polling detects the change
    await supabaseAdmin
      .from("subscriptions")
      .update({ last_webhook_sync: new Date().toISOString() })
      .eq("email", session.user.email);

    // Update streak & rank in background
    try {
      const { data: events } = await supabaseAdmin
        .from("calendar_events")
        .select("start_at, is_productive")
        .eq("user_email", session.user.email)
        .gte("start_at", new Date(Date.now() - 90 * 86400000).toISOString());

      if (events) {
        const byDay: Record<string, number> = {};
        events.filter(e => e.is_productive).forEach(e => {
          const day = e.start_at.slice(0, 10);
          byDay[day] = (byDay[day] || 0) + 1;
        });
        const summaries = Object.entries(byDay).map(([date, greenCount]) => ({ date, greenCount }));
        const streakData = await computeAndSaveStreak(session.user.email, summaries);
        const monday = new Date();
        monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
        monday.setHours(0, 0, 0, 0);
        const weekStart = monday.toISOString().slice(0, 10);
        const weekGreen = summaries.filter(d => d.date >= weekStart).reduce((s, d) => s + d.greenCount, 0);
        const iac = Math.min(100, Math.round((weekGreen / 15) * 100));
        await saveWeeklyStatsAndRank(session.user.email, weekStart, iac, weekGreen, streakData.best);
      }
    } catch { /* silencioso */ }
  } catch (err: any) {
    console.error("[sync-now] error:", err?.message);
  }
}
