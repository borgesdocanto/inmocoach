import { NextApiRequest, NextApiResponse } from "next";
import { waitUntil } from "@vercel/functions";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { isSuperAdmin } from "../../../lib/adminGuard";
import { supabaseAdmin } from "../../../lib/supabase";
import { syncAndPersist } from "../../../lib/calendarSync";
import { getValidAccessToken } from "../../../lib/googleToken";
import { FREEMIUM_DAYS } from "../../../lib/brand";
import { saveWeeklyStatsAndRank } from "../../../lib/ranks";
import { computeAndSaveStreak } from "../../../lib/streak";
import { startOfWeek, format } from "date-fns";
import { getGoals } from "../../../lib/appConfig";

export const config = { maxDuration: 60 };

// Cron: domingos a las 3am UTC — sync profundo 365 días para todos los usuarios activos
// vercel.json: "0 3 * * 0"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  const isVercel = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}` || req.headers["x-vercel-cron"] === "1";
  const isManual = req.headers["x-cron-secret"] === process.env.CRON_SECRET || req.query.secret === process.env.CRON_SECRET;
  // Token externo de GitHub Actions
  let isExternal = false;
  const authHeader = req.headers.authorization ?? "";
  if (!isVercel && authHeader.startsWith("Bearer ")) {
    const candidate = authHeader.slice(7);
    const { data: tokenRow } = await supabaseAdmin
      .from("app_config").select("value").eq("key", "systeme_cron_token")
      .is("team_id", null).maybeSingle();
    isExternal = !!tokenRow?.value && tokenRow.value === candidate;
  }
  if (!isVercel && !isManual && !isExternal) {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email || !isSuperAdmin(session.user.email))
      return res.status(401).json({ error: "Unauthorized" });
  }

  // waitUntil: responder ya y sincronizar en background (evita timeout 30s de cron-job.org)
  waitUntil(runDeepSync());
  return res.status(202).json({ ok: true, message: "Deep sync iniciado" });
}

async function runDeepSync() {
  const startTime = Date.now();
  const results = { synced: 0, skipped: 0, errors: 0, users: [] as string[] };

  try {
    const { data: users } = await supabaseAdmin
      .from("subscriptions")
      .select("email, team_id, plan, created_at")
      .eq("status", "active")
      .not("google_access_token", "is", null);

    if (!users?.length) { console.log("[deep-sync] no users"); return; }

    // Filtrar freemium expirados (plan free con más de FREEMIUM_DAYS desde creación)
    const nowMs = Date.now();
    const activeUsers = (users as any[]).filter((u: any) => {
      if (u.plan && u.plan !== "free") return true;
      const diffDays = (nowMs - new Date(u.created_at || 0).getTime()) / (1000 * 60 * 60 * 24);
      return !(u.trial_ends_at ? Date.now() > new Date(u.trial_ends_at).getTime() : (Date.now() - new Date(u.created_at || 0).getTime()) / 86400000 > FREEMIUM_DAYS);
    });

    for (const user of activeUsers) {
      try {
        // Obtener token válido — refresca automáticamente si expiró
        const accessToken = await getValidAccessToken(user.email);
        if (!accessToken) {
          results.skipped++;
          continue;
        }

        // Sync profundo: 365 días
        const events = await syncAndPersist(accessToken, user.email, user.team_id, 365);
        // Racha
        const byDay: Record<string, number> = {};
        for (const e of events) {
          if (e.isGreen) byDay[e.start.slice(0, 10)] = (byDay[e.start.slice(0, 10)] || 0) + 1;
        }
        const dailySummaries = Object.entries(byDay).map(([date, greenCount]) => ({ date, greenCount }));
        const streakData = await computeAndSaveStreak(user.email, dailySummaries, user.team_id);
        // Weekly stats semana actual
        const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
        const weekGreen = events.filter(e => e.isGreen && e.start.slice(0, 10) >= weekStart);
        const { weeklyGoal } = await getGoals(user.team_id);
        const weekIac = Math.min(100, Math.round((weekGreen.length / weeklyGoal) * 100));
        await saveWeeklyStatsAndRank(user.email, weekStart, weekIac, weekGreen.length, (streakData as any)?.best ?? 0);
        results.synced++;
        results.users.push(user.email);

        // Pausa entre usuarios para no saturar la API de Google
        await new Promise(r => setTimeout(r, 500));
      } catch (err: any) {
        console.error(`Deep sync error for ${user.email}:`, err.message);
        results.errors++;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Deep sync completado en ${duration}s:`, results);
  } catch (err: any) {
    console.error("Deep sync fatal:", err);
  }
}
