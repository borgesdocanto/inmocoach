import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { isSuperAdmin } from "../../../lib/adminGuard";
import { getGoals } from "../../../lib/appConfig";
import { fetchCalendarEvents, computeWeekStats, PROCESOS_GOAL, EFECTIVIDAD, proyectarOperaciones } from "../../../lib/calendarSync";
import { computeAndSaveStreak } from "../../../lib/streak";
import { saveWeeklyStatsAndRank, getNextRank, getRanksFromDB } from "../../../lib/ranks";
import { supabaseAdmin } from "../../../lib/supabase";
import { getValidAccessToken } from "../../../lib/googleToken";
import { DEFAULT_COACH_PROMPT } from "../admin/coach-prompt";
import { getAgentTokkoStats, formatTokkoSectionForPrompt } from "../../../lib/tokkoPortfolio";
import { generateWeeklyEmailHtml } from "../../../lib/emailTemplate";
import { getPlanById } from "../../../lib/plans";
import { subDays, startOfWeek } from "date-fns";
import { FREEMIUM_DAYS } from "../../../lib/brand";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email || !isSuperAdmin(session.user.email)) return res.status(403).end();

  const targetEmail = (req.query.email as string) || session.user.email;

  // Load user data
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("email, name, plan, created_at")
    .eq("email", targetEmail)
    .single();

  if (!sub) return res.status(404).json({ error: "Usuario no encontrado" });

  const accessToken = await getValidAccessToken(sub.email);
  if (!accessToken) return res.status(400).json({ error: "Sin token de calendario" });

  const { weeklyGoal, productiveDayMin } = await getGoals();
  const events = await fetchCalendarEvents(accessToken, 90);

  // Use last week (same as the cron)
  const lastSunday = subDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 1);
  const stats = computeWeekStats(events, productiveDayMin, lastSunday);

  const dailySummaries = Object.entries(
    events.filter(e => e.isGreen).reduce((acc: Record<string, number>, e) => {
      const day = e.start.slice(0, 10); acc[day] = (acc[day] || 0) + 1; return acc;
    }, {})
  ).map(([date, greenCount]) => ({ date, greenCount }));

  const streakData = await computeAndSaveStreak(sub.email, dailySummaries);
  const weekStart = new Date(); const day = weekStart.getDay();
  const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
  const weekStartStr = new Date(new Date().setDate(diff)).toISOString().slice(0, 10);
  const rank = await saveWeeklyStatsAndRank(sub.email, weekStartStr, Math.round((stats.greenTotal / weeklyGoal) * 100), stats.greenTotal, streakData.best);

  const { data: weekHistory } = await supabaseAdmin.from("weekly_stats").select("iac").eq("email", sub.email).gt("iac", 0).order("week_start", { ascending: false }).limit(12);
  const activeWeeks = weekHistory?.length ?? 0;
  const iacAvg = activeWeeks > 0 ? Math.round(weekHistory!.reduce((s: number, w: any) => s + w.iac, 0) / activeWeeks) : 0;

  // Tokko live data
  const tokkoStats = await getAgentTokkoStats(sub.email);
  const tokkoSection = tokkoStats ? formatTokkoSectionForPrompt(tokkoStats) : "";

  // Build prompt
  const { data: promptRow } = await supabaseAdmin.from("app_config").select("value").eq("key", "coach_prompt").single();
  const coachSystemPrompt = promptRow?.value ?? DEFAULT_COACH_PROMPT;
  const firstName = (sub.name || sub.email).split(" ")[0];
  const iac = Math.round((stats.greenTotal / weeklyGoal) * 100);
  const faltanReuniones = Math.max(0, weeklyGoal - stats.greenTotal);
  const faltanProcesos = Math.max(0, PROCESOS_GOAL - (stats.procesosNuevos ?? 0));
  const procesosXSemana = stats.procesosNuevos ?? 0;
  const operacionesProyectadas = proyectarOperaciones(procesosXSemana, 1);

  const prompt = `${coachSystemPrompt}

El nombre del agente es ${firstName}.

LAS VARIABLES QUE MIDEN EL NEGOCIO:
1. IAC = reuniones cara a cara / ${weeklyGoal} por semana
2. Procesos nuevos: objetivo ${PROCESOS_GOAL} por semana
3. Calidad de cartera Tokko: fichas completas y actualizadas generan más consultas
LÓGICA: Efectividad ${EFECTIVIDAD * 100}% — 6 procesos = 1 transacción

PERÍODO: semana de ${stats.weekDates}
MÉTRICAS DE ACTIVIDAD:
- Reuniones cara a cara: ${stats.greenTotal} de ${weeklyGoal} — IAC ${iac}%${faltanReuniones > 0 ? ` (faltan ${faltanReuniones})` : " ✓"}
- Procesos nuevos: ${procesosXSemana} de ${PROCESOS_GOAL}${faltanProcesos > 0 ? ` (faltan ${faltanProcesos})` : " ✓"}
  · Tasaciones: ${stats.tasaciones} | Visitas: ${stats.visitas} | Propuestas: ${stats.propuestas}
- Días productivos: ${stats.productiveDays} de ${stats.totalDays}
${streakData.current > 0 ? `- Racha: ${streakData.current} días consecutivos` : "- Sin racha activa"}
- Operaciones proyectadas a 3 meses: ${operacionesProyectadas}
${tokkoSection}

Respondé EXACTAMENTE en este formato JSON, sin texto antes ni después, sin markdown:
{
  "carta": "Párrafo motivador y directo de 3-4 oraciones. Tono de coach. Integrá actividad Y cartera Tokko si hay datos. Vos/tenés/hacés.",
  "bien": "1-2 oraciones sobre lo que hizo bien. Específico con números.",
  "oportunidades": "1-2 oraciones sobre dónde perdió oportunidades. Incluir Tokko si hay problemas.",
  "acciones": "2-3 acciones concretas para esta semana. Al menos una de cartera Tokko si hay problemas. Separadas por | (pipe)."
}`;

  // Call AI
  const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 600, messages: [{ role: "user", content: prompt }] }),
  });
  const aiData = await aiRes.json();
  const text = aiData.content?.map((b: any) => b.text || "").join("") || "";

  let sections = { carta: "", bien: "", oportunidades: "", acciones: "" };
  try { sections = JSON.parse(text.replace(/```json|```/g, "").trim()); } catch { sections.carta = text; }

  // If ?format=html, return rendered email
  if (req.query.format === "html") {
    const createdAt = new Date(sub.created_at ?? Date.now());
    const daysUsed = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const daysLeft = Math.max(0, Math.ceil(FREEMIUM_DAYS - daysUsed));
    const plan = getPlanById(sub.plan);
    const dbRanks = await getRanksFromDB();
    const nextRank = getNextRank(rank.slug, dbRanks);

    const html = generateWeeklyEmailHtml({
      userName: sub.name || sub.email, email: sub.email,
      weekDates: stats.weekDates, weekStart: lastSunday.toISOString().slice(0, 10),
      greenTotal: stats.greenTotal, tasaciones: stats.tasaciones,
      visitas: stats.visitas, propuestas: stats.propuestas,
      productiveDays: stats.productiveDays, totalDays: stats.totalDays,
      productivityRate: stats.productivityRate,
      coachAdvice: sections.carta,
      coachBien: sections.bien,
      coachOportunidades: sections.oportunidades,
      coachAcciones: sections.acciones,
      planName: plan.name,
      isExpiringSoon: (sub.plan || "free") === "free" && daysLeft <= 2, daysLeft,
      streak: streakData.current, rankSlug: rank.slug, rankLabel: rank.label, rankIcon: rank.icon,
      nextRankLabel: nextRank?.label, nextRankMinWeeks: nextRank?.minWeeks,
      nextRankMinIac: (nextRank as any)?.minIacUp ?? (nextRank as any)?.minIacAvg,
      activeWeeks, iacAvg,
    });
    res.setHeader("Content-Type", "text/html");
    return res.status(200).send(html);
  }

  // Default: return JSON with all data
  return res.status(200).json({
    email: sub.email, name: sub.name, weekDates: stats.weekDates,
    metrics: {
      iac, greenTotal: stats.greenTotal, weeklyGoal,
      procesosNuevos: procesosXSemana, tasaciones: stats.tasaciones,
      visitas: stats.visitas, propuestas: stats.propuestas,
      productiveDays: stats.productiveDays, totalDays: stats.totalDays,
      streak: streakData.current,
    },
    tokko: tokkoStats,
    sections,
    prompt_sent: prompt,
  });
}
