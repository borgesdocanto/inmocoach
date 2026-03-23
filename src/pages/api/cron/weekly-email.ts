import { NextApiRequest, NextApiResponse } from "next";
import { Resend } from "resend";
import { subDays, startOfWeek } from "date-fns";
import { getGoals } from "../../../lib/appConfig";

export const config = { maxDuration: 300 };

import { getAllActiveSubscriptions } from "../../../lib/subscription";
import { fetchCalendarEvents, computeWeekStats, PROCESOS_GOAL, EFECTIVIDAD, proyectarOperaciones } from "../../../lib/calendarSync";
import { computeAndSaveStreak } from "../../../lib/streak";
import { saveWeeklyStatsAndRank, getNextRank, getRanksFromDB } from "../../../lib/ranks";
import { generateWeeklyEmailHtml } from "../../../lib/emailTemplate";
import { supabaseAdmin } from "../../../lib/supabase";
import { getValidAccessToken } from "../../../lib/googleToken";
import { FREEMIUM_DAYS } from "../../../lib/brand";
import { getPlanById } from "../../../lib/plans";
import { DEFAULT_COACH_PROMPT } from "../admin/coach-prompt";
import { getAgentTokkoStats, formatTokkoSectionForPrompt } from "../../../lib/tokkoPortfolio";

const resend = new Resend(process.env.RESEND_API_KEY!);

export interface CoachSections {
  carta: string;
  bien: string;
  oportunidades: string;
  acciones: string;
  tokkoTotal?: number;
  tokkoNeedAction?: number;
}

async function generateCoachAdvice(
  stats: ReturnType<typeof computeWeekStats>,
  name: string,
  streak: number,
  weeklyGoal: number,
  userEmail: string
): Promise<CoachSections> {
  const { data: promptRow } = await supabaseAdmin
    .from("app_config").select("value").eq("key", "coach_prompt").single();
  const coachSystemPrompt = promptRow?.value ?? DEFAULT_COACH_PROMPT;

  const firstName = name.split(" ")[0] || "";
  const iac = Math.round((stats.greenTotal / weeklyGoal) * 100);
  const faltanReuniones = Math.max(0, weeklyGoal - stats.greenTotal);
  const faltanProcesos = Math.max(0, PROCESOS_GOAL - (stats.procesosNuevos ?? 0));
  const procesosXSemana = stats.procesosNuevos ?? 0;
  const operacionesProyectadas = proyectarOperaciones(procesosXSemana, 1);

  const tokkoStats = await getAgentTokkoStats(userEmail);
  const tokkoSection = tokkoStats ? formatTokkoSectionForPrompt(tokkoStats) : "";
  const tokkoTotal = tokkoStats?.total;
  const tokkoNeedAction = tokkoStats ? (tokkoStats.incomplete + tokkoStats.stale) : undefined;

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
${streak > 0 ? `- Racha: ${streak} días consecutivos` : "- Sin racha activa"}
- Operaciones proyectadas a 3 meses: ${operacionesProyectadas}
${tokkoSection}

Respondé EXACTAMENTE en este formato JSON, sin texto antes ni después, sin markdown:
{
  "carta": "Párrafo motivador y directo de 3-4 oraciones. Tono de coach. Integrá actividad Y cartera Tokko si hay datos. Vos/tenés/hacés.",
  "bien": "1-2 oraciones sobre lo que hizo bien. Específico con números.",
  "oportunidades": "1-2 oraciones sobre dónde perdió oportunidades. Incluir Tokko si hay problemas.",
  "acciones": "2-3 acciones concretas para esta semana. Al menos una de cartera Tokko si hay problemas. Separadas por | (pipe)."
}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 600, messages: [{ role: "user", content: prompt }] }),
    });
    const d = await res.json();
    const text = d.content?.map((b: any) => b.text || "").join("") || "";
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    return {
      carta: parsed.carta || "",
      bien: parsed.bien || "",
      oportunidades: parsed.oportunidades || "",
      acciones: parsed.acciones || "",
      tokkoTotal,
      tokkoNeedAction,
    };
  } catch {
    return {
      carta: `${firstName}, esta semana lograste ${stats.greenTotal} reuniones cara a cara — IAC ${iac}%. Seguí sumando días productivos y revisá el estado de tus fichas en Tokko.`,
      bien: `Lograste ${stats.greenTotal} reuniones cara a cara y ${procesosXSemana} procesos nuevos esta semana.`,
      oportunidades: faltanReuniones > 0 ? `Te faltan ${faltanReuniones} reuniones para llegar al objetivo semanal de ${weeklyGoal}.` : "Llegaste al objetivo de reuniones esta semana.",
      acciones: `Agendá ${Math.min(faltanReuniones || 3, 5)} reuniones cara a cara antes del jueves | Revisá tus fichas en Tokko | Contactá ${Math.max(1, faltanProcesos)} prospectos nuevos`,
      tokkoTotal,
      tokkoNeedAction,
    };
  }
}

