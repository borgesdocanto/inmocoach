// /api/calendar/sync-now
// Sincroniza Google Calendar y persiste en DB si los datos tienen más de STALE_MINUTES.
// En Vercel serverless el background work se mata — hay que sincronizar ANTES de responder.
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { getEffectiveEmail } from "../../../lib/impersonation";
import { getOrCreateSubscription, isFreemiumExpired } from "../../../lib/subscription";
import { supabaseAdmin } from "../../../lib/supabase";
import { syncAndPersist } from "../../../lib/calendarSync";
import { getValidAccessToken } from "../../../lib/googleToken";
import { computeAndSaveStreak } from "../../../lib/streak";
import { saveWeeklyStatsAndRank } from "../../../lib/ranks";
import { getGoals } from "../../../lib/appConfig";

export const config = { maxDuration: 30 };

const STALE_MINUTES = 10;
const STALE_MINUTES_FORCED = 1; // cuando viene con ?force=true (usuario volvió de ausencia)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).end();

  const email = getEffectiveEmail(req, session) ?? session.user.email;

  const sub = await getOrCreateSubscription(email);
  if (isFreemiumExpired(sub)) return res.status(403).end();

  // Revisar cuándo fue la última sync
  const { data: subData } = await supabaseAdmin
    .from("subscriptions")
    .select("last_webhook_sync, team_id, streak_best")
    .eq("email", email)
    .single();

  const lastSync = subData?.last_webhook_sync ? new Date(subData.last_webhook_sync) : null;
  const minutesSince = lastSync ? (Date.now() - lastSync.getTime()) / 60000 : 999;

  const forceParam = req.query.force === "true";
  const staleThreshold = forceParam ? STALE_MINUTES_FORCED : STALE_MINUTES;

  if (minutesSince < staleThreshold) {
    return res.status(200).json({ synced: false, reason: "recent", minutesSince: Math.round(minutesSince) });
  }

  // Obtener access token — refresca automáticamente si está vencido
  // Si devuelve null es porque el refresh también falló (token revocado o expirado definitivamente)
  const accessToken = await getValidAccessToken(email);
  if (!accessToken) {
    return res.status(200).json({ synced: false, reason: "token_expired" });
  }

  try {
    // Sincronizar ANTES de responder (Vercel mata el proceso post-respuesta)
    await syncAndPersist(accessToken, email, subData?.team_id ?? null, 90);

    // Marcar sync completada — el polling del dashboard lo detectará
    const syncedAt = new Date().toISOString();
    await supabaseAdmin
      .from("subscriptions")
      .update({ last_webhook_sync: syncedAt })
      .eq("email", email);

    // Actualizar streak y rank con los nuevos datos
    try {
      const { weeklyGoal } = await getGoals(subData?.team_id);
      const { data: events } = await supabaseAdmin
        .from("calendar_events")
        .select("start_at, is_productive")
        .eq("user_email", email)
        .gte("start_at", new Date(Date.now() - 90 * 86400000).toISOString());

      if (events?.length) {
        // Agrupar por día en horario Argentina (UTC-3) — igual que streak.ts
        const byDay: Record<string, number> = {};
        events.filter(e => e.is_productive).forEach(e => {
          // Convertir a hora local Argentina antes de extraer la fecha
          const arDate = new Date(new Date(e.start_at).getTime() - 3 * 60 * 60 * 1000);
          const day = arDate.toISOString().slice(0, 10);
          byDay[day] = (byDay[day] || 0) + 1;
        });
        const summaries = Object.entries(byDay).map(([date, greenCount]) => ({ date, greenCount }));
        const streakData = await computeAndSaveStreak(email, summaries);

        // Lunes de la semana actual en hora Argentina
        const nowAr = new Date(Date.now() - 3 * 60 * 60 * 1000);
        const monday = new Date(nowAr);
        monday.setDate(nowAr.getDate() - ((nowAr.getDay() + 6) % 7));
        const weekStart = monday.toISOString().slice(0, 10);
        const weekGreen = summaries.filter(d => d.date >= weekStart).reduce((s, d) => s + d.greenCount, 0);
        const iac = Math.min(100, Math.round((weekGreen / weeklyGoal) * 100));
        await saveWeeklyStatsAndRank(email, weekStart, iac, weekGreen, streakData.best);
      }
    } catch { /* streak/rank non-critical */ }

    return res.status(200).json({ synced: true, syncedAt });
  } catch (err: any) {
    console.error("[sync-now] error:", err?.message);
    return res.status(200).json({ synced: false, reason: "error", error: err?.message });
  }
}
