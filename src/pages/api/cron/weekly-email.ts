import { NextApiRequest, NextApiResponse } from "next";
import { Resend } from "resend";
import { getAllActiveSubscriptions } from "../../../lib/subscription";
import { fetchCalendarEvents, computeWeekStats } from "../../../lib/calendarSync";
import { computeAndSaveStreak } from "../../../lib/streak";
import { saveWeeklyStatsAndRank, getNextRank } from "../../../lib/ranks";
import { generateWeeklyEmailHtml } from "../../../lib/emailTemplate";
import { supabaseAdmin } from "../../../lib/supabase";
import { getValidAccessToken } from "../../../lib/googleToken";
import { FREEMIUM_DAYS, PRODUCTIVITY_GOAL, IAC_WEEKLY_GOAL } from "../../../lib/brand";
import { getPlanById } from "../../../lib/plans";

const resend = new Resend(process.env.RESEND_API_KEY!);
const BATCH_SIZE = 5;

async function generateCoachAdvice(stats: ReturnType<typeof computeWeekStats>, name: string, streak: number): Promise<string> {
  const prompt = `Sos Inmo Coach, un coach de ventas inmobiliarias argentino, directo, motivador y sin vueltas.

Analizá esta semana de ${name} y escribí un consejo de 3-4 oraciones. Sin listas, solo párrafos. Usá segunda persona, hablale de vos a vos.

SEMANA:
- Reuniones cara a cara: ${stats.greenTotal} de 15 (meta semanal)
- IAC: ${Math.round((stats.greenTotal / IAC_WEEKLY_GOAL) * 100)}%
- Tasaciones: ${stats.tasaciones} · Visitas: ${stats.visitas} · Propuestas: ${stats.propuestas}
- Días productivos: ${stats.productiveDays} de ${stats.totalDays}
${streak > 0 ? `- Racha: ${streak} días consecutivos` : "- Sin racha activa"}

Si estuvo bien, celebralo. Si estuvo flojo, decíselo sin rodeos y dále UNA acción concreta para la semana que viene.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 250, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await res.json();
    return data.content?.map((b: any) => b.text || "").join("") || "Arrancá el lunes con 3 reuniones cara a cara por día y vas a sentir la diferencia.";
  } catch {
    return "Arrancá el lunes con 3 reuniones cara a cara por día y vas a sentir la diferencia.";
  }
}

async function processUser(sub: any): Promise<"sent" | "failed" | "skipped"> {
  try {
    const accessToken = await getValidAccessToken(sub.email);
    if (!accessToken) { console.log(`⚠️  Sin token para ${sub.email}`); return "skipped"; }

    const { data: subData } = await supabaseAdmin.from("subscriptions").select("created_at, plan").eq("email", sub.email).single();
    const events = await fetchCalendarEvents(accessToken, 90);
    const stats = computeWeekStats(events, PRODUCTIVITY_GOAL);

    const dailySummaries = Object.entries(
      events.filter(e => e.isGreen).reduce((acc: Record<string, number>, e) => {
        const day = e.start.slice(0, 10); acc[day] = (acc[day] || 0) + 1; return acc;
      }, {})
    ).map(([date, greenCount]) => ({ date, greenCount }));

    const streakData = await computeAndSaveStreak(sub.email, dailySummaries);

    const weekStart = getMonday();
    const rank = await saveWeeklyStatsAndRank(sub.email, weekStart, Math.round((stats.greenTotal / IAC_WEEKLY_GOAL) * 100), stats.greenTotal, streakData.best);

    const { data: weekHistory } = await supabaseAdmin.from("weekly_stats").select("iac").eq("email", sub.email).gt("iac", 0).order("week_start", { ascending: false }).limit(12);
    const activeWeeks = weekHistory?.length ?? 0;
    const iacAvg = activeWeeks > 0 ? Math.round(weekHistory!.reduce((s: number, w: any) => s + w.iac, 0) / activeWeeks) : 0;

    const coachAdvice = await generateCoachAdvice(stats, sub.name || sub.email, streakData.current);

    const createdAt = new Date(subData?.created_at ?? Date.now());
    const daysUsed = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const daysLeft = Math.max(0, Math.ceil(FREEMIUM_DAYS - daysUsed));
    const plan = getPlanById(sub.plan);
    const nextRank = getNextRank(rank.slug);

    const html = generateWeeklyEmailHtml({
      userName: sub.name || sub.email, email: sub.email, weekDates: stats.weekDates,
      greenTotal: stats.greenTotal, tasaciones: stats.tasaciones, visitas: stats.visitas,
      propuestas: stats.propuestas, productiveDays: stats.productiveDays, totalDays: stats.totalDays,
      productivityRate: stats.productivityRate, coachAdvice, planName: plan.name,
      isExpiringSoon: (subData?.plan || "free") === "free" && daysLeft <= 2, daysLeft,
      streak: streakData.current, rankSlug: rank.slug, rankLabel: rank.label, rankIcon: rank.icon,
      nextRankLabel: nextRank?.label, nextRankMinWeeks: nextRank?.minWeeks, nextRankMinIac: nextRank?.minIacAvg,
      activeWeeks, iacAvg,
    });

    const { data: sendData, error: sendError } = await resend.emails.send({
      from: "InmoCoach <coach@inmocoach.com.ar>", to: sub.email,
      subject: `Tu semana · IAC ${Math.round((stats.greenTotal / IAC_WEEKLY_GOAL) * 100)}% · ${stats.weekDates}`,
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

async function processBatch(items: any[], batchSize: number): Promise<{ sent: number; failed: number; skipped: number }> {
  const results = { sent: 0, failed: 0, skipped: 0 };
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    console.log(`🔄 Tanda ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)} (${batch.length} usuarios)`);
    const batchResults = await Promise.allSettled(batch.map(processUser));
    for (const r of batchResults) {
      if (r.status === "fulfilled") results[r.value]++;
      else results.failed++;
    }
    // Pausa entre tandas para no saturar Google y Anthropic
    if (i + batchSize < items.length) await new Promise(r => setTimeout(r, 2000));
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
  console.log(`📋 ${total} usuarios — tandas de ${BATCH_SIZE}`);

  // Responder inmediatamente — Vercel no corta
  res.status(200).json({ ok: true, total, message: `Procesando ${total} usuarios en ${Math.ceil(total / BATCH_SIZE)} tandas` });

  // Procesar en background después de responder
  const results = await processBatch(subscriptions, BATCH_SIZE);
  console.log(`\n📊 Final: ${results.sent} enviados, ${results.failed} errores, ${results.skipped} sin token`);
}
