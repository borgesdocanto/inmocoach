import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";

// GET /api/analytics/team-portfolio
// Returns portfolio stats per agent for the broker dashboard
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).end();

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, team_role")
    .eq("email", session.user.email)
    .single();

  if (!sub?.team_id || !["owner", "team_leader"].includes(sub.team_role)) {
    return res.status(403).json({ error: "Sin acceso" });
  }

  const { data: team } = await supabaseAdmin
    .from("teams")
    .select("tokko_api_key")
    .eq("id", sub.team_id)
    .single();

  if (!team?.tokko_api_key) {
    return res.status(200).json({ connected: false, agents: [] });
  }

  // Get all available properties with producer info
  const { data: properties } = await supabaseAdmin
    .from("tokko_properties")
    .select("producer_email, producer_name, producer_id, days_since_update, photos_count")
    .eq("team_id", sub.team_id)
    .eq("status", 2); // available only

  if (!properties?.length) {
    return res.status(200).json({ connected: true, agents: [] });
  }

  // Group by producer
  const byAgent: Record<string, {
    email: string; name: string;
    total: number; complete: number; incomplete: number; stale: number;
  }> = {};

  for (const p of properties) {
    const email = p.producer_email || "sin_asignar";
    const name = p.producer_name || "Sin asignar";
    if (!byAgent[email]) {
      byAgent[email] = { email, name, total: 0, complete: 0, incomplete: 0, stale: 0 };
    }
    byAgent[email].total++;

    const hasPhotos = (p.photos_count || 0) >= 15;
    const stale = p.days_since_update !== null && p.days_since_update > 30;
    // Simplified completeness: just photos + freshness
    const complete = hasPhotos && !stale;

    if (complete) byAgent[email].complete++;
    else byAgent[email].incomplete++;
    if (stale) byAgent[email].stale++;
  }

  const agents = Object.values(byAgent).sort((a, b) => b.total - a.total);
  return res.status(200).json({ connected: true, agents });
}
