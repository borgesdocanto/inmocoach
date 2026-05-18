import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { Resend } from "resend";
import { EMAIL_FROM, EMAIL_FOOTER } from "../../../lib/email";
import { DEFAULT_MSG_AGENT, DEFAULT_MSG_TEAM } from "../teams/birthday-templates";

// Este cron corre todos los días a las 12:00 UTC (09:00 Argentina)
// Vercel cron: "0 12 * * *"

const resend = new Resend(process.env.RESEND_API_KEY);

function applyTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

function buildBirthdayEmailHtml(text: string, agencyName: string): string {
  const paragraphs = text
    .split("\n")
    .map((line) => line.trim())
    .map((line) =>
      line
        ? `<p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.7;">${line}</p>`
        : `<p style="margin:0 0 8px;">&nbsp;</p>`
    )
    .join("");

  return `
    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;background:#ffffff;">
      <div style="height:4px;background:#aa0000;margin-bottom:32px;border-radius:2px;"></div>
      <div style="margin-bottom:28px;">
        <span style="font-size:40px;">🎂</span>
      </div>
      <div style="margin-bottom:24px;">
        <span style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#111827;">${agencyName}</span>
      </div>
      ${paragraphs}
      ${EMAIL_FOOTER}
    </div>
  `;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Proteger con CRON_SECRET
  const secret = req.headers["x-cron-secret"] || req.query.secret;
  if (secret !== process.env.CRON_SECRET) return res.status(401).json({ error: "No autorizado" });

  const today = new Date();
  const todayMonth = today.getMonth() + 1; // 1-12
  const todayDay = today.getDate();

  // Día de ayer (para el mail al equipo)
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayMonth = yesterday.getMonth() + 1;
  const yesterdayDay = yesterday.getDate();

  const results: { action: string; email: string; status: string }[] = [];

  // 1. MAIL AL FESTEJADO: quienes cumplen HOYC
  const { data: celebrants } = await supabaseAdmin
    .from("subscriptions")
    .select("email, name, birthday, team_id")
    .not("birthday", "is", null);

  const todayCelebrants = (celebrants || []).filter((u) => {
    if (!u.birthday) return false;
    const b = new Date(u.birthday);
    return b.getMonth() + 1 === todayMonth && b.getDate() === todayDay;
  });

  for (const user of todayCelebrants) {
    if (!user.team_id) continue;

    // Obtener datos del equipo
    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("agency_name, birthday_msg_agent")
      .eq("id", user.team_id)
      .single();

    const agencyName = team?.agency_name || "Tu inmobiliaria";
    const template = team?.birthday_msg_agent || DEFAULT_MSG_AGENT;
    const text = applyTemplate(template, {
      nombre: user.name || user.email.split("@")[0],
      inmobiliaria: agencyName,
    });

    try {
      await resend.emails.send({
        from: EMAIL_FROM,
        to: user.email,
        subject: `¡Feliz cumpleaños, ${user.name || ""}! 🎂`,
        html: buildBirthdayEmailHtml(text, agencyName),
      });
      results.push({ action: "mail_festejado", email: user.email, status: "ok" });
    } catch (err: any) {
      results.push({ action: "mail_festejado", email: user.email, status: `error: ${err?.message}` });
    }
  }

  // 2. MAIL AL EQUIPO: quienes cumplen MAÑANA (hoy es el día anterior)
  // => buscamos cumpleaños de mañana
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowMonth = tomorrow.getMonth() + 1;
  const tomorrowDay = tomorrow.getDate();

  const tomorrowCelebrants = (celebrants || []).filter((u) => {
    if (!u.birthday) return false;
    const b = new Date(u.birthday);
    return b.getMonth() + 1 === tomorrowMonth && b.getDate() === tomorrowDay;
  });

  for (const celebrant of tomorrowCelebrants) {
    if (!celebrant.team_id) continue;

    // Obtener equipo y miembros
    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("agency_name, birthday_msg_team")
      .eq("id", celebrant.team_id)
      .single();

    const { data: members } = await supabaseAdmin
      .from("subscriptions")
      .select("email, name")
      .eq("team_id", celebrant.team_id)
      .neq("email", celebrant.email); // excluir al festejado del mail al equipo

    if (!members || members.length === 0) continue;

    const agencyName = team?.agency_name || "Tu inmobiliaria";
    const template = team?.birthday_msg_team || DEFAULT_MSG_TEAM;
    const text = applyTemplate(template, {
      nombre: celebrant.name || celebrant.email.split("@")[0],
      inmobiliaria: agencyName,
    });

    const celebrantName = celebrant.name || celebrant.email.split("@")[0];

    for (const member of members) {
      try {
        await resend.emails.send({
          from: EMAIL_FROM,
          to: member.email,
          subject: `🎂 Mañana cumple años ${celebrantName}`,
          html: buildBirthdayEmailHtml(text, agencyName),
        });
        results.push({ action: "mail_equipo", email: member.email, status: "ok" });
      } catch (err: any) {
        results.push({ action: "mail_equipo", email: member.email, status: `error: ${err?.message}` });
      }
    }
  }

  return res.json({
    ok: true,
    todayCelebrants: todayCelebrants.length,
    tomorrowCelebrants: tomorrowCelebrants.length,
    results,
  });
}
