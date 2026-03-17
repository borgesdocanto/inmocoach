import { NextApiRequest, NextApiResponse } from "next";
import { Resend } from "resend";
import { supabaseAdmin } from "../../../lib/supabase";

export const config = { maxDuration: 60 };

const resend = new Resend(process.env.RESEND_API_KEY!);
const RED = "#aa0000";

function buildDay3Html(name: string, greenTotal: number, iacGoal: number): string {
  const iac = Math.min(100, Math.round((greenTotal / iacGoal) * 100));
  const firstName = name.split(" ")[0];

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cómo vas — InmoCoach</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 16px;">
  <div style="background:white;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:${RED};padding:24px 28px;">
      <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">InmoCoach · Día 3</div>
      <div style="font-size:22px;font-weight:900;color:white;font-family:Georgia,serif;">¿Cómo vas, ${firstName}?</div>
    </div>
    <div style="padding:28px;">
      <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 20px;">
        Lleás 3 días usando InmoCoach. Ya empezamos a ver tu actividad real en el calendario.
      </p>

      ${greenTotal > 0 ? `
      <div style="background:#f0fdf4;border-radius:12px;padding:16px 20px;margin-bottom:20px;border-left:3px solid #16a34a;">
        <div style="font-size:12px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">Tu actividad esta semana</div>
        <div style="font-size:32px;font-weight:900;color:#15803d;font-family:Georgia,serif;">${greenTotal} reuniones</div>
        <div style="font-size:13px;color:#16a34a;margin-top:2px;">IAC ${iac}% · meta ${iacGoal}/semana</div>
      </div>` : `
      <div style="background:#fef2f2;border-radius:12px;padding:16px 20px;margin-bottom:20px;border-left:3px solid ${RED};">
        <div style="font-size:13px;color:#991b1b;line-height:1.6;">
          Todavía no vemos reuniones esta semana. Asegurate de que tus eventos de Google Calendar tengan palabras como <strong>Tasación, Visita, Reunión, Propuesta</strong> en el título.
        </div>
      </div>`}

      <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 20px;">
        InmoCoach mide tu productividad en tiempo real y te da un análisis cada lunes. 
        <strong>Quedan 4 días de prueba gratis.</strong>
      </p>

      <div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px;">
        <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:12px;">¿Qué incluye el plan?</div>
        ${["📊 IAC y actividad en tiempo real", "📧 Análisis semanal del Coach todos los lunes", "🔥 Sistema de rachas y rangos", "👥 Dashboard de equipo para brokers", "🤖 Consejos personalizados con IA"].map(item =>
          `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:13px;color:#4b5563;">${item}</div>`
        ).join("")}
      </div>

      <div style="text-align:center;">
        <a href="https://inmocoach.com.ar/pricing"
          style="display:inline-block;background:${RED};color:white;font-weight:900;font-size:14px;padding:14px 36px;border-radius:12px;text-decoration:none;">
          Ver planes y precios →
        </a>
      </div>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #f3f4f6;text-align:center;font-size:11px;color:#9ca3af;">
      InmoCoach · <a href="https://inmocoach.com.ar" style="color:#9ca3af;">inmocoach.com.ar</a>
    </div>
  </div>
</div>
</body></html>`;
}

function buildDay5Html(name: string, greenTotal: number, iacGoal: number): string {
  const iac = Math.min(100, Math.round((greenTotal / iacGoal) * 100));
  const firstName = name.split(" ")[0];
  const daysLeft = 2;

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Te quedan 2 días — InmoCoach</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 16px;">
  <div style="background:white;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:linear-gradient(135deg,${RED} 0%,#7f0000 100%);padding:24px 28px;">
      <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">InmoCoach · Día 5</div>
      <div style="font-size:22px;font-weight:900;color:white;font-family:Georgia,serif;">Te quedan ${daysLeft} días de prueba</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.75);margin-top:4px;">${firstName}, no pierdas el acceso a tus datos</div>
    </div>
    <div style="padding:28px;">

      <div style="background:#fef2f2;border-radius:12px;padding:16px 20px;margin-bottom:24px;border:1px solid #fecaca;">
        <div style="font-size:12px;font-weight:700;color:${RED};text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Tu actividad esta semana</div>
        <div style="display:flex;align-items:baseline;gap:8px;">
          <span style="font-size:36px;font-weight:900;color:${iac >= 67 ? "#15803d" : RED};font-family:Georgia,serif;">${iac}%</span>
          <span style="font-size:13px;color:#6b7280;">IAC · ${greenTotal}/${iacGoal} reuniones</span>
        </div>
        <div style="margin-top:10px;height:6px;background:#f3f4f6;border-radius:99px;overflow:hidden;">
          <div style="height:100%;background:${iac >= 67 ? "#16a34a" : RED};width:${Math.min(100, iac)}%;border-radius:99px;"></div>
        </div>
      </div>

      <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 16px;">
        En ${daysLeft} días tu prueba termina. Si no activás un plan, perdés acceso al dashboard, al historial de actividad y al análisis semanal del Coach.
      </p>

      <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 24px;">
        <strong>El negocio inmobiliario se mide por actividad.</strong> InmoCoach es el único sistema que lo hace automáticamente — sin cargar nada a mano.
      </p>

      <div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px;">
        <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:4px;">Plan Individual</div>
        <div style="font-size:28px;font-weight:900;color:#111827;font-family:Georgia,serif;">$10.500<span style="font-size:14px;font-weight:400;color:#9ca3af;">/mes</span></div>
        <div style="font-size:12px;color:#6b7280;margin-top:4px;">Cancelás cuando querés · sin permanencia</div>
      </div>

      <div style="text-align:center;margin-bottom:12px;">
        <a href="https://inmocoach.com.ar/pricing"
          style="display:inline-block;background:${RED};color:white;font-weight:900;font-size:15px;padding:16px 40px;border-radius:12px;text-decoration:none;letter-spacing:0.3px;">
          Activar mi plan ahora →
        </a>
      </div>
      <div style="text-align:center;font-size:12px;color:#9ca3af;">
        ¿Tenés dudas? Respondé este mail y te ayudamos.
      </div>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #f3f4f6;text-align:center;font-size:11px;color:#9ca3af;">
      InmoCoach · <a href="https://inmocoach.com.ar" style="color:#9ca3af;">inmocoach.com.ar</a>
    </div>
  </div>
</div>
</body></html>`;
}

