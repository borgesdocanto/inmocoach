import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { isSuperAdmin } from "../../../lib/adminGuard";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { saveWeeklyStatsAndRank } from "../../../lib/ranks";
import { startOfWeek, format, subWeeks } from "date-fns";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email || !isSuperAdmin(session.user.email))
    return res.status(403).json({ error: "Solo super admin" });

  // Get all users with calendar events
  const { data: users } = await supabaseAdmin
    .from("subscriptions")
    .select("email, streak_best");

  if (!users?.length) return res.status(200).json({ ok: true, processed: 0 });

  const results: any[] = [];

  for (const user of users) {
    // Get all green events for this user
    const { data: events } = await supabaseAdmin
      .from("calendar_events")
      .select("start_at, is_productive")
      .eq("user_email", user.email)
      .eq("is_productive", true);

    if (!events?.length) continue;

    // Group by week
    const byWeek: Record<string, number> = {};
    for (const ev of events) {
      const monday = format(startOfWeek(new Date(ev.start_at), { weekStartsOn: 1 }), "yyyy-MM-dd");
      byWeek[monday] = (byWeek[monday] || 0) + 1;
    }

    // Save each week
    for (const [weekStart, greenCount] of Object.entries(byWeek)) {
      const iac = Math.min(100, Math.round((greenCount / 15) * 100));
      await saveWeeklyStatsAndRank(user.email, weekStart, iac, greenCount, user.streak_best ?? 0);
    }

    results.push({ email: user.email, weeks: Object.keys(byWeek).length });
  }

  return res.status(200).json({ ok: true, processed: results.length, results });
}
