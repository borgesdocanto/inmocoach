import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { syncAndPersist, computeWeekStats } from "../../../lib/calendarSync";
import { getGoals } from "../../../lib/appConfig";
import { computeAndSaveStreak } from "../../../lib/streak";
import { saveWeeklyStatsAndRank } from "../../../lib/ranks";
import { getValidAccessToken } from "../../../lib/googleToken";
import { startOfWeek, format } from "date-fns";

// Corre lunes a viernes a las 20hs UTC (17hs Argentina)
// vercel.json: "0 20 * * 1-5"

const BATCH_SIZE = 5;

function getMonday(): string {
  return format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

async function syncUser(user: { email: string; team_id: string | null; streak_best: number }, fromWebhook = false): Promise<"synced" | "skipped" | "error"> {
  try {
    const accessToken = await getValidAccessToken(user.email);
    if (!accessToken) return "skipped";

    const events = await syncAndPersist(accessToken, user.email, user.team_id, 30);

    // Racha
    const byDay: Record<string, number> = {};
    for (const e of events) {
      if (e.isGreen) byDay[e.start.slice(0, 10)] = (byDay[e.start.slice(0, 10)] || 0) + 1;
    }
    const dailySummaries = Object.entries(byDay).map(([date, greenCount]) => ({ date, greenCount }));
    const streakData = await computeAndSaveStreak(user.email, dailySummaries, user.team_id);

    // Weekly stats de la semana actual
    const weekStart = getMonday();
    const weekGreen = events.filter(e => e.isGreen && e.start.slice(0, 10) >= weekStart);
    const { weeklyGoal } = await getGoals(user.team_id);
    const weekIac = Math.min(100, Math.round((weekGreen.length / weeklyGoal) * 100));
    await saveWeeklyStatsAndRank(user.email, weekStart, weekIac, weekGreen.length, (streakData as any)?.best ?? user.streak_best ?? 0);

    // Si viene del webhook, actualizar timestamp AQUÍ — después de que los datos están en DB
    if (fromWebhook) {
      await supabaseAdmin.from("subscriptions")
        .update({ last_webhook_sync: new Date().toISOString() })
        .eq("email", user.email);
    }

    return "synced";
  } catch (err: any) {
    console.error(`Daily sync error ${user.email}:`, err?.message);
    return "error";
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isVercel = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  const isManual = req.headers["x-cron-secret"] === process.env.CRON_SECRET || req.query.secret === process.env.CRON_SECRET;
  if (!isVercel && !isManual) return res.status(401).json({ error: "Unauthorized" });

  // Si viene targetEmail (del webhook), sincronizar solo ese usuario y responder DESPUÉS
  const targetEmail = req.body?.targetEmail || req.query?.targetEmail;
  if (targetEmail && typeof targetEmail === "string") {
    const { data: user } = await supabaseAdmin
      .from("subscriptions")
      .select("email, team_id, streak_best")
      .eq("email", targetEmail)
      .single();

    if (!user) return res.status(200).json({ ok: true, message: "Usuario no encontrado" });

    // Sync completo ANTES de responder — la Edge Function espera este 200
    const result = await syncUser(user, true); // fromWebhook=true → escribe last_webhook_sync al final
    console.log(`✅ Webhook sync ${targetEmail}:`, result);
    return res.status(200).json({ ok: true, result });
  }

  // Solo usuarios con token de Google Y que no tengan trial expirado
  const { data: allUsersRaw } = await supabaseAdmin
    .from("subscriptions")
    .select("email, team_id, streak_best, plan, created_at, trial_ends_at, status")
    .eq("status", "active")
    .not("google_access_token", "is", null);

  // Filtrar expirados en memoria (el plan free no cambia status en DB al vencer)
  const nowMs = Date.now();
  const { isFreeExpired } = await import("../../../lib/brand");
  const users = (allUsersRaw || []).filter(u => !isFreeExpired(u));

  if (!users?.length) {
    return res.status(200).json({ ok: true, message: "No hay usuarios", synced: 0 });
  }

  console.log(`🔄 Daily sync: ${users.length} usuarios`);

  res.status(200).json({ ok: true, total: users.length, message: `Sincronizando ${users.length} usuarios` });

  const results = { synced: 0, skipped: 0, error: 0 };
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(batch.map(u => syncUser(u)));
    for (const r of batchResults) {
      if (r.status === "fulfilled") results[r.value]++;
      else results.error++;
    }
    if (i + BATCH_SIZE < users.length) await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`✅ Daily sync completo:`, results);

  // Ejecutar streak-alert inmediatamente después del sync
  // para que los eventos recién sincronizados sean considerados
  try {
    const baseUrl = process.env.NEXTAUTH_URL;
    const secret = process.env.CRON_SECRET;
    fetch(`${baseUrl}/api/cron/streak-alert`, {
      method: "POST",
      headers: { "x-cron-secret": secret! },
    }).catch(() => {});
  } catch {}
}
