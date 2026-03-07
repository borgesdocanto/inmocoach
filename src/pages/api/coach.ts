import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";

const WEEKLY_GOAL_MEETINGS = 15; // reuniones comerciales semanales de referencia
const WEEKLY_GOAL_PROCESSES = 3;  // procesos nuevos por semana

function diagnose(greenTotal: number, productiveDays: number, totalDays: number): string {
  if (greenTotal === 0) return "semana_sin_actividad";
  if (greenTotal >= WEEKLY_GOAL_MEETINGS) return "semana_productiva";
  if (greenTotal >= 8) return "semana_ocupada";
  if (productiveDays <= 1) return "semana_reactiva";
  return "semana_riesgo";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const { dailySummaries, productivityGoal, userName } = req.body;

  if (!dailySummaries || !Array.isArray(dailySummaries)) {
    return res.status(400).json({ error: "Faltan datos del calendario" });
  }

  // Filtrar solo los últimos 7 días con actividad
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6); // últimos 7 días incl. hoy
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);

  const weekSummaries = (dailySummaries as any[]).filter(d => d.date >= sevenDaysAgoStr);

  // Calcular totales reales de la semana
  const allWeekEvents = weekSummaries.flatMap((d: any) => d.events || []);
  const greenWeekEvents = allWeekEvents.filter((e: any) => e.isGreen);

  const weekTotals = {
    totalGreen: greenWeekEvents.length,
    tasaciones: greenWeekEvents.filter((e: any) => e.type === "tasacion").length,
    visitas: greenWeekEvents.filter((e: any) => e.type === "visita").length,
    propuestas: greenWeekEvents.filter((e: any) => e.type === "propuesta").length,
    reuniones: greenWeekEvents.filter((e: any) => e.type === "reunion").length,
  };

  const productiveDays = weekSummaries.filter((d: any) => d.greenCount >= (productivityGoal || 2)).length;
  const totalDays = weekSummaries.length || 1;
  const productivityRate = Math.round((productiveDays / totalDays) * 100);

  const firstName = (userName || "").split(" ")[0] || "";
  const nombreStr = firstName ? `El nombre del usuario es ${firstName}.` : "";
  const faltaron = Math.max(0, WEEKLY_GOAL_MEETINGS - weekTotals.totalGreen);
  const perfil = diagnose(weekTotals.totalGreen, productiveDays, totalDays);

  // Construir lista de eventos para contexto
  const eventLines = weekSummaries.map((d: any) => {
    const fecha = new Date(d.date + "T12:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });
    const evs = (d.events || []).map((e: any) => `    ${e.isGreen ? "🟢" : "⚪"} ${e.title}`).join("\n");
    return `  ${fecha} (${d.greenCount} verdes):\n${evs || "    Sin eventos"}`;
  }).join("\n");

  const perfilDescripcion: Record<string, string> = {
    semana_sin_actividad: "SIN ACTIVIDAD COMERCIAL — no hubo ningún evento productivo. Situación crítica.",
    semana_productiva: "SEMANA PRODUCTIVA — superó el nivel de referencia.",
    semana_ocupada: "SEMANA OCUPADA PERO INSUFICIENTE — actividad por debajo del nivel necesario.",
    semana_reactiva: "SEMANA REACTIVA — actividad concentrada en muy pocos días, sin consistencia.",
    semana_riesgo: "SEMANA CON RIESGO COMERCIAL — nivel insuficiente que compromete resultados futuros.",
  };

  const prompt = `Sos InstaCoach, un entrenador de productividad comercial que analiza agendas reales. ${nombreStr}

Hablás en segunda persona, tono directo, claro y constructivo. Nunca juzgás, siempre orientás. Español rioplatense (vos, tenés, hacés). Usás el nombre cuando corresponde.

EVENTOS REALES DE LOS ÚLTIMOS 7 DÍAS:
${eventLines}

MÉTRICAS DE LA SEMANA:
- Reuniones comerciales (verdes): ${weekTotals.totalGreen} de ${WEEKLY_GOAL_MEETINGS} de referencia
- Tasaciones: ${weekTotals.tasaciones}
- Visitas: ${weekTotals.visitas}
- Propuestas de valor: ${weekTotals.propuestas}
- Días con actividad: ${productiveDays} de ${totalDays}
- Diagnóstico: ${perfilDescripcion[perfil]}
- Reuniones que faltaron para el óptimo: ${faltaron}

REGLAS DEL EMBUDO (de mayor a menor importancia):
1. Tasaciones — capturar propiedades para vender
2. Propuestas de valor entregadas — presentar al propietario
3. Visitas — llevar compradores a ver propiedades
4. Reuniones 1 a 1 cara a cara en total

RESPONDÉ con exactamente 3 bloques separados por línea en blanco. Sin títulos ni bullets, solo texto corrido:

BLOQUE 1 — LO QUE HICISTE BIEN: Reconocé algo real y concreto de esta semana. Si la semana fue floja, encontrá el punto de partida. Máximo 2 oraciones.

BLOQUE 2 — DÓNDE PERDÉS OPORTUNIDADES: El cuello de botella principal con números reales de esta semana. Qué actividad falta o está desequilibrada. 2-3 oraciones.

BLOQUE 3 — LA ACCIÓN CONCRETA: Una sola acción específica y ejecutable esta semana. No genérica — basada en los eventos reales que tuvo. Máximo 2 oraciones.

Después de los 3 bloques, en línea separada:
"Número crítico: esta semana tuviste ${weekTotals.totalGreen} reuniones comerciales. ${faltaron > 0 ? `Te faltaron ${faltaron} para alcanzar el nivel óptimo de ${WEEKLY_GOAL_MEETINGS}.` : `Superaste el nivel de referencia de ${WEEKLY_GOAL_MEETINGS}. Sostenerlo es el desafío.`}"`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Anthropic error:", JSON.stringify(data));
      return res.status(500).json({ error: `API error: ${data?.error?.message || response.status}` });
    }

    const text = data.content?.map((b: any) => b.text || "").join("") || "";
    if (!text) return res.status(500).json({ error: "Sin respuesta del coach" });

    return res.status(200).json({ advice: text, profile: perfil, faltaron, weekTotals, productiveDays, totalDays });
  } catch (err: any) {
    console.error("Insta Coach error:", err);
    return res.status(500).json({ error: "Error al generar el análisis" });
  }
}
