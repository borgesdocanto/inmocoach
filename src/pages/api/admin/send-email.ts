import { NextApiRequest, NextApiResponse } from "next";
import { isSuperAdmin } from "../../../lib/adminGuard";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { Resend } from "resend";
import { generateWelcomeEmailHtml, generateWeeklyEmailHtml } from "../../../lib/emailTemplate";
import { generateTeamEmailHtml } from "../../../lib/teamEmailTemplate";
import { getStoredEvents, calcIAC } from "../../../lib/calendarSync";
import { getAgentTokkoStats } from "../../../lib/tokkoPortfolio";
import { subDays, startOfWeek, format } from "date-fns";
import { es } from "date-fns/locale";
import { fetchCalendarEvents, computeWeekStats } from "../../../lib/calendarSync";
import { getGoals } from "../../../lib/appConfig";
import { getValidAccessToken } from "../../../lib/googleToken";
import { getPlanById } from "../../../lib/plans";
import { FREEMIUM_DAYS } from "../../../lib/brand";
import { computeAndSaveStreak } from "../../../lib/streak";
const resend = new Resend(process.env.RESEND_API_KEY!);

async function generateCoachAdvice(stats: ReturnType<typeof computeWeekStats>, name: string, streak: number, weeklyGoal: number): Promise<string> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-5", max_tokens: 300,
        messages: [{ role: "user", content: `Sos Inmo Coach, coach inmobiliario argentino, directo y motivador. Escribí un consejo de 3-4 oraciones para ${name}. Sin listas. Usá segunda persona (vos).

SEMANA:
- Reuniones cara a cara: ${stats.greenTotal} de ${weeklyGoal} (meta semanal)
- IAC: ${Math.round((stats.greenTotal / weeklyGoal) * 100)}%
- Tasaciones: ${stats.tasaciones} | Visitas: ${stats.visitas} | Propuestas: ${stats.propuestas}
- Días productivos: ${stats.productiveDays} de ${stats.totalDays}
${streak > 0 ? `- Racha activa: ${streak} días` : "- Sin racha activa"}

Siempre hablá de ${weeklyGoal} reuniones semanales o ${Math.round(weeklyGoal/5)} por día.` }]
      }),
    });
    const data = await res.json();
    return data.content?.map((b: any) => b.text || "").join("") || "";
  } catch {
    return "Cada reunión cara a cara que agendás te acerca a tu próxima operación. Arrancá la semana con 3 reuniones el lunes y no pares.";
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!isSuperAdmin(session?.user?.email)) return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "POST") return res.status(405).end();

  const { template, recipients } = req.body;
  // recipients: "all" | string[] (array of emails)
  if (!template || !recipients) return res.status(400).json({ error: "template y recipients requeridos" });

  // Resolver lista de emails
  let emails: { email: string; name?: string }[] = [];
  if (recipients === "all") {
    const { data } = await supabaseAdmin
      .from("subscriptions")
      .select("email, name")
      .eq("status", "active");
    emails = data || [];
  } else if (Array.isArray(recipients)) {
    emails = recipients.map((e: string) => ({ email: e }));
  } else {
    emails = [{ email: recipients }];
  }

  const results = { sent: 0, failed: 0, errors: [] as string[] };

  for (const { email, name } of emails) {
    try {
      let subject = "";
      let html = "";

      if (template === "welcome") {
        subject = `Bienvenido a InmoCoach, ${(name || email).split(" ")[0]} — tu primer objetivo es claro`;
        html = generateWelcomeEmailHtml(name || email);

      } else if (template === "weekly") {
        const accessToken = await getValidAccessToken(email);
        if (!accessToken) { results.failed++; results.errors.push(`${email}: sin token`); continue; }

        const events = await fetchCalendarEvents(accessToken, 90);
        const { weeklyGoal, productiveDayMin } = await getGoals();
        const stats = computeWeekStats(events, productiveDayMin);
        const dailySummaries = Object.entries(
          events.filter(e => e.isGreen).reduce((acc: Record<string, number>, e) => {
            const day = e.start.slice(0, 10);
            acc[day] = (acc[day] || 0) + 1;
            return acc;
          }, {})
        ).map(([date, greenCount]) => ({ date, greenCount }));
        const streakData = await computeAndSaveStreak(email, dailySummaries);
        const coachAdvice = await generateCoachAdvice(stats, name || email, streakData.current, weeklyGoal);

        const { data: subData } = await supabaseAdmin
          .from("subscriptions").select("plan, created_at").eq("email", email).single();
        const createdAt = new Date(subData?.created_at ?? Date.now());
        const daysUsed = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        const daysLeft = Math.max(0, Math.ceil(FREEMIUM_DAYS - daysUsed));
        const plan = getPlanById(subData?.plan || "free");

        subject = `Tu semana en números: ${stats.productivityRate}% productividad — ${stats.weekDates}`;
        html = generateWeeklyEmailHtml({
          userName: name || email, email,
          weekDates: stats.weekDates,
          greenTotal: stats.greenTotal, tasaciones: stats.tasaciones,
          visitas: stats.visitas, propuestas: stats.propuestas,
          productiveDays: stats.productiveDays, totalDays: stats.totalDays,
          productivityRate: stats.productivityRate, coachAdvice,
          planName: plan.name,
          isExpiringSoon: (subData?.plan || "free") === "free" && daysLeft <= 2,
          daysLeft, streak: streakData.current,
        });
      } else if (template === "team") {
        // Resumen de equipo — solo para owners y team_leaders
        const { data: ownerSub } = await supabaseAdmin
          .from("subscriptions")
          .select("team_id, team_role, name, mail_prefs")
          .eq("email", email)
          .single();

        if (!ownerSub?.team_id || !["owner", "team_leader"].includes(ownerSub.team_role || "")) {
          results.failed++;
          results.errors.push(`${email}: no es broker ni team leader`);
          continue;
        }

        const { weeklyGoal } = await getGoals();
        const now = new Date();
        const lastSunday = subDays(startOfWeek(now, { weekStartsOn: 1 }), 1);
        const lastMonday = subDays(lastSunday, 6);
        const from = new Date(lastMonday); from.setHours(0, 0, 0, 0);
        const to = new Date(lastSunday); to.setHours(23, 59, 59, 999);
        const weekDates = `${format(lastMonday, "d MMM", { locale: es })} - ${format(lastSunday, "d MMM yyyy", { locale: es })}`;

        // Traer todos los miembros del equipo
        const { data: members } = await supabaseAdmin
          .from("subscriptions")
          .select("email, name, team_role")
          .eq("team_id", ownerSub.team_id);

        if (!members?.length) {
          results.failed++;
          results.errors.push(`${email}: equipo sin miembros`);
          continue;
        }

        // Stats de cada miembro
        const agentRows = await Promise.all(members.map(async (m) => {
          const isSelf = m.email === email;
          try {
            const events = await getStoredEvents(m.email, from, to);
            const greenEvents = events.filter((e: any) => e.isGreen);
            const greenTotal = greenEvents.length;
            const byDay: Record<string, number> = {};
            greenEvents.forEach((e: any) => {
              const day = e.start.slice(0, 10);
              byDay[day] = (byDay[day] || 0) + 1;
            });
            const productiveDays = Object.values(byDay).filter(c => c >= 2).length;
            const totalDays = new Set(events.map((e: any) => e.start.slice(0, 10))).size;
            const avgPerWeek = greenTotal;
            const iac = Math.min(100, Math.round(calcIAC(avgPerWeek, weeklyGoal)));
            const tokkoStats = await getAgentTokkoStats(m.email).catch(() => null);
            return {
              name: m.name || m.email.split("@")[0],
              email: m.email,
              role: m.team_role || "member",
              iac, greenTotal, productiveDays, totalDays,
              tokkoTotal: tokkoStats?.total,
              tokkoIncomplete: tokkoStats?.incomplete,
              tokkoStale: tokkoStats?.stale,
              isSelf,
            };
          } catch {
            return {
              name: m.name || m.email.split("@")[0],
              email: m.email, role: m.team_role || "member",
              iac: 0, greenTotal: 0, productiveDays: 0, totalDays: 0, isSelf,
            };
          }
        }));

        // Ordenar: self primero, luego por IAC asc
        agentRows.sort((a, b) => {
          if (a.isSelf) return -1;
          if (b.isSelf) return 1;
          return a.iac - b.iac;
        });

        const DEFAULT_PREFS = { recv_agent: true, recv_team: true, include_self_activity: true, include_self_tokko: true };
        const prefs = { ...DEFAULT_PREFS, ...(ownerSub.mail_prefs || {}) };

        const lowCount = agentRows.filter(a => !a.isSelf && a.iac < 40).length;
        const subjectAlert = lowCount > 0 ? ` · 🔴 ${lowCount} agente${lowCount > 1 ? "s" : ""} inactivo${lowCount > 1 ? "s" : ""}` : "";

        subject = `Resumen de equipo · ${weekDates}${subjectAlert}`;
        html = generateTeamEmailHtml({
          recipientName: ownerSub.name || email.split("@")[0],
          recipientEmail: email,
          recipientRole: ownerSub.team_role || "owner",
          weekDates,
          agents: agentRows,
          includeSelfActivity: prefs.include_self_activity,
          includeSelfTokko: prefs.include_self_tokko,
          weeklyGoal,
        });

      } else {
        return res.status(400).json({ error: "template desconocido" });
      }

      const { error } = await resend.emails.send({
        from: "InmoCoach <coach@inmocoach.com.ar>",
        to: email,
        subject,
        html,
      });

      if (error) { results.failed++; results.errors.push(`${email}: ${(error as any).message}`); }
      else results.sent++;

      await new Promise(r => setTimeout(r, 150));
    } catch (err: any) {
      results.failed++;
      results.errors.push(`${email}: ${err.message}`);
    }
  }

  return res.status(200).json({ ok: true, ...results, total: emails.length });
}
