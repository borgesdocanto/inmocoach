import { NextApiRequest, NextApiResponse } from "next";
import { Resend } from "resend";
import { supabaseAdmin } from "../../../lib/supabase";
import { getAppConfig } from "../../../lib/appConfig";
import { DEFAULT_MIDWEEK_PROMPT } from "../admin/midweek-prompt";

export const config = { maxDuration: 120 };

const resend = new Resend(process.env.RESEND_API_KEY!);

async function generateMidweekAdvice(prompt: string): Promise<string> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    return data.content?.map((b: any) => b.text || "").join("") ||
      "Esta semana todavía hay tiempo. Agendá 3 reuniones para mañana y llegás al viernes con actividad real.";
  } catch {
    return "Esta semana todavía hay tiempo. Agendá 3 reuniones para mañana y llegás al viernes con actividad real.";
  }
}

function buildHtml(advice: string, greenCount: number, minGreens: number): string {
  const paragraphs = advice.split(/\n\n+/).filter(p => p.trim());
  const RED = "#aa0000";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>A mitad de semana — InmoCoach</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 16px;">
  <div style="background:white;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:${RED};padding:24px 28px;">
      <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.7);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">InmoCoach</div>
      <div style="font-size:22px;font-weight:900;color:white;font-family:Georgia,serif;">A mitad de semana</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px;">Lunes + Martes + Miércoles: ${greenCount} de ${minGreens} eventos verdes</div>
    </div>
    <div style="padding:28px;">
      ${paragraphs.map(p => `<p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 16px 0;">${p.trim()}</p>`).join("")}
      <div style="margin-top:24px;padding:16px;background:#fef2f2;border-radius:12px;border-left:3px solid ${RED};">
        <div style="font-size:12px;font-weight:700;color:${RED};text-transform:uppercase;letter-spacing:0.05em;">Quedan 2 días hábiles</div>
        <div style="font-size:13px;color:#6b7280;margin-top:4px;">Cada reunión que agendás hoy o mañana cuenta para el IAC de la semana.</div>
      </div>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #f3f4f6;text-align:center;">
      <a href="https://inmocoach.com.ar" style="font-size:13px;color:${RED};font-weight:700;text-decoration:none;">Ver mi actividad →</a>
    </div>
  </div>
  <div style="text-align:center;margin-top:16px;font-size:11px;color:#9ca3af;">InmoCoach · coach@inmocoach.com.ar</div>
</div>
</body></html>`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isVercel = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  const isManual = req.headers["x-cron-secret"] === process.env.CRON_SECRET;
  if (!isVercel && !isManual) return res.status(401).json({ error: "No autorizado" });

  const cfg = await getAppConfig();
  const minGreens = parseInt(cfg["midweek_min_greens"] ?? "5");
  const prompt = cfg["midweek_prompt"] ?? DEFAULT_MIDWEEK_PROMPT;

  // Calcular lunes y miércoles de esta semana en AR (UTC-3)
  const now = new Date();
  const arNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const todayAR = arNow.toISOString().slice(0, 10);
  const dayOfWeek = arNow.getDay(); // 3 = miércoles
  const monday = new Date(arNow);
  monday.setDate(arNow.getDate() - ((dayOfWeek + 6) % 7));
  const mondayStr = monday.toISOString().slice(0, 10);

  // Obtener usuarios activos con suscripción vigente
  const { data: users } = await supabaseAdmin
    .from("subscriptions")
    .select("email, name, plan, team_id")
    .eq("status", "active")
    .not("google_access_token", "is", null);

  if (!users?.length) return res.status(200).json({ ok: true, sent: 0 });

  // Filtrar los que no llegaron al mínimo lun–mié
  const eligible: { email: string; name: string; greenCount: number }[] = [];
  for (const user of users) {
    const { count } = await supabaseAdmin
      .from("calendar_events")
      .select("*", { count: "exact", head: true })
      .eq("user_email", user.email)
      .eq("is_productive", true)
      .gte("start_at", `${mondayStr}T03:00:00Z`) // lunes 00:00 AR = 03:00 UTC
      .lte("start_at", `${todayAR}T23:59:59Z`);

    if ((count ?? 0) < minGreens) {
      eligible.push({ email: user.email, name: user.name || user.email.split("@")[0], greenCount: count ?? 0 });
    }
  }

  if (!eligible.length) return res.status(200).json({ ok: true, sent: 0, reason: "Todos llegaron al mínimo" });

  // Generar UN solo mail con IA (mismo para todos)
  const advice = await generateMidweekAdvice(prompt);

  // Enviar a todos los elegibles con pausa entre cada uno
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < eligible.length; i++) {
    const user = eligible[i];
    try {
      const { error } = await resend.emails.send({
        from: "InmoCoach <coach@inmocoach.com.ar>",
        to: user.email,
        subject: `A mitad de semana · ${user.greenCount} de ${minGreens} eventos verdes`,
        html: buildHtml(advice, user.greenCount, minGreens),
      });
      if (error) { failed++; console.error(`❌ ${user.email}:`, error); }
      else { sent++; console.log(`✅ ${user.email} (${user.greenCount} verdes)`); }
    } catch (e: any) {
      failed++;
      console.error(`❌ ${user.email}:`, e?.message);
    }
    if (i < eligible.length - 1) await new Promise(r => setTimeout(r, 600));
  }

  console.log(`📊 Midweek: ${sent} enviados, ${failed} errores, ${users.length - eligible.length} ya llegaron al mínimo`);
  return res.status(200).json({ ok: true, sent, failed, skipped: users.length - eligible.length });
}
