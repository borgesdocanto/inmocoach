// Webhook que Google llama cuando hay cambios en el calendario de un usuario
// Headers que Google envía:
//   X-Goog-Channel-ID — el channelId que registramos
//   X-Goog-Resource-State — "sync" (primer ping), "exists" (cambio), "not_exists" (borrado)
//   X-Goog-Resource-ID — resourceId del calendario
//
// CRÍTICO: Vercel mata el proceso al enviar la respuesta.
// Por eso sincronizamos ANTES de responder, igual que sync-now.ts.
// Usamos maxDuration:30 — Google espera hasta 30s para el 200.
import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { syncAndPersist } from "../../../lib/calendarSync";
import { getValidAccessToken } from "../../../lib/googleToken";
import { getGoals } from "../../../lib/appConfig";
import { computeAndSaveStreak } from "../../../lib/streak";
import { saveWeeklyStatsAndRank } from "../../../lib/ranks";
import { startOfWeek, format } from "date-fns";

export const config = { maxDuration: 30 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Aceptar GET y POST — Google envía POST pero algunos proxies convierten a GET
  const channelId = req.headers["x-goog-channel-id"] as string;
  const resourceState = req.headers["x-goog-resource-state"] as string;

  // "sync" es el primer ping al registrar el watch — responder 200 y salir
  if (!channelId || resourceState === "sync") {
    return res.status(200).end();
  }

  // Solo procesar cambios reales
  if (resourceState !== "exists" && resourceState !== "not_exists") {
    return res.status(200).end();
  }

  try {
    // Buscar a qué usuario corresponde este channel
    const { data: channel } = await supabaseAdmin
      .from("calendar_watch_channels")
      .select("user_email, calendar_id")
      .eq("channel_id", channelId)
      .single();

    if (!channel?.user_email) {
      console.warn(`[calendarWebhook] channel ${channelId} not found`);
      return res.status(200).end();
    }

    const email = channel.user_email;

    // Verificar que el usuario tenga plan activo o trial vigente
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("status, plan, team_id, streak_best, created_at, trial_ends_at")
      .eq("email", email)
      .single();

    if (!sub) {
      return res.status(200).end();
    }

    // Verificar que no sea free expirado (importar isFreeExpired dinámicamente)
    const { isFreeExpired } = await import("../../../lib/brand");
    if (isFreeExpired(sub)) {
      console.log(`[calendarWebhook] skip ${email} — trial expired`);
      return res.status(200).end();
    }

    const accessToken = await getValidAccessToken(email);
    if (!accessToken) {
      console.warn(`[calendarWebhook] no token for ${email}`);
      return res.status(200).end();
    }

    // CRÍTICO: Sincronizar ANTES de responder — Vercel mata el proceso post-respuesta
    console.log(`[calendarWebhook] syncing ${email} (channel ${channelId.slice(-8)})`);
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

    const streakData = await computeAndSaveStreak(email, dailySummaries, sub.team_id).catch(() => null);
    await saveWeeklyStatsAndRank(
      email, weekStart, weekIac, weekGreen.length,
      (streakData as any)?.best ?? sub.streak_best ?? 0
    ).catch(() => null);

    // Marcar timestamp — el polling del dashboard lo detecta para refrescar la UI
    await supabaseAdmin
      .from("subscriptions")
      .update({ last_webhook_sync: new Date().toISOString() })
      .eq("email", email);

    console.log(`[calendarWebhook] ✅ ${email} — ${events.length} eventos sincronizados`);
    return res.status(200).end();
  } catch (err: any) {
    console.error("[calendarWebhook] error:", err?.message);
    // Siempre 200 para que Google no deshabilite el watch
    return res.status(200).end();
  }
}
