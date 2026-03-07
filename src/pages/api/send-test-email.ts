import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { Resend } from "resend";
import { fetchCalendarEvents, computeWeekStats } from "../../lib/calendarSync";
import { generateWeeklyEmailHtml } from "../../lib/emailTemplate";
import { PRODUCTIVITY_GOAL } from "../../lib/brand";
import { getOrCreateSubscription } from "../../lib/subscription";
import { getPlanById } from "../../lib/plans";

const resend = new Resend(process.env.RESEND_API_KEY!);

async function generateCoachAdvice(stats: ReturnType<typeof computeWeekStats>, name: string): Promise<string> {
  const firstName = name.split(" ")[0];
  const prompt = `Sos Insta Coach, un coach de ventas inmobiliarias argentino, directo y motivador. Como si fueras un colega que sabe mucho y habla con confianza de igual a igual.

Analizá esta semana de ${firstName} y escribí un consejo de 3-4 oraciones. Sin listas, solo párrafos. Usá segunda persona, usá su nombre cuando hables directamente. Motivá a mejorar la semana que viene con una acción concreta.

SEMANA:
- Eventos productivos (verdes): ${stats.greenTotal} (meta diaria: ${PRODUCTIVITY_GOAL})
- Tasaciones: ${stats.tasaciones}
- Visitas: ${stats.visitas}
- Propuestas de valor: ${stats.propuestas}
- Días productivos: ${stats.productiveDays} de ${stats.totalDays} (${stats.productivityRate}%)

Sé específico con los números. Si estuvo bien, celebralo y desafialo a más. Si estuvo flojo, decíselo sin rodeos y dale LA acción más importante.`;

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
  return data.content?.map((b: any) => b.text || "").join("") || "Esta semana es una oportunidad. Arrancá el lunes con 10 eventos verdes y vas a sentir la diferencia.";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const accessToken = (session as any).accessToken;
  if (!accessToken) return res.status(400).json({ error: "Sin token de Calendar" });

  try {
    // 1. Sync calendar
    const events = await fetchCalendarEvents(accessToken, 30);

    // 2. Stats de la semana
    const stats = computeWeekStats(events, PRODUCTIVITY_GOAL);

    // 3. Coach advice
    const userName = session.user.name || session.user.email;
    const coachAdvice = await generateCoachAdvice(stats, userName);

    // 4. Subscription info
    const sub = await getOrCreateSubscription(session.user.email, session.user.name ?? undefined);
    const plan = getPlanById(sub.plan);

    // 5. Generar y enviar mail
    const html = generateWeeklyEmailHtml({
      userName,
      email: session.user.email,
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
    });

    const result = await resend.emails.send({
      from: "Insta Coach <onboarding@resend.dev>",
      to: session.user.email,
      subject: `Tu informe semanal — ${stats.productivityRate}% productividad · ${stats.weekDates}`,
      html,
    });

    return res.status(200).json({ ok: true, emailId: result.data?.id, stats });
  } catch (err: any) {
    console.error("Test email error:", err);
    return res.status(500).json({ error: err.message });
  }
}
