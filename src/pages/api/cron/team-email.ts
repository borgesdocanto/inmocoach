// /api/cron/team-email — Resumen semanal para brokers y team leaders
// Se ejecuta los lunes junto con el weekly-email, después del envío de agentes
import { NextApiRequest, NextApiResponse } from "next";
import { Resend } from "resend";
import { subDays, startOfWeek, format } from "date-fns";
import { es } from "date-fns/locale";
import { supabaseAdmin } from "../../../lib/supabase";
import { getStoredEvents, calcIAC, PROCESOS_GOAL } from "../../../lib/calendarSync";
import { getGoals } from "../../../lib/appConfig";
import { getAgentTokkoStats } from "../../../lib/tokkoPortfolio";
import { generateTeamEmailHtml } from "../../../lib/teamEmailTemplate";
import { FREEMIUM_DAYS } from "../../../lib/brand";

export const config = { maxDuration: 300 };

const resend = new Resend(process.env.RESEND_API_KEY!);

const DEFAULT_PREFS = {
  recv_agent: true,
  recv_team: true,
  include_self_activity: true,
  include_self_tokko: true,
};

function getLastWeekRange() {
  const lastSunday = subDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 1);
  const lastMonday = subDays(lastSunday, 6);
  const from = new Date(lastMonday); from.setHours(0, 0, 0, 0);
  const to = new Date(lastSunday); to.setHours(23, 59, 59, 999);
  const weekDates = `${format(lastMonday, "d MMM", { locale: es })} – ${format(lastSunday, "d MMM yyyy", { locale: es })}`;
  return { from, to, weekDates };
}

async function getAgentWeekStats(email: string, from: Date, to: Date, weeklyGoal: number, teamId: string) {
  try {
    const events = await getStoredEvents(email, from, to);
    const greenEvents = events.filter(e => e.isGreen);
    const greenTotal = greenEvents.length;

    const byDay: Record<string, number> = {};
    greenEvents.forEach(e => {
      const day = e.start.slice(0, 10);
      byDay[day] = (byDay[day] || 0) + 1;
    });

    const { productiveDayMin } = await getGoals(teamId);
    const allDays = new Set(events.map(e => e.start.slice(0, 10)));
    const productiveDays = Object.values(byDay).filter(c => c >= productiveDayMin).length;
    const totalDays = allDays.size;

    const semanas = 1;
    const avgPorSemana = greenTotal / semanas;
    const iac = Math.min(100, Math.round(calcIAC(avgPorSemana, weeklyGoal)));

    return { greenTotal, productiveDays, totalDays, iac };
  } catch {
    return { greenTotal: 0, productiveDays: 0, totalDays: 0, iac: 0 };
  }
}

