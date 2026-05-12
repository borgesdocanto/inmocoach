import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { getEffectiveEmail } from "../../../lib/impersonation";
import { supabaseAdmin } from "../../../lib/supabase";
import { getAgentSummary } from "../../../lib/analytics";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const email = getEffectiveEmail(req, session) ?? session.user.email;

    const weekOffset = parseInt((req.query.weekOffset as string) || "0");

  // Datos del agente
  const agentStats = await getAgentSummary(email, weekOffset);

  // Ver si tiene equipo
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, team_role")
    .eq("email", email)
    .single();

  if (!sub?.team_id) {
    return res.status(200).json({ agentIac: agentStats.iac, teamAvgIac: null, diff: null, rank: null, teamTotal: null });
  }

  // Todos los miembros del equipo
  const { data: members } = await supabaseAdmin
    .from("subscriptions")
    .select("email")
    .eq("team_id", sub.team_id)
    .eq("status", "active");

  if (!members?.length) {
    return res.status(200).json({ agentIac: agentStats.iac, teamAvgIac: null, diff: null, rank: null, teamTotal: null });
  }

  const allStats = await Promise.all(members.map(m => getAgentSummary(m.email, weekOffset)));
  const teamAvgIac = Math.round(allStats.reduce((s, a) => s + a.iac, 0) / allStats.length);
  const diff = agentStats.iac - teamAvgIac;

  // Posición del agente en el equipo esta semana
  const sorted = [...allStats].sort((a, b) => b.iac - a.iac);
  const rank = sorted.findIndex(s => s.email === email) + 1;

  // Historial de las últimas 12 semanas del agente
  const { data: weeklyStats } = await supabaseAdmin
    .from("weekly_stats")
    .select("week_start, iac, green_total")
    .eq("email", email)
    .order("week_start", { ascending: true })
    .limit(12);

  return res.status(200).json({
    agentIac: agentStats.iac,
    agentWeekTotal: agentStats.weekTotal,
    teamAvgIac,
    diff,
    rank,
    teamTotal: members.length,
    weeklyHistory: weeklyStats || [],
    weeklyGoal: agentStats.weeklyGoal,
  });
}
