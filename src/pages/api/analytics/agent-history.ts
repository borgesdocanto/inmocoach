import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getGoals } from "../../../lib/appConfig";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const { agentEmail } = req.query;
  if (!agentEmail || typeof agentEmail !== "string")
    return res.status(400).json({ error: "agentEmail requerido" });

  // Verificar acceso
  const { data: requester } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, team_role")
    .eq("email", session.user.email)
    .single();

  if (!requester?.team_id || !["owner", "team_leader"].includes(requester.team_role))
    return res.status(403).json({ error: "Sin acceso" });

  const { data: agent } = await supabaseAdmin
    .from("subscriptions")
    .select("email, name, avatar, rank_slug, streak_current, streak_best, streak_shields, team_id")
    .eq("email", agentEmail)
    .eq("team_id", requester.team_id)
    .single();

  if (!agent) return res.status(404).json({ error: "Agente no encontrado" });

  // Últimas 26 semanas de weekly_stats
  const { data: weeklyStats } = await supabaseAdmin
    .from("weekly_stats")
    .select("week_start, iac, green_total")
    .eq("email", agentEmail)
    .order("week_start", { ascending: true })
    .limit(26);

  // Rank config para umbrales
  const { data: rankConfig } = await supabaseAdmin
    .from("rank_config")
    .select("slug, label, icon, min_iac_up, min_iac_keep, sort_order")
    .order("sort_order");

  const { weeklyGoal } = await getGoals();

  // Calcular tendencia: promedio últimas 4 semanas vs 4 anteriores
  const weeks = weeklyStats || [];
  const last4 = weeks.slice(-4);
  const prev4 = weeks.slice(-8, -4);
  const avg4 = last4.length ? Math.round(last4.reduce((s, w) => s + w.iac, 0) / last4.length) : 0;
  const avgPrev4 = prev4.length ? Math.round(prev4.reduce((s, w) => s + w.iac, 0) / prev4.length) : 0;
  const trend = avg4 - avgPrev4; // positivo = mejorando

  // Racha de semanas activas (iac > 0) consecutivas desde el final
  let activeStreak = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].iac > 0) activeStreak++;
    else break;
  }

  // Mejor semana
  const bestWeek = weeks.reduce((b, w) => w.green_total > (b?.green_total ?? 0) ? w : b, weeks[0] ?? null);

  // Consistencia: % de semanas activas en las últimas 12
  const last12 = weeks.slice(-12);
  const consistency = last12.length
    ? Math.round((last12.filter(w => w.iac > 0).length / last12.length) * 100)
    : 0;

  return res.status(200).json({
    agent: {
      name: agent.name || agentEmail.split("@")[0],
      email: agentEmail,
      image: agent.avatar,
      rankSlug: agent.rank_slug,
      streakCurrent: agent.streak_current ?? 0,
      streakBest: agent.streak_best ?? 0,
    },
    weeklyGoal,
    weeklyStats: weeks,
    rankConfig: rankConfig || [],
    summary: {
      avg4,
      avgPrev4,
      trend,
      activeStreak,
      consistency,
      bestWeek,
      totalActiveWeeks: weeks.filter(w => w.iac > 0).length,
    },
  });
}
