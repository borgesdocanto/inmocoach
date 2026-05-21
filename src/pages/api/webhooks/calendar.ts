// Webhook que Google llama cuando hay cambios en el calendario de un usuario
// Headers que Google envía:
//   X-Goog-Channel-ID — el channelId que registramos
//   X-Goog-Resource-State — "sync" (primer ping), "exists" (cambio), "not_exists" (borrado)
//   X-Goog-Resource-ID — resourceId del calendario
import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { syncAndPersist } from "../../../lib/calendarSync";
import { getValidAccessToken } from "../../../lib/googleToken";
import { getGoals } from "../../../lib/appConfig";
import { computeAndSaveStreak } from "../../../lib/streak";
import { saveWeeklyStatsAndRank } from "../../../lib/ranks";
import { startOfWeek, format } from "date-fns";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Google espera 200 rápido — responder ANTES de procesar para evitar timeouts
  res.status(200).end();

  const channelId = req.headers["x-goog-channel-id"] as string;
  const resourceState = req.headers["x-goog-resource-state"] as string;

  // "sync" es el primer ping al registrar — no necesita procesamiento
  if (!channelId || resourceState === "sync") return;

  // Solo procesar cambios reales
  if (resourceState !== "exists" && resourceState !== "not_exists") return;

  try {
    // Buscar a qué usuario corresponde este channel
    const { data: channel } = await supabaseAdmin
      .from("calendar_watch_channels")
      .select("user_email, calendar_id")
      .eq("channel_id", channelId)
      .single();

    if (!channel?.user_email) {
      console.warn(`[calendarWebhook] channel ${channelId} not found in DB`);
      return;
    }

    const email = channel.user_email;

    // Verificar que el usuario tenga plan activo
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("status, plan, team_id, streak_best")
      .eq("email", email)
      .single();

    if (!sub || sub.status !== "active") return;

    const accessToken = await getValidAccessToken(email);
    if (!accessToken) {
      console.warn(`[calendarWebhook] no token for ${email}`);
      return;
    }

    // Sincronizar los últimos 90 días
    console.log(`[calendarWebhook] syncing ${email} triggered by channel ${channelId}`);
    const events = await syncAndPersist(accessToken, email, sub.team_id, 90);

    // Actualizar streak y rank
    const byDay: Record<string, number> = {};
    for (const e of events) {
      if (e.isGreen) byDay[e.start.slice(0, 10)] = (byDay[e.start.slice(0, 10)] || 0) + 1;
    }
    const dailySummaries = Object.entries(byDay).map(([date, greenCount]) => ({ date, greenCount }));

    const { weeklyGoal } = await getGoals(sub.team_id);
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const weekGreen = events.filter(e => e.isGreen && e.start.slice(0, 10) >= weekStart);
    const weekIac = Math.min(100, Math.round((weekGreen.length / weeklyGoal) * 100));

    const streakData = await computeAndSaveStreak(email, dailySummaries).catch(() => null);
    await saveWeeklyStatsAndRank(
      email, weekStart, weekIac, weekGreen.length,
      (streakData as any)?.best ?? sub.streak_best ?? 0
    ).catch(() => null);

    // Actualizar timestamp de última sync — el polling del dashboard lo detecta
    await supabaseAdmin
      .from("subscriptions")
      .update({ last_webhook_sync: new Date().toISOString() })
      .eq("email", email);

    console.log(`[calendarWebhook] ✅ ${email} synced — ${events.length} events`);
  } catch (err: any) {
    console.error("[calendarWebhook] error:", err?.message);
  }
}
