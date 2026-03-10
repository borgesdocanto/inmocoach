import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { subDays, startOfDay, endOfDay } from "date-fns";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).end();

  const { agentEmail } = req.query;
  if (!agentEmail || typeof agentEmail !== "string") return res.status(400).end();

  const now = new Date();
  const from7 = startOfDay(subDays(now, 7));
  const to = endOfDay(now);
  const from90 = startOfDay(subDays(now, 90));

  // Total events in DB for this agent (no date filter)
  const { data: allEvents, error: e1 } = await supabaseAdmin
    .from("calendar_events")
    .select("google_event_id, title, start_at, is_productive, event_type, synced_at")
    .eq("user_email", agentEmail)
    .order("start_at", { ascending: false })
    .limit(10);

  // Count total
  const { count: totalCount } = await supabaseAdmin
    .from("calendar_events")
    .select("*", { count: "exact", head: true })
    .eq("user_email", agentEmail);

  // Events in last 7 days using same filter as getStoredEvents
  const { data: last7, error: e2 } = await supabaseAdmin
    .from("calendar_events")
    .select("google_event_id, title, start_at, is_productive")
    .eq("user_email", agentEmail)
    .gte("start_at", from7.toISOString())
    .lte("start_at", to.toISOString());

  // Events in last 90 days
  const { data: last90, error: e3 } = await supabaseAdmin
    .from("calendar_events")
    .select("google_event_id, title, start_at, is_productive")
    .eq("user_email", agentEmail)
    .gte("start_at", from90.toISOString())
    .lte("start_at", to.toISOString());

  return res.status(200).json({
    now: now.toISOString(),
    from7: from7.toISOString(),
    to: to.toISOString(),
    from90: from90.toISOString(),
    totalCount,
    last10Events: allEvents,
    last7Count: last7?.length ?? 0,
    last90Count: last90?.length ?? 0,
    errors: { e1: e1?.message, e2: e2?.message, e3: e3?.message },
  });
}