function buildDay8Html(name: string, greenTotal: number, iacGoal: number): string {
  const iac = Math.min(100, Math.round((greenTotal / iacGoal) * 100));
  const firstName = name.split(" ")[0];
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tu prueba terminó — InmoCoach</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 16px;">
  <div style="background:white;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:linear-gradient(135deg,#1a1a2e 0%,#111827 100%);padding:24px 28px;">
      <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.5);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">InmoCoach</div>
      <div style="font-size:22px;font-weight:900;color:white;font-family:Georgia,serif;">Tu prueba de 7 días terminó</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:4px;">${firstName}, no perdás lo que construiste</div>
    </div>
    <div style="padding:28px;">
      <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 20px;">
        Durante estos 7 días InmoCoach estuvo midiendo tu actividad comercial en tiempo real. <strong>Tu historial, tus datos y tu progreso están guardados</strong> — pero necesitás activar un plan para seguir accediendo.
      </p>

      <div style="background:#fef2f2;border-radius:12px;padding:16px 20px;margin-bottom:24px;border:1px solid #fecaca;">
        <div style="font-size:12px;font-weight:700;color:${RED};text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Tu actividad esta semana</div>
        <div style="display:flex;align-items:baseline;gap:8px;">
          <span style="font-size:36px;font-weight:900;font-family:Georgia,serif;color:${iac >= 67 ? "#15803d" : RED};">${iac}%</span>
          <span style="font-size:13px;color:#6b7280;">IAC · ${greenTotal}/${iacGoal} reuniones</span>
        </div>
        <div style="margin-top:10px;height:6px;background:#f3f4f6;border-radius:99px;overflow:hidden;">
          <div style="height:100%;background:${iac >= 67 ? "#16a34a" : RED};width:${Math.min(100, iac)}%;border-radius:99px;"></div>
        </div>
      </div>

      <div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px;">
        <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:16px;">Lo que perdés si no activás</div>
        ${["❌ Acceso al dashboard con tu IAC en tiempo real", "❌ El análisis del Coach todos los lunes", "❌ Tu historial de actividad y rachas", "❌ Tu posición en el ranking del equipo"].map(item =>
          `<div style="margin-bottom:8px;font-size:13px;color:#6b7280;">${item}</div>`
        ).join("")}
      </div>

      <div style="background:#f0fdf4;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #bbf7d0;">
        <div style="font-size:13px;font-weight:700;color:#15803d;margin-bottom:4px;">Plan Individual</div>
        <div style="font-size:28px;font-weight:900;color:#111827;font-family:Georgia,serif;">$10.500<span style="font-size:14px;font-weight:400;color:#9ca3af;">/mes</span></div>
        <div style="font-size:12px;color:#16a34a;margin-top:4px;">✓ Cancelás cuando querés · sin permanencia</div>
      </div>

      <div style="text-align:center;margin-bottom:12px;">
        <a href="https://inmocoach.com.ar/pricing"
          style="display:inline-block;background:${RED};color:white;font-weight:900;font-size:15px;padding:16px 40px;border-radius:12px;text-decoration:none;">
          Activar mi plan y recuperar acceso →
        </a>
      </div>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #f3f4f6;text-align:center;font-size:11px;color:#9ca3af;">
      Este mail es automático — no hace falta que respondas. · <a href="https://inmocoach.com.ar" style="color:#9ca3af;text-decoration:none;">inmocoach.com.ar</a>
    </div>
  </div>
