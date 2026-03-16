import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { isSuperAdmin } from "../../../lib/adminGuard";
import { supabaseAdmin } from "../../../lib/supabase";
import { getGoals } from "../../../lib/appConfig";
import { PROCESOS_GOAL, CARTERA_GOAL, EFECTIVIDAD, calcIAC, proyectarOperaciones } from "../../../lib/calendarSync";

export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!isSuperAdmin(session?.user?.email)) return res.status(403).end();

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt requerido" });

  // Tomar datos reales de leandro — última semana completa
  const adminEmail = session!.user!.email!;
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) - 7); // lunes semana pasada
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23, 59, 59, 999);

  const { data: events } = await supabaseAdmin
    .from("calendar_events")
    .select("title, start_at, is_productive, event_type, is_proceso, is_cierre")
    .eq("user_email", adminEmail)
    .gte("start_at", monday.toISOString())
    .lte("start_at", sunday.toISOString())
    .order("start_at");

  const { weeklyGoal } = await getGoals();
  const green = (events || []).filter(e => e.is_productive);
  const totalGreen = green.length;
  const procesosNuevos = green.filter(e => e.is_proceso).length;
  const tasaciones = green.filter(e => e.event_type === "tasacion").length;
  const primerasVisitas = green.filter(e => e.event_type === "primera_visita").length;
  const fotosVideo = green.filter(e => e.event_type === "fotos_video").length;
  const visitas = green.filter(e => ["visita","conocer","primera_visita"].includes(e.event_type)).length;
  const propuestas = green.filter(e => e.event_type === "propuesta").length;
  const firmas = green.filter(e => e.is_cierre).length;
  const reuniones = green.filter(e => e.event_type === "reunion").length;
  const iac = Math.min(100, Math.round((totalGreen / weeklyGoal) * 100));
  const faltanReuniones = Math.max(0, weeklyGoal - totalGreen);
  const faltanProcesos = Math.max(0, PROCESOS_GOAL - procesosNuevos);
  const procesosXSemana = Math.round(procesosNuevos * 10) / 10;
  const operacionesProyectadas = proyectarOperaciones(procesosXSemana, 1);
  const periodLabel = `${monday.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}`;

  const byDay: Record<string, string[]> = {};
  (events || []).filter(e => e.is_productive).forEach(e => {
    const d = e.start_at.slice(0, 10);
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(e.title);
  });
  const eventLines = Object.entries(byDay).map(([date, titles]) => {
    const d = new Date(date + "T12:00:00");
    const label = d.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });
    return `  ${label} (${titles.length} verdes):\n${titles.map(t => `    🟢 ${t}`).join("\n")}`;
  }).join("\n") || "  Sin actividad comercial registrada";

  const { data: subData } = await supabaseAdmin.from("subscriptions").select("name").eq("email", adminEmail).single();
  const userName = subData?.name || adminEmail.split("@")[0];
  const firstName = userName.split(" ")[0];

  const fullPrompt = `${prompt}

El nombre del agente es ${firstName}.

LAS 3 VARIABLES QUE MIDEN EL NEGOCIO:
1. IAC = reuniones cara a cara / ${weeklyGoal} por semana — Objetivo: 100% = ${weeklyGoal} reuniones/semana
2. Procesos nuevos: objetivo ${PROCESOS_GOAL} por semana
3. Cartera activa vendible: ${CARTERA_GOAL} propiedades (no medible por agenda)

LÓGICA: Efectividad ${EFECTIVIDAD * 100}% — 6 procesos = 1 transacción

PERÍODO: semana del ${periodLabel} (objetivo: ${weeklyGoal} reuniones, ${PROCESOS_GOAL} procesos)

EVENTOS REALES:
${eventLines}

MÉTRICAS:
- Reuniones cara a cara: ${totalGreen} de ${weeklyGoal} objetivo
- IAC: ${iac}% (${iac >= 100 ? "✓ En objetivo" : `faltan ${faltanReuniones} reuniones`})
- Procesos nuevos: ${procesosNuevos} de ${PROCESOS_GOAL} (${faltanProcesos > 0 ? `faltan ${faltanProcesos}` : "✓"})
  - Tasaciones: ${tasaciones} | Primeras visitas: ${primerasVisitas} | Fotos/video: ${fotosVideo}
- Visitas: ${visitas} | Propuestas: ${propuestas} | Firmas: ${firmas} | Reuniones: ${reuniones}`;

  const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 600, messages: [{ role: "user", content: fullPrompt }] }),
  });
  const aiData = await aiRes.json();
  const advice = aiData.content?.map((b: any) => b.text || "").join("") || "Error generando análisis";

  return res.status(200).json({ advice, periodLabel, totalGreen, iac, weeklyGoal });
}
