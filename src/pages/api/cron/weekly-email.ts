import { NextApiRequest, NextApiResponse } from "next";
import { Resend } from "resend";
import { getAllActiveSubscriptions } from "../../../lib/subscription";
import { fetchCalendarEvents, computeWeekStats } from "../../../lib/calendarSync";
import { generateWeeklyEmailHtml } from "../../../lib/emailTemplate";
import { supabaseAdmin } from "../../../lib/supabase";
import { getValidAccessToken } from "../../../lib/googleToken";
import { FREEMIUM_DAYS, PRODUCTIVITY_GOAL } from "../../../lib/brand";
import { getPlanById } from "../../../lib/plans";

const resend = new Resend(process.env.RESEND_API_KEY!);

// Genera el consejo del Inmo Coach para el mail
async function generateCoachAdvice(stats: ReturnType<typeof computeWeekStats>, name: string): Promise<string> {
  const prompt = `Sos Inmo Coach, un coach de ventas inmobiliarias argentino, directo, motivador y sin vueltas. Como si fueras un colega que sabe mucho y te habla con confianza.

Analizá esta semana de ${name} y escribí un consejo de 3-4 oraciones. Sin listas, solo párrafos. Usá segunda persona, hablale de vos a vos. Motivá a mejorar la semana que viene con una acción concreta.

SEMANA:
- Eventos productivos (verdes): ${stats.greenTotal} (meta diaria: ${PRODUCTIVITY_GOAL})
- Tasaciones: ${stats.tasaciones}
- Visitas: ${stats.visitas}  
- Propuestas de valor: ${stats.propuestas}
- Días productivos: ${stats.productiveDays} de ${stats.totalDays} (${stats.productivityRate}%)

Sé específico con los números. Si estuvo bien, celebralo y desafialo a más. Si estuvo flojo, decíselo sin rodeos y dale LA acción más importante para mejorar.`;

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
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    return data.content?.map((b: any) => b.text || "").join("") || "Esta semana es una oportunidad. Arrancá el lunes con 10 eventos verdes en el día y vas a sentir la diferencia.";
  } catch {
    return "Esta semana es una oportunidad. Arrancá el lunes con 10 eventos verdes en el día y vas a sentir la diferencia.";
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verificar cron secret para que no lo llame cualquiera
  const cronSecret = req.headers["x-cron-secret"];
  if (cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "No autorizado" });
  }

  console.log("🔄 Iniciando sync y envío de mails semanales...");

  const { targetEmail } = req.body || {};
  let subscriptions = await getAllActiveSubscriptions();
  if (targetEmail) {
    subscriptions = subscriptions.filter(s => s.email === targetEmail);
    console.log(`📧 Enviando solo a ${targetEmail}`);
  }
  console.log(`📋 ${subscriptions.length} usuarios activos encontrados`);

  const results = { sent: 0, failed: 0, skipped: 0 };

  for (const sub of subscriptions) {
    try {
      // Obtener token válido — refresca automáticamente si expiró
      const accessToken = await getValidAccessToken(sub.email);
      if (!accessToken) {
        console.log(`⚠️  Sin token válido para ${sub.email}`);
        results.skipped++;
        continue;
      }

      // Buscar created_at para calcular días freemium
      const { data: tokenData } = await supabaseAdmin
        .from("subscriptions")
        .select("created_at")
        .eq("email", sub.email)
        .single();

      // Paso 1: Sync completo del calendar
      console.log(`📅 Sincronizando calendar de ${sub.email}...`);
      const events = await fetchCalendarEvents(accessToken, 90);

      // Paso 2: Calcular stats de la semana
      const stats = computeWeekStats(events, PRODUCTIVITY_GOAL);

      // Paso 3: Generar consejo del Inmo Coach
      console.log(`🧠 Generando consejo para ${sub.email}...`);
      const coachAdvice = await generateCoachAdvice(stats, sub.name || sub.email);

      // Paso 4: Calcular días restantes si es freemium
      const createdAt = new Date(tokenData?.created_at ?? sub.email);
      const daysUsed = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      const daysLeft = Math.max(0, Math.ceil(FREEMIUM_DAYS - daysUsed));
      const isExpiringSoon = sub.plan === "free" && daysLeft <= 2;

      const plan = getPlanById(sub.plan);

      // Paso 5: Enviar mail
      const html = generateWeeklyEmailHtml({
        userName: sub.name || sub.email,
        email: sub.email,
        weekDates: stats.weekDates,
        greenTotal: stats.greenTotal,
        tasaciones: stats.tasaciones,
        visitas: stats.visitas,
        propuestas: stats.propuestas,
        productiveDays: stats.productiveDays,
        totalDays: stats.totalDays,
        productivityRate: stats.productivityRate,
        coachAdvice,
        planName: plan.name,
        isExpiringSoon,
        daysLeft,
      });

      const { data: sendData, error: sendError } = await resend.emails.send({
        from: "Inmo Coach <coach@inmocoach.com.ar>",
        to: sub.email,
        subject: `Tu semana en números: ${stats.productivityRate}% productividad — ${stats.weekDates}`,
        html,
      });

      if (sendError) {
        console.error(`❌ Resend error para ${sub.email}:`, JSON.stringify(sendError));
        results.failed++;
        continue;
      }
      console.log(`✅ Mail enviado a ${sub.email} — id: ${sendData?.id}`);
      results.sent++;

      // Rate limiting: pequeña pausa entre mails
      await new Promise(r => setTimeout(r, 200));

    } catch (err: any) {
      console.error(`❌ Error con ${sub.email}:`, err.message);
      results.failed++;
    }
  }

  console.log(`\n📊 Resultado: ${results.sent} enviados, ${results.failed} errores, ${results.skipped} sin token`);

  return res.status(200).json({
    ok: true,
    ...results,
    total: subscriptions.length,
  });
}
