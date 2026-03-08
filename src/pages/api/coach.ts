import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { supabaseAdmin } from "../../lib/supabase";

const WEEKLY_GOAL = 15;

function diagnose(greenTotal: number, goal: number, productiveDays: number, totalDays: number): string {
  if (greenTotal === 0) return "semana_sin_actividad";
  if (greenTotal >= goal) return "semana_productiva";
  if (greenTotal >= goal * 0.5) return "semana_ocupada";
  if (productiveDays <= 1) return "semana_reactiva";
  return "semana_riesgo";
}

// Genera la clave única del período: "week:2025-W04" o "month:2025-01"
function buildPeriodKey(calView: string, periodStart: string): string {
  if (calView === "month") {
    return `month:${periodStart.slice(0, 7)}`; // "month:2025-01"
  }
  // Para semana usamos la fecha de inicio de la semana
  return `week:${periodStart}`; // "week:2025-01-27"
}

// Un período está cerrado si su fecha de fin es anterior a hoy
function isClosed(periodEnd: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return periodEnd < today;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const {
    dailySummaries, productivityGoal, userName,
    periodStart, periodEnd, calView, goal, periodLabel,
    forceRegenerate = false,
    checkCacheOnly = false,
  } = req.body;

  if (!dailySummaries || !Array.isArray(dailySummaries)) {
    return res.status(400).json({ error: "Faltan datos del calendario" });
  }

  const userEmail = session.user.email;
  const effectiveGoal = goal || WEEKLY_GOAL;
  const isMonthly = calView === "month";
  const start = periodStart || (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); })();
  const end = periodEnd || new Date().toISOString().slice(0, 10);
  const periodKey = buildPeriodKey(calView, start);
  const closed = isClosed(end);

  // ── Buscar informe guardado ───────────────────────────────────────────────
  const { data: cached } = await supabaseAdmin
    .from("coach_reports")
    .select("*")
    .eq("user_email", userEmail)
    .eq("period_key", periodKey)
    .single();

  // Si solo queremos verificar cache (carga automática al cambiar período)
  if (checkCacheOnly) {
    if (cached) {
      return res.status(200).json({
        advice: cached.advice,
        profile: cached.profile,
        weekTotals: cached.week_totals,
        fromCache: true,
        isClosed: closed,
      });
    }
    return res.status(200).json({ fromCache: false });
  }

  // Si existe y el período está cerrado (y no se forzó regenerar) → devolver cache
  if (cached && (closed || !forceRegenerate)) {
    return res.status(200).json({
      advice: cached.advice,
      profile: cached.profile,
      weekTotals: cached.week_totals,
      fromCache: true,
      isClosed: closed,
    });
  }

  // ── Calcular métricas ─────────────────────────────────────────────────────
  const periodSummaries = (dailySummaries as any[]).filter(d => d.date >= start && d.date <= end);
  const allEvents = periodSummaries.flatMap((d: any) => d.events || []);
  const greenEvents = allEvents.filter((e: any) => e.isGreen);

  const totals = {
    totalGreen: greenEvents.length,
    tasaciones: greenEvents.filter((e: any) => e.type === "tasacion").length,
    visitas: greenEvents.filter((e: any) => e.type === "visita").length,
    propuestas: greenEvents.filter((e: any) => e.type === "propuesta").length,
    reuniones: greenEvents.filter((e: any) => e.type === "reunion").length,
  };

  const productiveDays = periodSummaries.filter((d: any) => d.greenCount >= (productivityGoal || 2)).length;
  const totalDays = periodSummaries.length || 1;
  const productivityRate = Math.round((productiveDays / totalDays) * 100);
  const faltaron = Math.max(0, effectiveGoal - totals.totalGreen);
  const perfil = diagnose(totals.totalGreen, effectiveGoal, productiveDays, totalDays);

  const firstName = (userName || "").split(" ")[0] || "";
  const nombreStr = firstName ? `El nombre del usuario es ${firstName}.` : "";

  const eventLines = periodSummaries.map((d: any) => {
    const fecha = new Date(d.date + "T12:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });
    const evs = (d.events || []).map((e: any) => `    ${e.isGreen ? "🟢" : "⚪"} ${e.title}`).join("\n");
    return `  ${fecha} (${d.greenCount} verdes):\n${evs || "    Sin eventos"}`;
  }).join("\n");

  const perfilDescripcion: Record<string, string> = {
    semana_sin_actividad: "SIN ACTIVIDAD COMERCIAL — no hubo ningún evento productivo.",
    semana_productiva: "PERÍODO PRODUCTIVO — superó la meta de referencia.",
    semana_ocupada: "OCUPADO PERO INSUFICIENTE — actividad por debajo de la meta.",
    semana_reactiva: "PERÍODO REACTIVO — actividad concentrada en muy pocos días.",
    semana_riesgo: "RIESGO COMERCIAL — nivel insuficiente que compromete resultados futuros.",
  };

  const periodoStr = isMonthly
    ? `el mes de ${periodLabel} (meta: ${effectiveGoal} reuniones = 15/semana × 4 semanas)`
    : `los últimos 7 días (meta: ${effectiveGoal} reuniones semanales)`;
  const accionLabel = isMonthly ? "LA ACCIÓN PARA EL PRÓXIMO MES" : "LA ACCIÓN PARA ESTA SEMANA";

  const prompt = `Sos InstaCoach, entrenador de productividad comercial que analiza agendas reales. ${nombreStr}

Hablás en segunda persona, tono directo, claro y constructivo. Nunca juzgás, siempre orientás. Español rioplatense (vos, tenés, hacés). Usás el nombre cuando corresponde.

PERÍODO ANALIZADO: ${periodoStr}

EVENTOS REALES:
${eventLines}

MÉTRICAS:
- Reuniones comerciales (verdes): ${totals.totalGreen} de ${effectiveGoal} de referencia
- Tasaciones: ${totals.tasaciones}
- Visitas: ${totals.visitas}
- Propuestas de valor: ${totals.propuestas}
- Días con actividad: ${productiveDays} de ${totalDays} (${productivityRate}%)
- Diagnóstico: ${perfilDescripcion[perfil]}
- Reuniones que faltaron: ${faltaron}

EMBUDO (mayor a menor importancia): Tasaciones → Propuestas → Visitas → Reuniones en total

RESPONDÉ con exactamente 3 bloques separados por línea en blanco. Sin títulos ni bullets:

BLOQUE 1 — LO QUE HICISTE BIEN: Algo real y concreto de este período. Máximo 2 oraciones.

BLOQUE 2 — DÓNDE PERDÉS OPORTUNIDADES: El cuello de botella principal con números reales. 2-3 oraciones.

BLOQUE 3 — ${accionLabel}: Una sola acción específica y ejecutable. Basada en los eventos reales. Máximo 2 oraciones.

Después, en línea separada:
"Número crítico: en ${periodLabel} tuviste ${totals.totalGreen} reuniones comerciales. ${faltaron > 0 ? `Te faltaron ${faltaron} para alcanzar el objetivo de ${effectiveGoal}.` : `Superaste el objetivo de ${effectiveGoal}. El desafío ahora es sostenerlo.`}"`;

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

    // ── Guardar en Supabase ───────────────────────────────────────────────
    await supabaseAdmin
      .from("coach_reports")
      .upsert({
        user_email: userEmail,
        period_key: periodKey,
        period_label: periodLabel,
        period_start: start,
        period_end: end,
        is_closed: closed,
        advice: text,
        profile: perfil,
        week_totals: totals,
        green_total: totals.totalGreen,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_email,period_key" });

    return res.status(200).json({
      advice: text,
      profile: perfil,
      faltaron,
      weekTotals: totals,
      productiveDays,
      totalDays,
      fromCache: false,
      isClosed: closed,
    });

  } catch (err: any) {
    console.error("Insta Coach error:", err);
    return res.status(500).json({ error: "Error al generar el análisis" });
  }
}
