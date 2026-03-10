import { supabaseAdmin } from "./supabase";
import { EventType, SyncedEvent, computePeriodStats, PeriodStats } from "./calendarSync";

export interface AgentSummary {
  email: string;
  name?: string;
  avatar?: string;
  teamRole: string;
  // Esta semana
  weekTotal: number;
  weekProductiveDays: number;
  iac: number;           // 0-100 basado en 15 reuniones
  // Últimos 30 días
  monthTotal: number;
  // Tendencia: comparación últimos 7 días vs 7 anteriores
  trend: "up" | "down" | "stable";
  trendPct: number;
  // Semáforo
  status: "green" | "yellow" | "red";
  // Sparkline: últimos 7 días con count de reuniones verdes
  sparkline: number[];
  // Racha
  streak: number;
  lastSyncAt?: string;
}

export interface TeamOverview {
  totalAgents: number;
  weekTotalMeetings: number;
  greenAgents: number;   // semana productiva
  yellowAgents: number;  // ocupado
  redAgents: number;     // riesgo
  topAgent: string | null;
  needsAttention: string | null;
}

export interface PeriodKey {
  type: "week" | "month" | "quarter" | "semester" | "year";
  year: number;
  value: number; // semana, mes, trimestre, semestre
}

// ── Analytics de un agente para el dashboard del broker ──────────────────────
export async function getAgentSummary(email: string): Promise<Omit<AgentSummary, "name" | "avatar" | "teamRole">> {
  const now = new Date();

  // Últimos 30 días
  const from30 = new Date(now); from30.setDate(from30.getDate() - 30);
  // Esta semana (lunes)
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  // Semana anterior
  const prevWeekStart = new Date(weekStart); prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const prevWeekEnd = new Date(weekStart); prevWeekEnd.setMilliseconds(-1);

  const { data: events30 } = await supabaseAdmin
    .from("calendar_events")
    .select("start_at, is_productive")
    .eq("user_email", email)
    .gte("start_at", from30.toISOString())
    .lte("start_at", now.toISOString());

  const all = events30 || [];
  const monthTotal = all.filter(e => e.is_productive).length;

  // Esta semana
  const thisWeek = all.filter(e => new Date(e.start_at) >= weekStart && e.is_productive);
  const weekTotal = thisWeek.length;

  // Días productivos esta semana
  const byDay: Record<string, number> = {};
  thisWeek.forEach(e => {
    const d = e.start_at.slice(0, 10);
    byDay[d] = (byDay[d] || 0) + 1;
  });
  const weekProductiveDays = Object.values(byDay).filter(c => c >= 10).length;

  // Tendencia: esta semana vs semana anterior
  const prevWeek = all.filter(e => {
    const d = new Date(e.start_at);
    return d >= prevWeekStart && d <= prevWeekEnd && e.is_productive;
  });
  const prevTotal = prevWeek.length;

  let trend: "up" | "down" | "stable" = "stable";
  let trendPct = 0;
  if (prevTotal > 0) {
    trendPct = Math.round(((weekTotal - prevTotal) / prevTotal) * 100);
    if (trendPct >= 10) trend = "up";
    else if (trendPct <= -10) trend = "down";
  } else if (weekTotal > 0) {
    trend = "up"; trendPct = 100;
  }

  // IAC: weekTotal / 15 * 100
  const iac = Math.min(100, Math.round((weekTotal / 15) * 100));

  // Semáforo basado en IAC
  let status: "green" | "yellow" | "red" = "red";
  if (iac >= 70) status = "green";
  else if (iac >= 40) status = "yellow";

  // Sparkline: reuniones verdes por día, últimos 7 días corridos
  const sparkByDay: Record<string, number> = {};
  all.forEach(e => {
    if (e.is_productive) {
      const d = e.start_at.slice(0, 10);
      sparkByDay[d] = (sparkByDay[d] || 0) + 1;
    }
  });

  const sparkline: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    sparkline.push(sparkByDay[key] || 0);
  }

  // Streak desde subscriptions
  const { data: subData } = await supabaseAdmin
    .from("subscriptions")
    .select("streak_current")
    .eq("email", email)
    .single();
  const streak = subData?.streak_current || 0;

  return { email, weekTotal, weekProductiveDays, iac, monthTotal, trend, trendPct, status, sparkline, streak };
}