async function processTeamOwner(ownerEmail: string, teamId: string) {
  try {
    // Preferencias del broker/teamleader
    const { data: ownerSub } = await supabaseAdmin
      .from("subscriptions")
      .select("name, mail_prefs, team_role")
      .eq("email", ownerEmail)
      .single();

    const prefs = { ...DEFAULT_PREFS, ...(ownerSub?.mail_prefs || {}) };
    if (!prefs.recv_team) {
      console.log(`⏭ ${ownerEmail} — recv_team=false, skipping`);
      return "skipped";
    }

    const { weeklyGoal } = await getGoals(teamId);
    const { from, to, weekDates } = getLastWeekRange();

    // Obtener todos los miembros del equipo
    const { data: members } = await supabaseAdmin
      .from("subscriptions")
      .select("email, name, team_role, mail_prefs")
      .eq("team_id", teamId);

    if (!members?.length) return "skipped";

    // Construir datos de cada agente
    const agentRows = await Promise.all(members.map(async (m) => {
      const isSelf = m.email === ownerEmail;
      const weekStats = await getAgentWeekStats(m.email, from, to, weeklyGoal, teamId);
      const tokkoStats = await getAgentTokkoStats(m.email).catch(() => null);
      return {
        name: m.name || m.email.split("@")[0],
        email: m.email,
        role: m.team_role || "member",
        iac: weekStats.iac,
        greenTotal: weekStats.greenTotal,
        productiveDays: weekStats.productiveDays,
        totalDays: weekStats.totalDays,
        tokkoTotal: tokkoStats?.total,
        tokkoIncomplete: tokkoStats?.incomplete,
        tokkoStale: tokkoStats?.stale,
        isSelf,
      };
    }));

    // Ordenar: primero los de bajo IAC
    agentRows.sort((a, b) => {
      if (a.isSelf) return -1;
      if (b.isSelf) return 1;
      return a.iac - b.iac;
    });

    const html = generateTeamEmailHtml({
      recipientName: ownerSub?.name || ownerEmail.split("@")[0],
      recipientEmail: ownerEmail,
      recipientRole: ownerSub?.team_role || "owner",
      weekDates,
      agents: agentRows,
      includeSelfActivity: prefs.include_self_activity,
      includeSelfTokko: prefs.include_self_tokko,
      weeklyGoal,
    });

    const lowCount = agentRows.filter(a => !a.isSelf && a.iac < 40).length;
    const subjectAlert = lowCount > 0 ? ` · 🔴 ${lowCount} agente${lowCount > 1 ? "s" : ""} inactivo${lowCount > 1 ? "s" : ""}` : "";

    const { error } = await resend.emails.send({
      from: "InmoCoach <coach@inmocoach.com.ar>",
      to: ownerEmail,
      subject: `Resumen de equipo · ${weekDates}${subjectAlert}`,
      html,
    });

    if (error) { console.error(`❌ Team email error ${ownerEmail}:`, JSON.stringify(error)); return "failed"; }
    console.log(`✅ Team email enviado: ${ownerEmail}`);
    return "sent";

  } catch (err: any) {
    console.error(`❌ Error ${ownerEmail}:`, err?.message);
    return "failed";
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Auth: CRON_SECRET (Vercel) O token externo (GitHub Actions via app_config)
  const authHeader = req.headers.authorization ?? "";
  const cronSecret = process.env.CRON_SECRET;
  let authorized = authHeader === `Bearer ${cronSecret}` || req.headers["x-cron-secret"] === cronSecret || req.query.secret === cronSecret;
  if (!authorized && authHeader.startsWith("Bearer ")) {
    const candidate = authHeader.slice(7);
    const { data: tokenRow } = await supabaseAdmin
      .from("app_config").select("value").eq("key", "systeme_cron_token")
      .is("team_id", null).maybeSingle();
    authorized = !!tokenRow?.value && tokenRow.value === candidate;
  }
  if (!authorized) return res.status(401).json({ error: "No autorizado" });

  const { targetEmail } = req.body || {};

  // Obtener brokers y team leaders activos (no freemium expirado)
  let query = supabaseAdmin
    .from("subscriptions")
    .select("email, team_id, team_role, plan, created_at")
    .in("team_role", ["owner", "team_leader"])
    .not("team_id", "is", null)
    .eq("status", "active");

  if (targetEmail) {
    query = query.eq("email", targetEmail) as any;
  }

  const { data: leadersRaw } = await query;

  // Filtrar freemium expirados
  const nowMs = Date.now();
  const leaders = (leadersRaw || []).filter(l => {
    if (l.plan && l.plan !== "free") return true;
    const diffDays = (nowMs - new Date(l.created_at || 0).getTime()) / (1000 * 60 * 60 * 24);
    const ends = (l as any).trial_ends_at;
    return ends ? Date.now() <= new Date(ends).getTime() : diffDays <= FREEMIUM_DAYS;
  });
  if (!leaders?.length) return res.status(200).json({ ok: true, sent: 0, skipped: 0, failed: 0 });

  console.log(`📋 ${leaders.length} brokers/teamleaders a procesar`);

  const results = { sent: 0, failed: 0, skipped: 0 };
  for (let i = 0; i < leaders.length; i++) {
    const l = leaders[i];
    console.log(`🔄 ${i + 1}/${leaders.length}: ${l.email}`);
    const r = await processTeamOwner(l.email, l.team_id);
    results[r as keyof typeof results]++;
    if (i < leaders.length - 1) await new Promise(r => setTimeout(r, 600));
  }

  console.log(`📊 Final: ${results.sent} enviados, ${results.failed} errores, ${results.skipped} sin preferencia`);
  res.status(200).json({ ok: true, total: leaders.length, ...results });
}
