import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { getOrCreateSubscription, isFreemiumExpired } from "../../lib/subscription";
import { supabaseAdmin } from "../../lib/supabase";
import { IAC_GOAL, PROCESOS_GOAL, CARTERA_GOAL, EFECTIVIDAD, calcIAC, proyectarOperaciones } from "../../lib/calendarSync";
import { getGoals } from "../../lib/appConfig";
import { DEFAULT_COACH_PROMPT } from "./admin/coach-prompt";

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

  // Verificar que el usuario tiene acceso activo
  const sub = await getOrCreateSubscription(userEmail);
  if (isFreemiumExpired(sub)) {
    return res.status(403).json({ error: "Tu prueba gratuita terminó. Activá tu plan para usar el coach." });
  }

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
  const { weeklyGoal, productiveDayMin } = await getGoals();

  // Cargar prompt configurable desde DB
  const { data: promptRow } = await supabaseAdmin
    .from("app_config").select("value").eq("key", "coach_prompt").single();
  const coachSystemPrompt = promptRow?.value ?? DEFAULT_COACH_PROMPT;
  const periodSummaries = (dailySummaries as any[]).filter(d => d.date >= start && d.date <= end);
  const allEvents = periodSummaries.flatMap((d: any) => d.events || []);
  const greenEvents = allEvents.filter((e: any) => e.isGreen);

  const efectiveGoal = goal || weeklyGoal;
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
  const iacGoalPeriodo = isMonthly ? weeklyGoal * 4 : weeklyGoal;
  const faltanReuniones = Math.max(0, iacGoalPeriodo - totals.totalGreen);
  const faltanProcesos = Math.max(0, PROCESOS_GOAL * semanas - totals.procesosNuevos);

  const productiveDays = periodSummaries.filter((d: any) => (d.greenCount || 0) >= (productivityGoal || productiveDayMin)).length;
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
    ? `el mes de ${periodLabel} (objetivo: ${iacGoalPeriodo} reuniones = ${weeklyGoal}/semana × 4 semanas, ${PROCESOS_GOAL * 4} procesos nuevos)`
    : `la semana del ${periodLabel} (objetivo: ${weeklyGoal} reuniones cara a cara, ${PROCESOS_GOAL} procesos nuevos)`;

  // Obtener datos de cartera Tokko si el equipo está conectado (silencioso — no bloquea si falla)
  let tokkoSection = "";
  try {
    const { data: teamSub } = await supabaseAdmin
      .from("subscriptions").select("team_id").eq("email", userEmail).single();
    if (teamSub?.team_id) {
      const { data: team } = await supabaseAdmin
        .from("teams").select("tokko_api_key").eq("id", teamSub.team_id).single();
      if (team?.tokko_api_key) {
        const { data: tokkoAgent } = await supabaseAdmin
          .from("tokko_agents").select("tokko_id")
          .eq("team_id", teamSub.team_id).ilike("email", userEmail).single();
        if (tokkoAgent?.tokko_id) {
          const { data: props } = await supabaseAdmin
            .from("tokko_properties")
            .select("status, photos_count, days_since_update")
            .eq("team_id", teamSub.team_id)
            .eq("producer_id", tokkoAgent.tokko_id);
          if (props && props.length > 0) {
            const active = props.filter((p: any) => p.status === 2);
            const stale = active.filter((p: any) => (p.days_since_update || 0) > 30);
            const goodPhotos = active.filter((p: any) => (p.photos_count || 0) >= 15);
            const avgDays = stale.length
              ? Math.round(stale.reduce((s: number, p: any) => s + (p.days_since_update || 0), 0) / stale.length)
              : 0;
            tokkoSection = `\nCARTERA DE PROPIEDADES (datos de Tokko Broker):\n- Propiedades disponibles: ${active.length}\n- Con ficha completa (≥15 fotos): ${goodPhotos.length} de ${active.length}\n- Sin actualizar hace más de 30 días: ${stale.length}${stale.length > 0 ? ` (promedio ${avgDays} días sin editar)` : ""}\n${stale.length > 0 ? "⚠ Tiene propiedades abandonadas que podrían frenar operaciones." : "✓ Cartera al día."}`;
          }
        }
      }
    }
  } catch { /* silencioso — Tokko es opcional */ }

  // Prompt = parte configurable (de DB) + datos dinámicos del período
  const prompt = `${coachSystemPrompt}\n\n${nombreStr}\n\nLAS 3 VARIABLES QUE MIDEN EL NEGOCIO:
1. IAC = reuniones cara a cara / ${weeklyGoal} por semana — Objetivo: 100% = ${weeklyGoal} reuniones/semana
2. Procesos nuevos: objetivo ${PROCESOS_GOAL} por semana
3. Cartera activa vendible: ${CARTERA_GOAL} propiedades (no medible por agenda)

LÓGICA: Efectividad ${EFECTIVIDAD * 100}% — 6 procesos = 1 transacción

PERÍODO ANALIZADO: ${periodoStr}

EVENTOS REALES DEL PERÍODO:
${eventLines}

MÉTRICAS:
- Reuniones cara a cara (verdes): ${totals.totalGreen} de ${iacGoalPeriodo} objetivo
- IAC: ${totals.iac}% (${totals.iac >= 100 ? "✓ En objetivo" : `faltan ${faltanReuniones} reuniones`})
- Procesos nuevos: ${totals.procesosNuevos} de ${PROCESOS_GOAL * semanas} objetivo (${faltanProcesos > 0 ? `faltan ${faltanProcesos}` : "✓ En objetivo"})
  - Tasaciones: ${totals.tasaciones} | Primeras visitas: ${totals.primerasVisitas} | Fotos/video: ${totals.fotosVideo}
- Visitas: ${totals.visitas} | Propuestas: ${totals.propuestas} | Firmas: ${totals.firmas} | Reuniones: ${totals.reuniones}
- Días con actividad: ${productiveDays} de ${totalDays}
- Diagnóstico: ${perfilDescripcion[perfil]}
${tokkoSection}

Después del análisis, en línea separada:
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
    console.error("Inmo Coach error:", err);
    return res.status(500).json({ error: "Error al generar el análisis" });
  }
}
