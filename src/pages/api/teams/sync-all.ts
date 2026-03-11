import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { syncAndPersist, IAC_GOAL } from "../../../lib/calendarSync";
import { getValidAccessToken } from "../../../lib/googleToken";
import { computeAndSaveStreak } from "../../../lib/streak";
import { saveWeeklyStatsAndRank } from "../../../lib/ranks";
import { startOfWeek, format } from "date-fns";

export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const { data: requester } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, team_role")
    .eq("email", session.user.email)
    .single();

  if (!requester?.team_id || !["owner", "team_leader"].includes(requester.team_role))
    return res.status(403).json({ error: "Sin acceso" });

  const { data: members } = await supabaseAdmin
    .from("subscriptions")
    .select("email, team_id, streak_best")
    .eq("team_id", requester.team_id)
    .not("google_access_token", "is", null);

  if (!members?.length) return res.status(200).json({ ok: true, synced: 0 });

  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

  const syncMember = async (member: typeof members[0]) => {
    const accessToken = await getValidAccessToken(member.email);
    if (!accessToken) return "skipped";
    const events = await syncAndPersist(accessToken, member.email, member.team_id, 90);
    const byDay: Record<string, number> = {};
    for (const e of events) {
      if (e.isGreen) byDay[e.start.slice(0, 10)] = (byDay[e.start.slice(0, 10)] || 0) + 1;
    }
    const dailySummaries = Object.entries(byDay).map(([date, greenCount]) => ({ date, greenCount }));
    const streakData = await computeAndSaveStreak(member.email, dailySummaries).catch(() => null);
    const weekGreen = events.filter(e => e.isGreen && e.start.slice(0, 10) >= weekStart);
    const weekIac = Math.min(100, Math.round((weekGreen.length / IAC_GOAL) * 100));
    await saveWeeklyStatsAndRank(member.email, weekStart, weekIac, weekGreen.length, (streakData as any)?.best ?? member.streak_best ?? 0);
    return "synced";
  };

  // Procesar en lotes de 5 para no saturar la API de Google ni el timeout de Vercel
  const BATCH_SIZE = 5;
  const results: PromiseSettledResult<string>[] = [];
  for (let i = 0; i < members.length; i += BATCH_SIZE) {
    const batch = members.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(batch.map(syncMember));
    results.push(...batchResults);
  }

  const synced = results.filter(r => r.status === "fulfilled" && r.value === "synced").length;
  return res.status(200).json({ ok: true, synced, total: members.length });
}
