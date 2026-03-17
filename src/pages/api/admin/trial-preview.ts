import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { isSuperAdmin } from "../../../lib/adminGuard";
import { supabaseAdmin } from "../../../lib/supabase";

// Importamos las funciones de build directamente del cron
// como no están exportadas, las replicamos acá para preview

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
      <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 20px;">Llevás 3 días usando InmoCoach. Ya empezamos a ver tu actividad real en el calendario.</p>
      ${greenTotal > 0 ? `
      <div style="background:#f0fdf4;border-radius:12px;padding:16px 20px;margin-bottom:20px;border-left:3px solid #16a34a;">
        <div style="font-size:12px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">Tu actividad esta semana</div>
        <div style="font-size:32px;font-weight:900;color:#15803d;font-family:Georgia,serif;">${greenTotal} reuniones</div>
        <div style="font-size:13px;color:#16a34a;margin-top:2px;">IAC ${iac}% · meta ${iacGoal}/semana</div>
      </div>` : `
      <div style="background:#fef2f2;border-radius:12px;padding:16px 20px;margin-bottom:20px;border-left:3px solid ${RED};">
        <div style="font-size:13px;color:#991b1b;line-height:1.6;">Todavía no vemos reuniones esta semana. Asegurate de que tus eventos tengan palabras como <strong>Tasación, Visita, Reunión, Propuesta</strong> en el título.</div>
      </div>`}
      <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 20px;">InmoCoach mide tu productividad en tiempo real y te da un análisis cada lunes. <strong>Quedan 4 días de prueba gratis.</strong></p>
      <div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px;">
        <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:12px;">¿Qué incluye el plan?</div>
        ${["📊 IAC y actividad en tiempo real", "📧 Análisis semanal del Coach todos los lunes", "🔥 Sistema de rachas y rangos", "👥 Dashboard de equipo para brokers", "🤖 Consejos personalizados con IA"].map(item =>
          `<div style="margin-bottom:8px;font-size:13px;color:#4b5563;">${item}</div>`
        ).join("")}
      </div>
      <div style="text-align:center;">
        <a href="https://inmocoach.com.ar/pricing" style="display:inline-block;background:${RED};color:white;font-weight:900;font-size:14px;padding:14px 36px;border-radius:12px;text-decoration:none;">Ver planes y precios →</a>
      </div>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #f3f4f6;text-align:center;font-size:11px;color:#9ca3af;">InmoCoach · <a href="https://inmocoach.com.ar" style="color:#9ca3af;text-decoration:none;">inmocoach.com.ar</a></div>
  </div>
</div></body></html>`;
}

function buildDay5Html(name: string, greenTotal: number, iacGoal: number): string {
  const iac = Math.min(100, Math.round((greenTotal / iacGoal) * 100));
  const firstName = name.split(" ")[0];
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Te quedan 2 días — InmoCoach</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 16px;">
  <div style="background:white;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:linear-gradient(135deg,${RED} 0%,#7f0000 100%);padding:24px 28px;">
      <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">InmoCoach · Día 5</div>
      <div style="font-size:22px;font-weight:900;color:white;font-family:Georgia,serif;">Te quedan 2 días de prueba</div>
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
      <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 16px;">En 2 días tu prueba termina. Si no activás un plan, perdés acceso al dashboard, al historial y al análisis del Coach.</p>
      <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 24px;"><strong>El negocio inmobiliario se mide por actividad.</strong> InmoCoach es el único sistema que lo hace automáticamente.</p>
      <div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px;">
        <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:4px;">Plan Individual</div>
        <div style="font-size:28px;font-weight:900;color:#111827;font-family:Georgia,serif;">$10.500<span style="font-size:14px;font-weight:400;color:#9ca3af;">/mes</span></div>
        <div style="font-size:12px;color:#6b7280;margin-top:4px;">Cancelás cuando querés · sin permanencia</div>
      </div>
      <div style="text-align:center;margin-bottom:12px;">
        <a href="https://inmocoach.com.ar/pricing" style="display:inline-block;background:${RED};color:white;font-weight:900;font-size:15px;padding:16px 40px;border-radius:12px;text-decoration:none;">Activar mi plan ahora →</a>
      </div>
      <div style="text-align:center;font-size:12px;color:#9ca3af;">¿Tenés dudas? Respondé este mail y te ayudamos.</div>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #f3f4f6;text-align:center;font-size:11px;color:#9ca3af;">InmoCoach · <a href="https://inmocoach.com.ar" style="color:#9ca3af;text-decoration:none;">inmocoach.com.ar</a></div>
  </div>
</div></body></html>`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!isSuperAdmin(session?.user?.email)) return res.status(403).end();

  const day = parseInt(req.query.day as string) || 3;
  const email = session!.user!.email!;

  // Datos reales del admin
  const { data: sub } = await supabaseAdmin.from("subscriptions").select("name").eq("email", email).single();
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  const { count } = await supabaseAdmin.from("calendar_events")
    .select("*", { count: "exact", head: true })
    .eq("user_email", email).eq("is_productive", true)
    .gte("start_at", weekStart.toISOString());

  const name = sub?.name || email;
  const greenTotal = count ?? 0;
  const iacGoal = 15;

  const html = day === 5
    ? buildDay5Html(name, greenTotal, iacGoal)
    : buildDay3Html(name, greenTotal, iacGoal);

  // Devolver HTML directo para preview en browser
  res.setHeader("Content-Type", "text/html");
  res.status(200).send(html);
}
