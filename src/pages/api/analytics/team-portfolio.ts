import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";

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
    return res.status(200).json({ connected: false, active: [], uninvited: [] });
  }

  // Active team members emails
  const { data: members } = await supabaseAdmin
    .from("subscriptions")
    .select("email, name, avatar")
    .eq("team_id", sub.team_id);
  const memberEmails = new Set((members || []).map((m: any) => m.email.toLowerCase()));
  const memberByEmail: Record<string, any> = {};
  for (const m of members || []) memberByEmail[m.email.toLowerCase()] = m;

  // Pending invitations (don't show as uninvited)
  const { data: pending } = await supabaseAdmin
    .from("team_invitations")
    .select("email")
    .eq("team_id", sub.team_id)
    .eq("status", "pending");
  const pendingEmails = new Set((pending || []).map((p: any) => p.email.toLowerCase()));

  // All properties for this team — status 2 (available) or fallback to all
  let { data: properties } = await supabaseAdmin
    .from("tokko_properties")
    .select("producer_email, producer_name, days_since_update, days_online, photos_count, status")
    .eq("team_id", sub.team_id);

  // Filter to available only (status may be int or string depending on Tokko API)
  if (properties?.length) {
    const available = properties.filter((p: any) => p.status === 2 || p.status === "2" || p.status === "disponible");
    properties = available.length > 0 ? available : properties;
  }

  if (!properties?.length) {
    return res.status(200).json({ connected: true, active: [], uninvited: [] });
  }

  // Group by producer
  const byAgent: Record<string, {
    email: string; name: string; avatar?: string;
    total: number; complete: number; incomplete: number; stale: number;
    isMember: boolean;
  }> = {};

  for (const p of properties) {
    const email = (p.producer_email || "").toLowerCase();
    if (!email) continue;
    const name = p.producer_name || email;
    if (!byAgent[email]) {
      const member = memberByEmail[email];
      byAgent[email] = {
        email, name: member?.name || name, avatar: member?.avatar || null,
        total: 0, complete: 0, incomplete: 0, stale: 0,
        isMember: memberEmails.has(email),
      };
    }
    byAgent[email].total++;

    const hasPhotos = (p.photos_count || 0) >= 15;
    // days_since_update is null when Tokko's last_update field is null — fall back to days_online
    const ageDays = p.days_since_update ?? p.days_online;
    const stale = ageDays !== null && ageDays > 90;
    const complete = hasPhotos && !stale;
    if (complete) byAgent[email].complete++;
    else byAgent[email].incomplete++;
    if (stale) byAgent[email].stale++;
  }

  const all = Object.values(byAgent).sort((a, b) => b.total - a.total);
  const active = all.filter(a => a.isMember);
  // Uninvited: in Tokko but not in team and no pending invite
  const uninvited = all.filter(a => !a.isMember && !pendingEmails.has(a.email));

  return res.status(200).json({ connected: true, active, uninvited });
}
