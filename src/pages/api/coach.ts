import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { supabaseAdmin } from "../../lib/supabase";
import { IAC_GOAL, PROCESOS_GOAL, CARTERA_GOAL, EFECTIVIDAD, calcIAC, proyectarOperaciones } from "../../lib/calendarSync";

function buildPeriodKey(calView: string, periodStart: string): string {
  if (calView === "month") return `month:${periodStart.slice(0, 7)}`;
  return `week:${periodStart}`;
}

function isClosed(periodEnd: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return periodEnd < today;
}

function diagnose(iac: number, procesosNuevos: number): string {
  if (iac === 0) return "sin_actividad";
  if (iac >= 100 && procesosNuevos >= PROCESOS_GOAL) return "motor_encendido";
  if (iac >= 100) return "activo_sin_procesos";
  if (iac >= 67 && procesosNuevos >= PROCESOS_GOAL) return "buen_ritmo";
  if (iac >= 67) return "activo_falta_enfoque";
  if (iac >= 33) return "ritmo_insuficiente";
  return "riesgo_pipeline";
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
  const isMonthly = calView === "month";
  const start = periodStart || (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); })();
  const end = periodEnd || new Date().toISOString().slice(0, 10);
  const periodKey = buildPeriodKey(calView, start);
  const closed = isClosed(end);

  // ── Cache ────────────────────────────────────────────────────────────────
  const { data: cached } = await supabaseAdmin
    .from("coach_reports")
    .select("*")
    .eq("user_email", userEmail)
    .eq("period_key", periodKey)
    .single();

  if (checkCacheOnly) {
    if (cached) return res.status(200).json({ advice: cached.advice, profile: cached.profile, weekTotals: cached.week_totals, fromCache: true, isClosed: closed });
    return res.status(200).json({ fromCache: false });
  }

  if (cached && (closed || !forceRegenerate)) {
    return res.status(200).json({ advice: cached.advice, profile: cached.profile, weekTotals: cached.week_totals, fromCache: true, isClosed: closed });
  }

  // ── Calcular métricas ─────────────────────────────────────────────────────
  const periodSummaries = (dailySummaries as any[]).filter(d => d.date >= start && d.date <= end);
  const allEvents = periodSummaries.flatMap((d: any) => d.events || []);
  const greenEvents = allEvents.filter((e: any) => e.isGreen);

  const efectiveGoal = goal || IAC_GOAL;
  const semanas = isMonthly ? 4 : 1;

  const totals = {
    totalGreen: greenEvents.length,
    iac: calcIAC(greenEvents.length / semanas),
    procesosNuevos: greenEvents.filter((e: any) => e.isProceso).length,
    tasaciones: greenEvents.filter((e: any) => e.type === "tasacion").length,
    primerasVisitas: greenEvents.filter((e: any) => e.type === "primera_visita").length,
    fotosVideo: greenEvents.filter((e: any) => e.type === "fotos_video").length,
    visitas: greenEvents.filter((e: any) => ["visita", "conocer", "primera_visita"].includes(e.type)).length,
    propuestas: greenEvents.filter((e: any) => e.type === "propuesta").length,
    firmas: greenEvents.filter((e: any) => e.isCierre || e.type === "firma").length,
    reuniones: greenEvents.filter((e: any) => e.type === "reunion").length,
  };

  const perfil = diagnose(totals.iac, totals.procesosNuevos / semanas);
  const procesosXSemana = Math.round((totals.procesosNuevos / semanas) * 10) / 10;
  const operacionesProyectadas = proyectarOperaciones(procesosXSemana, 1);
  const iacGoalPeriodo = isMonthly ? IAC_GOAL * 4 : IAC_GOAL;
  const faltanReuniones = Math.max(0, iacGoalPeriodo - totals.totalGreen);
  const faltanProcesos = Math.max(0, PROCESOS_GOAL * semanas - totals.procesosNuevos);

  const productiveDays = periodSummaries.filter((d: any) => (d.greenCount || 0) >= (productivityGoal || 2)).length;
  const totalDays = periodSummaries.length || 1;

  const firstName = (userName || "").split(" ")[0] || "";
  const nombreStr = firstName ? `El nombre del agente es ${firstName}.` : "";

  // Listado de eventos por día
  const eventLines = periodSummaries.map((d: any) => {
    const fecha = new Date(d.date + "T12:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });
    const evs = (d.events || []).filter((e: any) => e.isGreen).map((e: any) => {
      const tag = e.isProceso ? "🔵PROCESO" : e.isCierre ? "🏆CIERRE" : "🟢";
      return `    ${tag} ${e.title}`;
    }).join("\n");
    return `  ${fecha} (${d.greenCount} verdes):\n${evs || "    Sin actividad comercial"}`;
  }).join("\n");

  const perfilDescripcion: Record<string, string> = {
    sin_actividad: "SIN ACTIVIDAD — no hubo reuniones comerciales cara a cara.",
    motor_encendido: "MOTOR ENCENDIDO — IAC ≥ 100% y procesos nuevos en objetivo. El pipeline está activo.",
    activo_sin_procesos: "ACTIVO PERO SIN NUEVOS PROCESOS — muchas reuniones pero sin entrada de nuevos clientes al embudo.",
    buen_ritmo: "BUEN RITMO — IAC ≥ 67% y procesos en objetivo. Sostenible si se mantiene.",
    activo_falta_enfoque: "ACTIVO SIN FOCO — suficientes reuniones pero sin generar procesos nuevos concretos.",
    ritmo_insuficiente: "RITMO INSUFICIENTE — el volumen de actividad no sostiene el pipeline a largo plazo.",
    riesgo_pipeline: "RIESGO DE PIPELINE SECO — actividad mínima. Sin intervención, no hay operaciones en 60-90 días.",
  };

  const periodoStr = isMonthly
    ? `el mes de ${periodLabel} (objetivo: ${iacGoalPeriodo} reuniones = ${IAC_GOAL}/semana × 4 semanas, ${PROCESOS_GOAL * 4} procesos nuevos)`
    : `la semana del ${periodLabel} (objetivo: ${IAC_GOAL} reuniones cara a cara, ${PROCESOS_GOAL} procesos nuevos)`;

  const prompt = `Sos InstaCoach, entrenador de productividad comercial inmobiliaria. Analizás agendas reales con un modelo estadístico probado. ${nombreStr}

PRINCIPIO DEL MODELO:
No hay carga horaria en el negocio inmobiliario — hay cantidad de reuniones cara a cara.
Una persona puede trabajar 10 horas y no generar negocio. Otra puede tener 6 reuniones y mover todo el pipeline.

LAS 3 VARIABLES QUE MIDEN EL NEGOCIO:
1. IAC (Índice de Actividad Comercial) = reuniones cara a cara / ${IAC_GOAL} por semana
   Objetivo: 100% = ${IAC_GOAL} reuniones/semana
2. Procesos nuevos = personas que entran realmente al embudo (tasaciones, primeras visitas, inicio de fotos/video)
   Objetivo: ${PROCESOS_GOAL} por semana
3. Cartera activa vendible: ${CARTERA_GOAL} propiedades a precio justo (no medible por agenda, pero es el sustento)

LÓGICA ESTADÍSTICA:
- Efectividad promedio del mercado: ${EFECTIVIDAD * 100}%
- 6 procesos = 1 transacción
- ${PROCESOS_GOAL} procesos/semana sostenidos → operaciones predecibles
- Sin ${CARTERA_GOAL} propiedades activas, el agente prospecta desde cero constantemente

DIFERENCIA VERDE vs AMARILLO:
- Verde (produce dinero): reuniones, visitas, tasaciones, propuestas, fotos/video, firmas — cara a cara con personas reales
- Amarillo (no produce dinero): mails, redes, marketing, tareas admin, llamadas sin resultado comercial

PERÍODO ANALIZADO: ${periodoStr}

EVENTOS REALES DEL PERÍODO:
${eventLines}

MÉTRICAS:
- Reuniones cara a cara (verdes): ${totals.totalGreen} de ${iacGoalPeriodo} objetivo
- IAC: ${totals.iac}% (${totals.iac >= 100 ? "✓ En objetivo" : `faltan ${faltanReuniones} reuniones`})
- Procesos nuevos: ${totals.procesosNuevos} de ${PROCESOS_GOAL * semanas} objetivo (${faltanProcesos > 0 ? `faltan ${faltanProcesos}` : "✓ En objetivo"})
  - Tasaciones/captaciones: ${totals.tasaciones}
  - Primeras visitas: ${totals.primerasVisitas}
  - Fotos y video: ${totals.fotosVideo}
- Visitas totales: ${totals.visitas}
- Propuestas de valor: ${totals.propuestas}
- Cierres/firmas: ${totals.firmas}
- Reuniones genéricas: ${totals.reuniones}
- Días con actividad comercial: ${productiveDays} de ${totalDays}
- Procesos/semana: ${procesosXSemana} → proyección: ${operacionesProyectadas} operación(es) potencial(es) si se mantiene
- Diagnóstico: ${perfilDescripcion[perfil]}

RESPONDÉ en español rioplatense (vos, tenés, hacés). Tono directo, claro, sin juicios — siempre orientado a acción.
Usá el nombre cuando corresponda. Nunca inventes datos que no están en los eventos reales.

ESTRUCTURA — exactamente 3 bloques separados por línea en blanco, sin títulos ni bullets:

BLOQUE 1 — QUÉ HICISTE BIEN: algo real y concreto de este período. Máximo 2 oraciones.

BLOQUE 2 — EL CUELLO DE BOTELLA: dónde se frena el negocio, con números reales. Mencioná el IAC y los procesos. 2-3 oraciones.

BLOQUE 3 — LA ACCIÓN CONCRETA: una sola acción ejecutable esta ${isMonthly ? "semana" : "semana"}, basada en lo que se ve en la agenda. Máximo 2 oraciones.

Después, en línea separada, el número crítico:
"IAC ${periodLabel}: ${totals.iac}% — ${totals.totalGreen} reuniones cara a cara, ${totals.procesosNuevos} proceso${totals.procesosNuevos !== 1 ? "s" : ""} nuevo${totals.procesosNuevos !== 1 ? "s" : ""}. ${totals.iac >= 100 ? `Motor encendido. El desafío ahora es sostenerlo.` : `Para llegar al 100% necesitás ${faltanReuniones} reunión${faltanReuniones !== 1 ? "es" : ""} más.`}"`;

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
        max_tokens: 700,
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
