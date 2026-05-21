// Endpoint que sirve datos desde DB — nunca llama a Google
// Responde en <200ms y NUNCA devuelve vacío si hay datos históricos
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { getEffectiveEmail } from "../../../lib/impersonation";
import { getOrCreateSubscription, isFreemiumExpired } from "../../../lib/subscription";
import { getStoredEvents, calcIAC, PROCESOS_GOAL } from "../../../lib/calendarSync";
import { getGoals } from "../../../lib/appConfig";
import { getAgentRankStats } from "../../../lib/ranks";
import { supabaseAdmin } from "../../../lib/supabase";
import { subDays, addDays, startOfDay, endOfDay, formatISO } from "date-fns";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const email = getEffectiveEmail(req, session) ?? session.user.email;

  const sub = await getOrCreateSubscription(email);
  if (isFreemiumExpired(sub)) return res.status(403).json({ error: "Prueba terminada" });

  const requestedDays = parseInt(req.query.days as string) || 30;
  const now = new Date();
  const fetchDays = Math.max(requestedDays, 90);
  const from = startOfDay(subDays(now, fetchDays));
  const to = endOfDay(addDays(now, 30));

  // Leer eventos de DB — siempre disponibles, nunca depende de Google
  const events = await getStoredEvents(email, from, to);

  const { data: subData } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, onboarding_done, streak_current, streak_best, streak_shields, rank_slug")
    .eq("email", email)
    .single();

  const { weeklyGoal, productiveDayMin } = await getGoals(sub?.teamId);
  const productivityGoal = productiveDayMin;

  const byDay: Record<string, typeof events> = {};
  events.forEach(ev => {
    const day = ev.start.slice(0, 10);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(ev);
  });

  const dailySummaries = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayEvents]) => {
      const greenCount = dayEvents.filter(e => e.isGreen).length;
      const procesosCount = dayEvents.filter(e => e.isProceso).length;
      return {
        date, greenCount, procesosCount,
        events: dayEvents.map(e => ({
          id: e.id, title: e.title, start: e.start, end: e.end,
          colorId: undefined as string | undefined,
          isGreen: e.isGreen, isProceso: e.isProceso,
          isCierre: e.isCierre, isUserColored: e.isUserColored,
          isOrganizer: e.isOrganizer, type: e.type, attendees: [] as string[],
        })),
        isProductive: greenCount >= productivityGoal,
      };
    });

  const statsFromDate = formatISO(startOfDay(subDays(now, requestedDays)));
  const statsToDate = formatISO(endOfDay(now));
  const greenEvents = events.filter(e => e.isGreen && e.start >= statsFromDate && e.start <= statsToDate);
  const semanas = Math.max(1, Math.ceil(requestedDays / 7));
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
    iac: calcIAC(avgPorSemana, weeklyGoal),
    iacGoal: weeklyGoal,
    procesosGoal: PROCESOS_GOAL,
  };

  const statsDateStr = statsFromDate.slice(0, 10);
  const productiveDays = dailySummaries.filter(d => d.isProductive && d.date >= statsDateStr).length;
  const totalDays = dailySummaries.filter(d => d.date >= statsDateStr && d.date <= statsToDate.slice(0, 10)).length;

  let streak = null;
  let rankStats = null;
  try {
    // Usar hora Argentina (UTC-3) para que después de las 21hs no se pase al "día siguiente"
    const nowAr = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const todayStr = nowAr.toISOString().slice(0, 10);
    const todaySummary = dailySummaries.find(d => d.date === todayStr);
    streak = {
      current: subData?.streak_current ?? 0,
      best: subData?.streak_best ?? 0,
      shields: subData?.streak_shields ?? 0,
      todayActive: (todaySummary?.greenCount ?? 0) >= productivityGoal,
    };
    rankStats = await getAgentRankStats(email);
  } catch {}

  res.setHeader("Cache-Control", "private, max-age=60");

  return res.status(200).json({
    user: { name: session.user.name, email: session.user.email, image: session.user.image },
    syncedAt: null,
    fromCache: true,
    period: { from: from.toISOString(), to: to.toISOString(), days: requestedDays },
    totals,
    productivityGoal,
    productiveDays,
    totalDays,
    productivityRate: totalDays > 0 ? Math.round((productiveDays / totalDays) * 100) : 0,
    dailySummaries,
    recentEvents: [...events].reverse().slice(0, 50).map(e => ({
      id: e.id, title: e.title, start: e.start, end: e.end,
      isGreen: e.isGreen, isProceso: e.isProceso, isCierre: e.isCierre,
      isUserColored: e.isUserColored, isOrganizer: e.isOrganizer,
      type: e.type, attendees: [] as string[],
    })),
    onboardingDone: subData?.onboarding_done ?? false,
    streak,
    rankStats,
  });
}
