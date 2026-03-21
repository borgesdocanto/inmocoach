/**
 * Webhook receptor de Google Calendar Push Notifications.
 *
 * Google hace POST aquí cada vez que hay un cambio en el calendario
 * de un usuario registrado. Identificamos al usuario por el channel ID,
 * y disparamos un sync inmediato de su calendario.
 *
 * Docs: https://developers.google.com/calendar/api/guides/push
 */
import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { syncAndPersist } from "../../../lib/calendarSync";
import { getValidAccessToken } from "../../../lib/googleToken";
import { computeAndSaveStreak } from "../../../lib/streak";
import { saveWeeklyStatsAndRank } from "../../../lib/ranks";
import { getGoals } from "../../../lib/appConfig";
import { startOfWeek, format } from "date-fns";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Google solo hace POST — responder 200 rápido para que no reintente
  if (req.method !== "POST") return res.status(200).end();

  // Headers que envía Google en cada notificación
  const channelId = req.headers["x-goog-channel-id"] as string;
  const resourceState = req.headers["x-goog-resource-state"] as string;

  // "sync" es la notificación de confirmación al registrar el watch — ignorar
  if (!channelId || resourceState === "sync") {
    return res.status(200).end();
  }

  // Responder 200 inmediatamente (Google espera respuesta rápida)
  res.status(200).end();

  // Buscar usuario por channel ID
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("email, team_id, streak_best")
    .eq("watch_channel_id", channelId)
    .single();

  if (!sub?.email) {
    console.warn(`[gcal-webhook] Unknown channel: ${channelId}`);
    return;
  }

  // Sync en background (la respuesta ya fue enviada)
  try {
    const accessToken = await getValidAccessToken(sub.email);
    if (!accessToken) return;

    const events = await syncAndPersist(accessToken, sub.email, sub.team_id, 90);

    // Actualizar racha y weekly stats
    const byDay: Record<string, number> = {};
    for (const e of events) {
      if (e.isGreen) byDay[e.start.slice(0, 10)] = (byDay[e.start.slice(0, 10)] || 0) + 1;
    }
    const dailySummaries = Object.entries(byDay).map(([date, greenCount]) => ({ date, greenCount }));
    const streakData = await computeAndSaveStreak(sub.email, dailySummaries);

    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const weekGreen = events.filter(e => e.isGreen && e.start.slice(0, 10) >= weekStart);
    const { weeklyGoal } = await getGoals();
    const weekIac = Math.min(100, Math.round((weekGreen.length / weeklyGoal) * 100));
    await saveWeeklyStatsAndRank(sub.email, weekStart, weekIac, weekGreen.length, (streakData as any)?.best ?? sub.streak_best ?? 0);

    console.log(`[gcal-webhook] Synced ${sub.email}: ${events.length} eventos`);
  } catch (err: any) {
    console.error(`[gcal-webhook] Sync error for ${sub.email}:`, err?.message);
  }
}