// ── Overview del equipo ───────────────────────────────────────────────────────
export async function getTeamOverview(teamId: string): Promise<TeamOverview> {
  const { data: members } = await supabaseAdmin
    .from("subscriptions")
    .select("email, name")
    .eq("team_id", teamId)
    .in("team_role", ["member", "team_leader"]);

  if (!members?.length) return { totalAgents: 0, weekTotalMeetings: 0, greenAgents: 0, yellowAgents: 0, redAgents: 0, topAgent: null, needsAttention: null };

  const summaries = await Promise.all(members.map(m => getAgentSummary(m.email)));

  const green = summaries.filter(s => s.status === "green");
  const yellow = summaries.filter(s => s.status === "yellow");
  const red = summaries.filter(s => s.status === "red");

  const sorted = [...summaries].sort((a, b) => b.weekTotal - a.weekTotal);
  const topEmail = sorted[0]?.weekTotal > 0 ? sorted[0].email : null;
  const needsEmail = sorted[sorted.length - 1]?.weekTotal < 5 ? sorted[sorted.length - 1].email : null;

  const getName = (email: string) => members.find(m => m.email === email)?.name || email.split("@")[0];

  return {
    totalAgents: members.length,
    weekTotalMeetings: summaries.reduce((s, a) => s + a.weekTotal, 0),
    greenAgents: green.length,
    yellowAgents: yellow.length,
    redAgents: red.length,
    topAgent: topEmail ? getName(topEmail) : null,
    needsAttention: needsEmail ? getName(needsEmail) : null,
  };
}

// ── Analytics por período (Q1-Q4, semestre, año) ──────────────────────────────
export async function getAgentPeriodStats(
  email: string,
  from: Date,
  to: Date
): Promise<PeriodStats> {
  const { data } = await supabaseAdmin
    .from("calendar_events")
    .select("*")
    .eq("user_email", email)
    .eq("is_productive", true)
    .gte("start_at", from.toISOString())
    .lte("start_at", to.toISOString());

  const procesoTypes = new Set(["tasacion", "primera_visita", "fotos_video"]);
  const cierreTypes = new Set(["firma"]);
  const events: SyncedEvent[] = (data || []).map(r => ({
    id: r.google_event_id,
    title: r.title,
    start: r.start_at,
    end: r.end_at,
    type: r.event_type as EventType,
    isGreen: true,
    isProceso: r.is_proceso ?? procesoTypes.has(r.event_type),
    isCierre: r.is_cierre ?? cierreTypes.has(r.event_type),
    isUserColored: r.is_user_colored ?? false,
    durationMinutes: r.duration_minutes ?? 60,
    attendeesCount: r.attendees_count ?? 1,
  }));

  const days = Math.ceil((to.getTime() - from.getTime()) / 86400000);
  return computePeriodStats(events, days);
}

// ── Comparación de trimestres para un agente ──────────────────────────────────
export async function getQuarterComparison(email: string, year: number) {
  const quarters = [1, 2, 3, 4] as const;
  const results = await Promise.all(quarters.map(async q => {
    const starts = [0, 3, 6, 9];
    const from = new Date(year, starts[q - 1], 1);
    const to = new Date(year, starts[q - 1] + 3, 0, 23, 59, 59);
    const days = Math.ceil((to.getTime() - from.getTime()) / 86400000);

    const { data } = await supabaseAdmin
      .from("calendar_events")
      .select("event_type, is_productive, start_at")
      .eq("user_email", email)
      .eq("is_productive", true)
      .gte("start_at", from.toISOString())
      .lte("start_at", to.toISOString());

    const total = data?.length || 0;
    const byType: Record<string, number> = {};
    (data || []).forEach(e => { byType[e.event_type] = (byType[e.event_type] || 0) + 1; });

    return {
      quarter: `Q${q}`,
      total,
      tasaciones: byType.tasacion || 0,
      visitas: byType.visita || 0,
      propuestas: byType.propuesta || 0,
      cierres: byType.cierre || 0,
      avgPerWeek: Math.round((total / Math.max(1, days / 7)) * 10) / 10,
    };
  }));

  return results;
}

// ── Mejor día y hora del agente ───────────────────────────────────────────────
export async function getBestDayAndHour(email: string, days = 90) {
  const from = new Date(); from.setDate(from.getDate() - days);

  const { data } = await supabaseAdmin
    .from("calendar_events")
    .select("day_of_week, hour_of_day")
    .eq("user_email", email)
    .eq("is_productive", true)
    .gte("start_at", from.toISOString());

  if (!data?.length) return { bestDay: null, bestHour: null };

  const dayCount: Record<number, number> = {};
  const hourCount: Record<number, number> = {};
  data.forEach(e => {
    dayCount[e.day_of_week] = (dayCount[e.day_of_week] || 0) + 1;
    hourCount[e.hour_of_day] = (hourCount[e.hour_of_day] || 0) + 1;
  });

  const bestDay = parseInt(Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "1");
  const bestHour = parseInt(Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "10");

  const days_es = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  return {
    bestDay: days_es[bestDay],
    bestHour: `${bestHour}:00`,
  };
}
