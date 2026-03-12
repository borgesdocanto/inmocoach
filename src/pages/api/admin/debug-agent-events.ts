import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { isSuperAdmin } from "../../../lib/adminGuard";

// ENDPOINT TEMPORAL DE DEBUG — borrar después de diagnosticar
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!isSuperAdmin(session?.user?.email)) return res.status(403).end();

  const email = req.query.email as string;
  if (!email) return res.status(400).json({ error: "email requerido" });

  // 1. Subscription info
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("plan, team_id, google_access_token, google_refresh_token, google_token_expiry, onboarding_done")
    .eq("email", email)
    .single();

  // 2. Total events in DB
  const { count: totalCount } = await supabaseAdmin
    .from("calendar_events")
    .select("*", { count: "exact", head: true })
    .eq("user_email", email);

  // 3. Events this week 9-15 mar 2026
  const { data: weekEvents } = await supabaseAdmin
    .from("calendar_events")
    .select("title, start_at, end_at, is_productive, is_organizer, event_type")
    .eq("user_email", email)
    .gte("start_at", "2026-03-09T00:00:00Z")
    .lte("start_at", "2026-03-15T23:59:59Z")
    .order("start_at");

  // 4. Date range in DB
  const { data: oldest } = await supabaseAdmin
    .from("calendar_events")
    .select("start_at")
    .eq("user_email", email)
    .order("start_at", { ascending: true })
    .limit(1);

  const { data: newest } = await supabaseAdmin
    .from("calendar_events")
    .select("start_at")
    .eq("user_email", email)
    .order("start_at", { ascending: false })
    .limit(1);

  return res.status(200).json({
    subscription: {
      plan: sub?.plan,
      team_id: sub?.team_id,
      has_access_token: !!sub?.google_access_token,
      has_refresh_token: !!sub?.google_refresh_token,
      token_expiry: sub?.google_token_expiry,
      onboarding_done: sub?.onboarding_done,
    },
    db: {
      total_events: totalCount,
      oldest_event: oldest?.[0]?.start_at,
      newest_event: newest?.[0]?.start_at,
    },
    week_9_15_mar: {
      count: weekEvents?.length ?? 0,
      events: weekEvents?.map(e => ({
        title: e.title,
        start_ar: new Date(e.start_at).toLocaleString("es-AR", {
          timeZone: "America/Argentina/Buenos_Aires",
          day: "2-digit", month: "2-digit",
          hour: "2-digit", minute: "2-digit"
        }),
        start_utc: e.start_at,
        type: e.event_type,
        green: e.is_productive,
        organizer: e.is_organizer,
      })),
    },
  });
}
