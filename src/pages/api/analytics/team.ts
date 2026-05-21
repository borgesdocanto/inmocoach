import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { getEffectiveEmail } from "../../../lib/impersonation";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getAgentSummary, getTeamOverview } from "../../../lib/analytics";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const email = getEffectiveEmail(req, session) ?? session.user.email;

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, team_role")
    .eq("email", email)
    .single();

  if (!sub?.team_id || !["owner", "team_leader"].includes(sub.team_role)) {
    return res.status(403).json({ error: "Sin acceso" });
  }

  // Todos los miembros del equipo incluyendo el broker
  const { data: members } = await supabaseAdmin
    .from("subscriptions")
    .select("email, name, avatar, team_role")
    .eq("team_id", sub.team_id);

  if (!members?.length) return res.status(200).json({ agents: [], overview: null });

  const weekOffset = parseInt((req.query.weekOffset as string) || "0");

  const agents = await Promise.all(
    members.map(async m => {
      const stats = await getAgentSummary(m.email, weekOffset, sub.team_id);
      return { ...stats, name: m.name, avatar: m.avatar, teamRole: m.team_role };
    })
  );

  const overview = await getTeamOverview(sub.team_id, weekOffset);

  return res.status(200).json({ agents, overview });
}
