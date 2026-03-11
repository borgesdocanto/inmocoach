import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { isSuperAdmin } from "../../../lib/adminGuard";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!isSuperAdmin(session?.user?.email)) return res.status(403).json({ error: "Forbidden" });

  const now = new Date();
  const last30 = new Date(now.getTime() - 30 * 86400000).toISOString();
  const last7 = new Date(now.getTime() - 7 * 86400000).toISOString();

  const [
    { data: allUsers },
    { data: teams },
    { data: payments },
    { data: newLast7 },
    { data: newLast30 },
  ] = await Promise.all([
    supabaseAdmin.from("subscriptions").select("email, name, avatar, plan, status, created_at, team_id, team_role, google_access_token"),
    supabaseAdmin.from("teams").select("id, name, agency_name, owner_email, max_agents, created_at, status"),
    supabaseAdmin.from("payments").select("amount, created_at, status").order("created_at", { ascending: false }).limit(20),
    supabaseAdmin.from("subscriptions").select("email").gte("created_at", last7),
    supabaseAdmin.from("subscriptions").select("email").gte("created_at", last30),
  ]);

  const users = allUsers || [];
  const byPlan = {
    free: users.filter(u => u.plan === "free").length,
    individual: users.filter(u => u.plan === "individual").length,
    teams: users.filter(u => u.plan === "teams").length,
  };
  const withCalendar = users.filter(u => u.google_access_token).length;
  const paid = byPlan.individual + byPlan.teams;

  return res.status(200).json({
    totals: {
      users: users.length,
      paid,
      free: byPlan.free,
      withCalendar,
      newLast7: newLast7?.length || 0,
      newLast30: newLast30?.length || 0,
      conversionRate: users.length > 0 ? Math.round((paid / users.length) * 100) : 0,
    },
    byPlan,
    teams: (teams || []).map(t => ({
      ...t,
      memberCount: users.filter(u => u.team_id === t.id).length,
      ownerName: users.find(u => u.email === t.owner_email)?.name || t.owner_email,
      status: (t as any).status || "active",
    })),
    recentPayments: payments || [],
  });
}
