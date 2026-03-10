import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { syncAndPersist, computeWeekStats, IAC_GOAL } from "../../../lib/calendarSync";
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

async function syncUser(user: { email: string; team_id: string | null; streak_best: number }): Promise<"synced" | "skipped" | "error"> {
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
    const streakData = await computeAndSaveStreak(user.email, dailySummaries);

    // Weekly stats de la semana actual
    const weekStart = getMonday();
    const weekGreen = events.filter(e => e.isGreen && e.start.slice(0, 10) >= weekStart);
    const weekIac = Math.min(100, Math.round((weekGreen.length / IAC_GOAL) * 100));
    await saveWeeklyStatsAndRank(user.email, weekStart, weekIac, weekGreen.length, (streakData as any)?.best ?? user.streak_best ?? 0);

    return "synced";
  } catch (err: any) {
    console.error(`Daily sync error ${user.email}:`, err?.message);
    return "error";
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const secret = req.headers["x-cron-secret"] || req.query.secret;
  if (secret !== process.env.CRON_SECRET) return res.status(401).json({ error: "Unauthorized" });

  // Todos los usuarios con token de Google (no solo los con racha activa)
  const { data: users } = await supabaseAdmin
    .from("subscriptions")
    .select("email, team_id, streak_best")
    .not("google_access_token", "is", null);

  if (!users?.length) {
    return res.status(200).json({ ok: true, message: "No hay usuarios", synced: 0 });
  }

  console.log(`🔄 Daily sync: ${users.length} usuarios`);

  res.status(200).json({ ok: true, total: users.length, message: `Sincronizando ${users.length} usuarios` });

  const results = { synced: 0, skipped: 0, error: 0 };
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(batch.map(syncUser));
    for (const r of batchResults) {
      if (r.status === "fulfilled") results[r.value]++;
      else results.error++;
    }
    if (i + BATCH_SIZE < users.length) await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`✅ Daily sync completo:`, results);
}
