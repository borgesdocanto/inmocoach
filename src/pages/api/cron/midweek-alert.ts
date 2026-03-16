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
      "Todavía hay tiempo esta semana. Agendá 3 reuniones para mañana y llegás al viernes con actividad real.";
  } catch {
    return "Todavía hay tiempo esta semana. Agendá 3 reuniones para mañana y llegás al viernes con actividad real.";
  }
}

function buildHtml(params: {
  firstName: string;
  greenCount: number;
  minGreens: number;
  weeklyGoal: number;
  advice: string;
}): string {
  const { firstName, greenCount, minGreens, weeklyGoal, advice } = params;
  const RED = "#aa0000";
  const pct = Math.min(100, Math.round((greenCount / minGreens) * 100));
  const barColor = pct >= 100 ? "#16a34a" : pct >= 50 ? "#d97706" : RED;
  const missing = Math.max(0, minGreens - greenCount);

  const adviceParts = advice.split(/\n\n+/).filter(Boolean);

  const kpi = (value: string | number, label: string) => `
    <td style="padding:0 4px;">
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;padding:16px 12px;text-align:center;">
        <tr><td>
          <p style="margin:0;font-family:Georgia,serif;font-size:28px;font-weight:900;color:#111827;">${value}</p>
          <p style="margin:5px 0 0;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">${label}</p>
        </td></tr>
      </table>
    </td>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>A mitad de semana — InmoCoach</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Barra roja superior -->
        <tr>
          <td style="background:${RED};height:5px;border-radius:12px 12px 0 0;font-size:0;line-height:0;">&nbsp;</td>
        </tr>

        <!-- Header -->
        <tr>
          <td style="background:#ffffff;padding:28px 32px 20px;border-bottom:1px solid #f3f4f6;">
            <p style="margin:0;font-family:Georgia,serif;font-size:26px;font-weight:900;color:#111827;line-height:1;">
              Inmo<span style="color:${RED};">Coach</span>
            </p>
            <p style="margin:6px 0 0;font-size:12px;color:#9ca3af;font-weight:500;letter-spacing:0.5px;">
              Alerta de mitad de semana · Lunes–Miércoles
            </p>
          </td>
        </tr>

        <!-- Saludo -->
        <tr>
          <td style="background:#ffffff;padding:24px 32px 8px;">
            <p style="margin:0;font-family:Georgia,serif;font-size:20px;font-weight:900;color:#111827;">
              Hola, ${firstName}.
            </p>
            <p style="margin:6px 0 0;font-size:14px;color:#6b7280;">
              Tu actividad comercial a mitad de semana.
            </p>
          </td>
        </tr>

        <!-- KPIs -->
        <tr>
          <td style="background:#ffffff;padding:20px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                ${kpi(greenCount, "Eventos verdes")}
                ${kpi(minGreens, "Meta Lun–Mié")}
                ${kpi(weeklyGoal, "Meta semanal")}
                ${kpi(missing > 0 ? missing : "✓", missing > 0 ? "Faltan" : "Objetivo")}
              </tr>
            </table>
          </td>
        </tr>

        <!-- Barra de progreso -->
        <tr>
          <td style="background:#ffffff;padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;padding:16px 20px;">
              <tr>
                <td>
                  <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#6b7280;">
                    Progreso Lun–Mié: ${greenCount} de ${minGreens} eventos verdes
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background:#e5e7eb;border-radius:999px;height:10px;overflow:hidden;">
                        <div style="width:${pct}%;height:10px;background:${barColor};border-radius:999px;"></div>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:6px 0 0;font-size:11px;font-weight:700;color:${barColor};">${pct}% · Quedan jue y vie</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Consejo del coach (generado por IA) -->
        <tr>
          <td style="background:#ffffff;padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0"
              style="border:1px solid #fecaca;border-radius:14px;overflow:hidden;">
              <tr>
                <td style="background:#fff5f5;padding:12px 20px;border-bottom:1px solid #fecaca;">
                  <p style="margin:0;font-size:11px;font-weight:700;color:${RED};text-transform:uppercase;letter-spacing:0.08em;">
                    📊 InmoCoach — Análisis de mitad de semana
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px;">
                  ${adviceParts.map(p => `<p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#374151;">${p.trim()}</p>`).join("")}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="background:#ffffff;padding:0 32px 32px;text-align:center;">
            <a href="https://inmocoach.com.ar"
              style="display:inline-block;background:${RED};color:white;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;">
              Ver mi actividad →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;border-radius:0 0 12px 12px;">
            <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">
              InmoCoach · <a href="https://inmocoach.com.ar" style="color:#9ca3af;">inmocoach.com.ar</a> · coach@inmocoach.com.ar
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isVercel = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  const isManual = req.headers["x-cron-secret"] === process.env.CRON_SECRET;
  if (!isVercel && !isManual) return res.status(401).json({ error: "No autorizado" });

  const cfg = await getAppConfig();
  const minGreens = parseInt(cfg["midweek_min_greens"] ?? "5");
  const weeklyGoal = parseInt(cfg["weekly_goal"] ?? "15");
  const prompt = cfg["midweek_prompt"] ?? DEFAULT_MIDWEEK_PROMPT;

  // Calcular lunes de esta semana en AR (UTC-3)
  const now = new Date();
  const arNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const todayAR = arNow.toISOString().slice(0, 10);
  const dayOfWeek = arNow.getDay();
  const monday = new Date(arNow);
  monday.setDate(arNow.getDate() - ((dayOfWeek + 6) % 7));
  const mondayStr = monday.toISOString().slice(0, 10);

  // Obtener usuarios activos
  const { data: users } = await supabaseAdmin
    .from("subscriptions")
    .select("email, name, plan, team_id")
    .eq("status", "active")
    .not("google_access_token", "is", null);

  if (!users?.length) return res.status(200).json({ ok: true, sent: 0 });

  const { targetEmail } = req.body || {};
  const filteredUsers = targetEmail ? users.filter(u => u.email === targetEmail) : users;

  // Filtrar los que no llegaron al mínimo lun–mié
  const eligible: { email: string; name: string; greenCount: number }[] = [];
  for (const user of filteredUsers) {
    const { count } = await supabaseAdmin
      .from("calendar_events")
      .select("*", { count: "exact", head: true })
      .eq("user_email", user.email)
      .eq("is_productive", true)
      .gte("start_at", `${mondayStr}T03:00:00Z`)
      .lte("start_at", `${todayAR}T23:59:59Z`);

    if ((count ?? 0) < minGreens) {
      eligible.push({
        email: user.email,
        name: user.name || user.email.split("@")[0],
        greenCount: count ?? 0,
      });
    }
  }

  if (!eligible.length) return res.status(200).json({ ok: true, sent: 0, reason: "Todos llegaron al mínimo" });

  // Generar UN solo texto con IA (mismo para todos)
  const advice = await generateMidweekAdvice(prompt);

  // Enviar con pausa para respetar rate limit de Resend
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < eligible.length; i++) {
    const user = eligible[i];
    const firstName = (user.name || "").split(" ")[0] || "Agente";
    try {
      const { error } = await resend.emails.send({
        from: "InmoCoach <coach@inmocoach.com.ar>",
        to: user.email,
        subject: `A mitad de semana · ${user.greenCount} de ${minGreens} eventos verdes`,
        html: buildHtml({ firstName, greenCount: user.greenCount, minGreens, weeklyGoal, advice }),
      });
      if (error) { failed++; console.error(`❌ ${user.email}:`, error); }
      else { sent++; console.log(`✅ ${user.email} (${user.greenCount} verdes)`); }
    } catch (e: any) {
      failed++;
      console.error(`❌ ${user.email}:`, e?.message);
    }
    if (i < eligible.length - 1) await new Promise(r => setTimeout(r, 600));
  }

  console.log(`📊 Midweek: ${sent} enviados, ${failed} errores, ${filteredUsers.length - eligible.length} ya llegaron al mínimo`);
  return res.status(200).json({ ok: true, sent, failed, skipped: filteredUsers.length - eligible.length });
}
