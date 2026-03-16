import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getStoredEvents, IAC_GOAL, PROCESOS_GOAL, calcIAC } from "../../../lib/calendarSync";
import { getGoals } from "../../../lib/appConfig";
import { getAgentRankStats } from "../../../lib/ranks";
import { subDays, addDays, startOfDay, endOfDay } from "date-fns";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const { agentEmail, days: daysParam } = req.query;
  if (!agentEmail || typeof agentEmail !== "string")
    return res.status(400).json({ error: "agentEmail requerido" });

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

  const statsDays = parseInt(daysParam as string) || 7;
  const now = new Date();
  // Leer siempre 90 días hacia atrás para que la navegación del calendario funcione,
  // pero calcular stats solo sobre el período seleccionado
  const fetchDays = Math.max(statsDays, 90);
  const from = startOfDay(subDays(now, fetchDays));
  const to = endOfDay(addDays(now, 30)); // 30 días hacia adelante

  const events = await getStoredEvents(agentEmail, from, to);

  const lastSyncedAt = events.length > 0 ? events[events.length - 1].start : null;
  const hasData = events.length > 0;

  const { weeklyGoal, productiveDayMin } = await getGoals();
  const productivityGoal = productiveDayMin;
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
        date, greenCount, procesosCount,
        isProductive: greenCount >= productivityGoal,
        events: evs.map(e => ({
          id: e.id, title: e.title, start: e.start, end: e.end,
          type: e.type, isGreen: e.isGreen, isProceso: e.isProceso,
          isCierre: e.isCierre, isUserColored: e.isUserColored, isOrganizer: e.isOrganizer, attendees: [],
        })),
      };
    });

  // Stats calculados solo sobre el período seleccionado (statsDays), no sobre fetchDays
  const statsFrom = startOfDay(subDays(now, statsDays)).toISOString();
  const statsTo = endOfDay(now).toISOString(); // fin de hoy, no momento exacto
  const greenEvents = events.filter(e => e.isGreen && e.start >= statsFrom && e.start <= statsTo);
  const semanas = Math.max(1, Math.ceil(statsDays / 7));
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
    iacGoal: weeklyGoal,
    procesosGoal: PROCESOS_GOAL,
  };

  const productiveDays = dailySummaries.filter(d => d.isProductive).length;
  const totalDays = dailySummaries.length;
  const rankStats = await getAgentRankStats(agentEmail).catch(() => null);

  return res.status(200).json({
    user: { name: agent.name || agentEmail.split("@")[0], email: agentEmail, image: agent.avatar },
    syncedAt: lastSyncedAt || new Date().toISOString(),
    lastSyncedAt,
    hasData,
    period: { from: from.toISOString(), to: to.toISOString(), days: statsDays },
    totals, productivityGoal, productiveDays, totalDays,
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
