import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { Resend } from "resend";
import { EMAIL_FROM, EMAIL_FOOTER } from "../../../lib/email";
import {
  DEFAULT_BIRTHDAY_AGENT, DEFAULT_BIRTHDAY_TEAM,
  DEFAULT_ANNIVERSARY_AGENT, DEFAULT_ANNIVERSARY_TEAM,
} from "../teams/birthday-templates";

// Cron: todos los días 12:00 UTC = 09:00 Argentina
// "0 12 * * *"

const resend = new Resend(process.env.RESEND_API_KEY);

function applyTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

function getYears(dateStr: string): number | null {
  const d = new Date(dateStr + "T12:00:00");
  if (d.getFullYear() === 1900) return null;
  return new Date().getFullYear() - d.getFullYear();
}

function matchesDate(dateStr: string, month: number, day: number): boolean {
  const d = new Date(dateStr + "T12:00:00");
  return d.getMonth() + 1 === month && d.getDate() === day;
}

function buildHtml(text: string, agencyName: string): string {
  const paragraphs = text
    .split("\n")
    .map(line => line.trim())
    .map(line =>
      line
        ? `<p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.7;">${line}</p>`
        : `<p style="margin:0 0 8px;">&nbsp;</p>`
    )
    .join("");
  return `
    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;background:#ffffff;">
      <div style="height:4px;background:#aa0000;margin-bottom:32px;border-radius:2px;"></div>
      <div style="margin-bottom:24px;">
        <span style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#111827;">${agencyName}</span>
      </div>
      ${paragraphs}
      ${EMAIL_FOOTER}
    </div>`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isVercel = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  const isManual = req.headers["x-cron-secret"] === process.env.CRON_SECRET || req.query.secret === process.env.CRON_SECRET;
  if (!isVercel && !isManual) return res.status(401).json({ error: "No autorizado" });

  // Disparar sync de Systeme (fire-and-forget). Este cron corre confiablemente a diario a las 12:00 UTC,
  // a diferencia de daily-sync. El run-all sigue ejecutándose solo aunque este fetch se aborte a los 8s.
  try {
    const SYSTEME_BASE = process.env.NEXTAUTH_URL ?? "https://www.inmocoach.com.ar";
    await fetch(`${SYSTEME_BASE}/api/systeme/run-all`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
  } catch { /* abort esperado — run-all continúa solo */ }

  const today = new Date();
  const todayM = today.getMonth() + 1;
  const todayD = today.getDate();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomM = tomorrow.getMonth() + 1;
  const tomD = tomorrow.getDate();

  const results: { action: string; email: string; status: string }[] = [];

  // Traer todos los miembros con equipo
  const { data: members } = await supabaseAdmin
    .from("subscriptions")
    .select("email, name, birthday, work_anniversary, team_id")
    .not("team_id", "is", null);

  if (!members) return res.json({ ok: true, results });

  // Agrupar por team_id
  const byTeam: Record<string, typeof members> = {};
  for (const m of members) {
    if (!m.team_id) continue;
    if (!byTeam[m.team_id]) byTeam[m.team_id] = [];
    byTeam[m.team_id].push(m);
  }

  for (const [teamId, teamMembers] of Object.entries(byTeam)) {
    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("agency_name, birthday_msg_agent, birthday_msg_team, anniversary_msg_agent, anniversary_msg_team")
      .eq("id", teamId)
      .single();

    const agencyName = team?.agency_name || "Tu inmobiliaria";

    for (const person of teamMembers) {
      const personName = person.name || person.email.split("@")[0];
      const otherMembers = teamMembers.filter(m => m.email !== person.email);

      // ── CUMPLEAÑOS HOY → mail al festejado ──
      if (person.birthday && matchesDate(person.birthday, todayM, todayD)) {
        const tmpl = team?.birthday_msg_agent || DEFAULT_BIRTHDAY_AGENT;
        const text = applyTemplate(tmpl, { nombre: personName, inmobiliaria: agencyName });
        try {
          await resend.emails.send({
            from: EMAIL_FROM,
            to: person.email,
            subject: `¡Feliz cumpleaños, ${personName}! 🎂`,
            html: buildHtml(text, agencyName),
          });
          results.push({ action: "birthday_agent", email: person.email, status: "ok" });
        } catch (e: any) {
          results.push({ action: "birthday_agent", email: person.email, status: `error: ${e?.message}` });
        }
      }

      // ── CUMPLEAÑOS MAÑANA → mail al equipo ──
      if (person.birthday && matchesDate(person.birthday, tomM, tomD)) {
        const tmpl = team?.birthday_msg_team || DEFAULT_BIRTHDAY_TEAM;
        for (const member of otherMembers) {
          const text = applyTemplate(tmpl, { nombre: personName, inmobiliaria: agencyName });
          try {
            await resend.emails.send({
              from: EMAIL_FROM,
              to: member.email,
              subject: `🎂 Mañana cumple años ${personName}`,
              html: buildHtml(text, agencyName),
            });
            results.push({ action: "birthday_team", email: member.email, status: "ok" });
          } catch (e: any) {
            results.push({ action: "birthday_team", email: member.email, status: `error: ${e?.message}` });
          }
        }
      }

      // ── ANIVERSARIO HOY → mail al festejado ──
      if (person.work_anniversary && matchesDate(person.work_anniversary, todayM, todayD)) {
        const years = getYears(person.work_anniversary);
        const yearsStr = years ? String(years) : "varios";
        const plural = years === 1 ? "" : "s";
        const tmpl = team?.anniversary_msg_agent || DEFAULT_ANNIVERSARY_AGENT;
        const text = applyTemplate(tmpl, { nombre: personName, inmobiliaria: agencyName, años: yearsStr, plural });
        try {
          await resend.emails.send({
            from: EMAIL_FROM,
            to: person.email,
            subject: `¡Feliz aniversario en ${agencyName}, ${personName}! 🏡`,
            html: buildHtml(text, agencyName),
          });
          results.push({ action: "anniversary_agent", email: person.email, status: "ok" });
        } catch (e: any) {
          results.push({ action: "anniversary_agent", email: person.email, status: `error: ${e?.message}` });
        }
      }

      // ── ANIVERSARIO MAÑANA → mail al equipo ──
      if (person.work_anniversary && matchesDate(person.work_anniversary, tomM, tomD)) {
        const years = getYears(person.work_anniversary);
        const yearsStr = years ? String(years) : "varios";
        const plural = years === 1 ? "" : "s";
        const tmpl = team?.anniversary_msg_team || DEFAULT_ANNIVERSARY_TEAM;
        for (const member of otherMembers) {
          const text = applyTemplate(tmpl, { nombre: personName, inmobiliaria: agencyName, años: yearsStr, plural });
          try {
            await resend.emails.send({
              from: EMAIL_FROM,
              to: member.email,
              subject: `🏡 Mañana es el aniversario de ${personName} en ${agencyName}`,
              html: buildHtml(text, agencyName),
            });
            results.push({ action: "anniversary_team", email: member.email, status: "ok" });
          } catch (e: any) {
            results.push({ action: "anniversary_team", email: member.email, status: `error: ${e?.message}` });
          }
        }
      }
    }
  }

  return res.json({ ok: true, results });
}
