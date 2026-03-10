import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { sendPushToUser } from "../../../lib/webpush";
import { Resend } from "resend";
import { EMAIL_FROM } from "../../../lib/email";

const resend = new Resend(process.env.RESEND_API_KEY!);

// Corre a las 18hs (21hs UTC) lunes a viernes
// vercel.json: "0 21 * * 1-5"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers["x-cron-secret"] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const today = new Date().toISOString().slice(0, 10);
  const dayOfWeek = new Date().getDay(); // 1=lun 5=vie

  // Solo lunes a viernes
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return res.status(200).json({ ok: true, skipped: "fin de semana" });
  }

  // Usuarios con racha activa (streak_current >= 1)
  const { data: users } = await supabaseAdmin
    .from("subscriptions")
    .select("email, name, streak_current, streak_last_active_date")
    .gte("streak_current", 1)
    .not("google_access_token", "is", null);

  if (!users || users.length === 0) {
    return res.status(200).json({ ok: true, checked: 0 });
  }

  // Ver quién ya cumplió hoy (streak_last_active_date = today)
  const atRisk = users.filter(u => u.streak_last_active_date !== today);

  console.log(`🔥 ${atRisk.length} agentes con racha en riesgo hoy`);

  res.status(200).json({ ok: true, atRisk: atRisk.length, total: users.length });

  // Procesar en background
  let pushed = 0, mailed = 0;

  for (const user of atRisk) {
    const streak = user.streak_current;
    const name = user.name?.split(" ")[0] || "Campeón";
    const isFriday = dayOfWeek === 5;

    const title = isFriday
      ? `🔥 ¡${name}, no pierdas tu racha de ${streak} día${streak > 1 ? "s" : ""}!`
      : `⚡ Racha en riesgo — ${streak} día${streak > 1 ? "s" : ""} consecutivo${streak > 1 ? "s" : ""}`;

    const body = isFriday
      ? `Hoy es viernes, el último día de la semana. Agendá una reunión cara a cara y cerrá la semana fuerte.`
      : `Todavía no registraste reuniones cara a cara hoy. Agendá una antes de las 8pm y mantené tu racha.`;

    // Push notification
    const { sent } = await sendPushToUser(user.email, {
      title,
      body,
      url: "/",
      tag: "streak-alert",
      actions: [{ action: "open", title: "Ver mi dashboard" }],
    });

    if (sent > 0) {
      pushed++;
      continue; // Si tiene push, no mandamos mail
    }

    // Fallback: mail si no tiene push
    try {
      await resend.emails.send({
        from: EMAIL_FROM,
        to: user.email,
        subject: title,
        html: `
          <div style="font-family:'Helvetica Neue',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
            <div style="background:#aa0000;color:white;border-radius:16px;padding:24px;text-align:center;margin-bottom:24px;">
              <div style="font-size:40px;margin-bottom:8px;">🔥</div>
              <h1 style="margin:0;font-size:20px;font-weight:900;">${title}</h1>
            </div>
            <p style="color:#374151;font-size:15px;line-height:1.6;">${body}</p>
            <p style="color:#6b7280;font-size:14px;">Tu racha actual: <strong style="color:#ea580c;">${streak} día${streak > 1 ? "s" : ""} consecutivo${streak > 1 ? "s" : ""}</strong></p>
            <a href="https://inmocoach.com.ar" style="display:inline-block;margin-top:16px;background:#aa0000;color:white;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:900;font-size:14px;">
              Abrir InmoCoach →
            </a>
            <p style="color:#9ca3af;font-size:11px;margin-top:24px;">
              Recibís este mail porque tenés una racha activa en InmoCoach.<br>
              <a href="https://inmocoach.com.ar" style="color:#9ca3af;">Configurar notificaciones</a>
            </p>
          </div>
        `,
      });
      mailed++;
    } catch (err: any) {
      console.error(`❌ Mail error para ${user.email}:`, err?.message);
    }

    // Pequeña pausa para no saturar Resend
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`📊 Streak alerts: ${pushed} push, ${mailed} mails, ${atRisk.length - pushed - mailed} sin contacto`);
}