</div>
</body></html>`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isVercel = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  const isManual = req.headers["x-cron-secret"] === process.env.CRON_SECRET;
  if (!isVercel && !isManual) return res.status(401).json({ error: "No autorizado" });

  const { targetEmail } = req.body || {};

  // Traer usuarios freemium activos
  const { data: users } = await supabaseAdmin
    .from("subscriptions")
    .select("email, name, created_at, plan")
    .eq("status", "active")
    .eq("plan", "free");

  if (!users?.length) return res.status(200).json({ ok: true, sent: 0 });

  const now = new Date();
  let day3 = 0, day5 = 0, day8 = 0, failed = 0;

  for (const user of users) {
    if (targetEmail && user.email !== targetEmail) continue;

    const created = new Date(user.created_at);
    const daysUsed = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUsed !== 3 && daysUsed !== 5 && daysUsed !== 8) continue;

    // Contar eventos verdes esta semana
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    weekStart.setHours(0, 0, 0, 0);

    const { count } = await supabaseAdmin
      .from("calendar_events")
      .select("*", { count: "exact", head: true })
      .eq("user_email", user.email)
      .eq("is_productive", true)
      .gte("start_at", weekStart.toISOString());

    const greenTotal = count ?? 0;
    const iacGoal = 15;

    let html: string;
    let subject: string;

    if (daysUsed === 3) {
      html = buildDay3Html(user.name || user.email, greenTotal, iacGoal);
      subject = `¿Cómo vas? · ${greenTotal} reuniones esta semana`;
    } else if (daysUsed === 5) {
      html = buildDay5Html(user.name || user.email, greenTotal, iacGoal);
      subject = `Te quedan 2 días de prueba — no pierdas el acceso`;
    } else {
      // Día 8 — expirado
      html = buildDay8Html(user.name || user.email, greenTotal, iacGoal);
      subject = `Tu prueba terminó — activá tu plan para seguir`;
    }

    try {
      const { error } = await resend.emails.send({
        from: "InmoCoach <coach@inmocoach.com.ar>",
        to: user.email,
        subject,
        html,
      });
      if (error) { failed++; console.error(`❌ ${user.email}:`, error); }
      else {
        if (daysUsed === 3) day3++;
        else if (daysUsed === 5) day5++;
        else day8++;
        console.log(`✅ día ${daysUsed} → ${user.email}`);
      }
    } catch (e: any) {
      failed++;
      console.error(`❌ ${user.email}:`, e?.message);
    }

    await new Promise(r => setTimeout(r, 600));
  }

  return res.status(200).json({ ok: true, day3, day5, day8, failed });
}
