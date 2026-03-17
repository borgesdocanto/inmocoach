import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { isSuperAdmin } from "../../../lib/adminGuard";
import { supabaseAdmin } from "../../../lib/supabase";
import { syncAndPersist } from "../../../lib/calendarSync";
import { getValidAccessToken } from "../../../lib/googleToken";
import { saveWeeklyStatsAndRank } from "../../../lib/ranks";
import { computeAndSaveStreak } from "../../../lib/streak";
import { startOfWeek, format } from "date-fns";
import { getGoals } from "../../../lib/appConfig";

// Cron: domingos a las 3am UTC — sync profundo 365 días para todos los usuarios activos
// vercel.json: "0 3 * * 0"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  const isVercel = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  const isManual = req.headers["x-cron-secret"] === process.env.CRON_SECRET || req.query.secret === process.env.CRON_SECRET;
  if (!isVercel && !isManual) {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email || !isSuperAdmin(session.user.email))
      return res.status(401).json({ error: "Unauthorized" });
  }

  const startTime = Date.now();
  const results = { synced: 0, skipped: 0, errors: 0, users: [] as string[] };

  try {
    // Traer todos los usuarios activos con token de Google
    const { data: users } = await supabaseAdmin
      .from("subscriptions")
      .select("email, team_id")
      .eq("status", "active")
      .not("google_access_token", "is", null);

    if (!users?.length) return res.status(200).json({ ok: true, ...results });

    for (const user of users) {
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
        const streakData = await computeAndSaveStreak(user.email, dailySummaries);
        // Weekly stats semana actual
        const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
        const weekGreen = events.filter(e => e.isGreen && e.start.slice(0, 10) >= weekStart);
        const { weeklyGoal } = await getGoals();
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
    return res.status(200).json({ ok: true, duration: `${duration}s`, ...results });

  } catch (err: any) {
    console.error("Deep sync fatal:", err);
    return res.status(500).json({ error: err.message });
  }
}