async function processUser(sub: any): Promise<"sent" | "failed" | "skipped"> {
  try {
    const accessToken = await getValidAccessToken(sub.email);
    if (!accessToken) { console.log(`⚠️  Sin token para ${sub.email}`); return "skipped"; }

    const { data: subData } = await supabaseAdmin.from("subscriptions").select("created_at, plan").eq("email", sub.email).single();
    const events = await fetchCalendarEvents(accessToken, 90);
    const { weeklyGoal, productiveDayMin } = await getGoals();
    // El mail del lunes reporta la semana ANTERIOR (lun-dom pasados)
    const lastSunday = subDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 1);
    const stats = computeWeekStats(events, productiveDayMin, lastSunday);

    const dailySummaries = Object.entries(
      events.filter(e => e.isGreen).reduce((acc: Record<string, number>, e) => {
        const day = e.start.slice(0, 10); acc[day] = (acc[day] || 0) + 1; return acc;
      }, {})
    ).map(([date, greenCount]) => ({ date, greenCount }));

    const streakData = await computeAndSaveStreak(sub.email, dailySummaries);

    const weekStart = getMonday();
    const rank = await saveWeeklyStatsAndRank(sub.email, weekStart, Math.round((stats.greenTotal / weeklyGoal) * 100), stats.greenTotal, streakData.best);

    const { data: weekHistory } = await supabaseAdmin.from("weekly_stats").select("iac").eq("email", sub.email).gt("iac", 0).order("week_start", { ascending: false }).limit(12);
    const activeWeeks = weekHistory?.length ?? 0;
    const iacAvg = activeWeeks > 0 ? Math.round(weekHistory!.reduce((s: number, w: any) => s + w.iac, 0) / activeWeeks) : 0;

    const coachSections = await generateCoachAdvice(stats, sub.name || sub.email, streakData.current, weeklyGoal, sub.email);

    const createdAt = new Date(subData?.created_at ?? Date.now());
    const daysUsed = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const daysLeft = Math.max(0, Math.ceil(FREEMIUM_DAYS - daysUsed));
    const plan = getPlanById(sub.plan);
    const dbRanks = await getRanksFromDB();
    const nextRank = getNextRank(rank.slug, dbRanks);

    const html = generateWeeklyEmailHtml({
      userName: sub.name || sub.email, email: sub.email, weekDates: stats.weekDates,
      weekStart: lastSunday.toISOString().slice(0, 10),
      greenTotal: stats.greenTotal, tasaciones: stats.tasaciones, visitas: stats.visitas,
      propuestas: stats.propuestas, productiveDays: stats.productiveDays, totalDays: stats.totalDays,
      productivityRate: stats.productivityRate, coachAdvice: coachSections.carta, coachBien: coachSections.bien, coachOportunidades: coachSections.oportunidades, coachAcciones: coachSections.acciones, tokkoTotal: coachSections.tokkoTotal, tokkoNeedAction: coachSections.tokkoNeedAction, planName: plan.name,
      isExpiringSoon: (subData?.plan || "free") === "free" && daysLeft <= 2, daysLeft,
      streak: streakData.current, rankSlug: rank.slug, rankLabel: rank.label, rankIcon: rank.icon,
      nextRankLabel: nextRank?.label, nextRankMinWeeks: nextRank?.minWeeks, nextRankMinIac: (nextRank as any)?.minIacUp ?? (nextRank as any)?.minIacAvg,
      activeWeeks, iacAvg,
    });

    const { data: sendData, error: sendError } = await resend.emails.send({
      from: "InmoCoach <coach@inmocoach.com.ar>", to: sub.email,
      subject: `Tu semana · IAC ${Math.round((stats.greenTotal / weeklyGoal) * 100)}% · ${stats.weekDates}`,
      html,
    });

    if (sendError) { console.error(`❌ Resend error ${sub.email}:`, JSON.stringify(sendError)); return "failed"; }
    console.log(`✅ ${sub.email} — id: ${sendData?.id}`);
    return "sent";

  } catch (err: any) {
    console.error(`❌ Error ${sub.email}:`, err?.message);
    return "failed";
  }
}

async function processBatch(items: any[]): Promise<{ sent: number; failed: number; skipped: number }> {
  const results = { sent: 0, failed: 0, skipped: 0 };
  for (let i = 0; i < items.length; i++) {
    console.log(`🔄 Usuario ${i + 1}/${items.length}: ${items[i].email}`);
    const result = await processUser(items[i]);
    results[result]++;
    // 600ms entre mails — respeta el límite de 2 req/seg de Resend
    if (i < items.length - 1) await new Promise(r => setTimeout(r, 600));
  }
  return results;
}

function getMonday(): string {
  const d = new Date(); const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(new Date().setDate(diff)).toISOString().slice(0, 10);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isVercel = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  const isManual = req.headers["x-cron-secret"] === process.env.CRON_SECRET;
  if (!isVercel && !isManual) return res.status(401).json({ error: "No autorizado" });

  const { targetEmail } = req.body || {};
  let subscriptions = await getAllActiveSubscriptions();
  if (targetEmail) subscriptions = subscriptions.filter((s: any) => s.email === targetEmail);

  const total = subscriptions.length;
  console.log(`📋 ${total} usuarios`);

  // Procesar primero, luego responder
  const results = await processBatch(subscriptions);
  console.log(`\n📊 Final: ${results.sent} enviados, ${results.failed} errores, ${results.skipped} sin token`);
  res.status(200).json({ ok: true, total, ...results });
}
