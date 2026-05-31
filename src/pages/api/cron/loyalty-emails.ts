import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { Resend } from "resend";
import { EMAIL_FROM, EMAIL_FOOTER } from "../../../lib/email";
import { MAIL_DEFINITIONS } from "../../../lib/autoMailTemplates";

// Cron: todos los días 12:30 UTC = 09:30 Argentina
// "30 12 * * *"

const resend = new Resend(process.env.RESEND_API_KEY);

// Días exactos para cada mail de fidelización
const LOYALTY_DAYS: Record<string, number> = {
  loyalty_month_1: 30,
  loyalty_month_2: 60,
  loyalty_month_3: 90,
  loyalty_month_6: 180,
  loyalty_annual: 365,
};

function applyVars(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${k}\\}`, "g"), v);
  }
  return result;
}

function buildHtml(body: string, agencyName: string): string {
  const paragraphs = body
    .split("\n")
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return `<p style="margin:0 0 8px;">&nbsp;</p>`;
      if (trimmed.startsWith("→")) {
        return `<p style="margin:0 0 8px;padding-left:16px;color:#374151;font-size:15px;line-height:1.7;border-left:3px solid #aa0000;">${trimmed}</p>`;
      }
      return `<p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.7;">${trimmed}</p>`;
    })
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

  const today = new Date();
  const todayNorm = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const results: { email: string; key: string; status: string }[] = [];

  // Traer todos los miembros con work_anniversary
  const { data: members } = await supabaseAdmin
    .from("subscriptions")
    .select("email, name, work_anniversary, team_id")
    .not("work_anniversary", "is", null)
    .not("team_id", "is", null);

  if (!members || members.length === 0) return res.json({ ok: true, results });

  // Agrupar por equipo para traer templates una sola vez por equipo
  const teamIds = Array.from(new Set(members.map(m => m.team_id).filter(Boolean))) as string[];

  for (const teamId of teamIds) {
    const teamMembers = members.filter(m => m.team_id === teamId);

    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("agency_name")
      .eq("id", teamId)
      .single();

    const agencyName = team?.agency_name || "Tu inmobiliaria";

    // Traer templates guardados para este equipo
    const { data: savedTemplates } = await supabaseAdmin
      .from("loyalty_email_templates")
      .select("mail_key, subject, body, enabled")
      .eq("team_id", teamId);

    const savedMap: Record<string, { subject: string; body: string; enabled: boolean }> = {};
    for (const t of savedTemplates || []) {
      savedMap[t.mail_key] = { subject: t.subject, body: t.body, enabled: t.enabled };
    }

    for (const member of teamMembers) {
      if (!member.work_anniversary) continue;

      const startDate = new Date(member.work_anniversary + "T12:00:00");
      const startNorm = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const daysSince = Math.round((todayNorm.getTime() - startNorm.getTime()) / (1000 * 60 * 60 * 24));

      const personName = member.name || member.email.split("@")[0];

      for (const [mailKey, targetDays] of Object.entries(LOYALTY_DAYS)) {
        if (daysSince !== targetDays) continue;

        // Chequear si está habilitado (default: true si no hay row guardada)
        const saved = savedMap[mailKey];
        const isEnabled = saved ? saved.enabled : true;
        if (!isEnabled) {
          results.push({ email: member.email, key: mailKey, status: "disabled" });
          continue;
        }

        // Obtener template (custom o default)
        const def = MAIL_DEFINITIONS.find(d => d.key === mailKey);
        if (!def) continue;

        const subject = saved?.subject || def.defaultSubject;
        const body = saved?.body || def.defaultBody;

        const vars: Record<string, string> = {
          nombre: personName,
          inmobiliaria: agencyName,
          meses: String(Math.round(targetDays / 30)),
          años: String(Math.round(targetDays / 365)),
          plural: targetDays === 365 ? "" : "s",
        };

        const finalSubject = applyVars(subject, vars);
        const finalBody = applyVars(body, vars);

        try {
          await resend.emails.send({
            from: EMAIL_FROM,
            to: member.email,
            subject: finalSubject,
            html: buildHtml(finalBody, agencyName),
          });
          results.push({ email: member.email, key: mailKey, status: "ok" });
        } catch (e: any) {
          results.push({ email: member.email, key: mailKey, status: `error: ${e?.message}` });
        }
      }
    }
  }

  return res.json({ ok: true, sent: results.filter(r => r.status === "ok").length, results });
}
