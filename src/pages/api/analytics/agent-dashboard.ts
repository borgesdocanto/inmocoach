import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getStoredEvents, IAC_GOAL, PROCESOS_GOAL, calcIAC } from "../../../lib/calendarSync";
import { getAgentRankStats } from "../../../lib/ranks";
import { subDays, startOfDay, endOfDay } from "date-fns";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const { agentEmail, days: daysParam } = req.query;
  if (!agentEmail || typeof agentEmail !== "string")
    return res.status(400).json({ error: "agentEmail requerido" });

  // Solo owner o team_leader del mismo equipo
  const { data: requester } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, team_role")
    .eq("email", session.user.email)
    .single();

  if (!requester?.team_id || !["owner", "team_leader"].includes(requester.team_role))
    return res.status(403).json({ error: "Sin acceso" });

  const { data: agent } = await supabaseAdmin
    .from("subscriptions")
    .select("email, name, avatar, team_id, streak_current, streak_best, rank_slug")
    .eq("email", agentEmail)
    .eq("team_id", requester.team_id)
    .single();

  if (!agent) return res.status(404).json({ error: "Agente no encontrado en tu equipo" });

  const days = parseInt(daysParam as string) || 7;
  const now = new Date();
  const from = startOfDay(subDays(now, days));
  const to = endOfDay(now);

  const events = await getStoredEvents(agentEmail, from, to);

  console.log(`[agent-dashboard] agentEmail=${agentEmail} days=${days} from=${from.toISOString()} to=${to.toISOString()} events=${events.length}`);

  // Also try raw query to diagnose
  const { data: rawCheck, error: rawError } = await supabaseAdmin
    .from("calendar_events")
    .select("user_email, start_at, is_productive")
    .eq("user_email", agentEmail)
    .order("start_at", { ascending: false })
    .limit(5);
  console.log(`[agent-dashboard] raw last 5 events:`, JSON.stringify(rawCheck), rawError?.message);

  // Build daily summaries
  const productivityGoal = parseInt(process.env.NEXT_PUBLIC_PRODUCTIVITY_GOAL || "2");
  const byDay: Record<string, typeof events> = {};
  events.forEach(ev => {
    const day = ev.start.slice(0, 10);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(ev);
  });

  const dailySummaries = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, evs]) => {
      const greenCount = evs.filter(e => e.isGreen).length;
      const procesosCount = evs.filter(e => e.isProceso).length;
      return {
        date,
        greenCount,
        procesosCount,
        isProductive: greenCount >= productivityGoal,
        events: evs.map(e => ({
          id: e.id,
          title: e.title,
          start: e.start,
          end: e.end,
          type: e.type,
          isGreen: e.isGreen,
          isProceso: e.isProceso,
          isCierre: e.isCierre,
          isUserColored: e.isUserColored,
          attendees: [],
        })),
      };
    });

  const greenEvents = events.filter(e => e.isGreen);
  const semanas = Math.max(1, Math.ceil(days / 7));
  const avgPorSemana = greenEvents.length / semanas;

  const totals = {
    tasaciones: greenEvents.filter(e => e.type === "tasacion").length,
    primerasVisitas: greenEvents.filter(e => e.type === "primera_visita").length,
    fotosVideo: greenEvents.filter(e => e.type === "fotos_video").length,
    visitas: greenEvents.filter(e => ["visita", "conocer", "primera_visita"].includes(e.type)).length,
    propuestas: greenEvents.filter(e => e.type === "propuesta").length,
    firmas: greenEvents.filter(e => e.isCierre).length,
    reuniones: greenEvents.filter(e => e.type === "reunion").length,
    procesosNuevos: greenEvents.filter(e => e.isProceso).length,
    totalGreen: greenEvents.length,
    totalEvents: events.length,
    iac: calcIAC(avgPorSemana),
    iacGoal: IAC_GOAL,
    procesosGoal: PROCESOS_GOAL,
  };

  const productiveDays = dailySummaries.filter(d => d.isProductive).length;
  const totalDays = dailySummaries.length;

  const rankStats = await getAgentRankStats(agentEmail).catch(() => null);

  return res.status(200).json({
    user: { name: agent.name || agentEmail.split("@")[0], email: agentEmail, image: agent.avatar },
    syncedAt: new Date().toISOString(),
    period: { from: from.toISOString(), to: to.toISOString(), days },
    totals,
    productivityGoal,
    productiveDays,
    totalDays,
    productivityRate: totalDays > 0 ? Math.round((productiveDays / totalDays) * 100) : 0,
    dailySummaries,
    recentEvents: events.slice(-50).reverse().map(e => ({
      id: e.id, title: e.title, start: e.start, end: e.end,
      type: e.type, isGreen: e.isGreen, isProceso: e.isProceso,
      isCierre: e.isCierre, isUserColored: e.isUserColored, attendees: [],
    })),
    streak: { current: agent.streak_current || 0, best: agent.streak_best || 0, todayActive: false, lastActiveDate: null },
    rankStats,
  });
}
