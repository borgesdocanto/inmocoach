import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const { totals, productivityRate, productiveDays, totalDays, productivityGoal } = req.body;

  const prompt = `Sos Insta Coach, un coach de ventas inmobiliarias argentino, directo y motivador. Como si fueras un colega que sabe mucho y te habla con confianza de igual a igual.

Analizá este embudo y dá un consejo concreto en 3-4 oraciones. Sin listas, solo párrafos. Usá segunda persona, hablale de vos a vos. Motivá a actuar HOY con una acción específica.

DATOS:
- Tasaciones: ${totals.tasaciones}
- Visitas: ${totals.visitas}
- Propuestas de valor: ${totals.propuestas}
- Reuniones: ${totals.reuniones}
- Total eventos productivos (verdes): ${totals.totalGreen}
- Meta diaria: ${productivityGoal} eventos verdes
- Días productivos: ${productiveDays} de ${totalDays} (${productivityRate}%)

Identificá el cuello de botella más crítico y dá el consejo más valioso y específico que puedas.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content?.map((b: any) => b.text || "").join("") || "";

    if (!text) return res.status(500).json({ error: "Sin respuesta del coach" });

    return res.status(200).json({ advice: text });
  } catch (err: any) {
    console.error("Insta Coach error:", err);
    return res.status(500).json({ error: "Error al generar el análisis" });
  }
}
