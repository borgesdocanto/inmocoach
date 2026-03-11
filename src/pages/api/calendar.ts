import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { google } from "googleapis";
import { startOfDay, endOfDay, subDays, addDays, formatISO } from "date-fns";
import { syncAndPersist, IAC_GOAL, PROCESOS_GOAL, calcIAC, getEventTypeConfig } from "../../lib/calendarSync";
import { supabaseAdmin } from "../../lib/supabase";
import { getAgentRankStats } from "../../lib/ranks";
import { computeAndSaveStreak } from "../../lib/streak";
import { saveWeeklyStatsAndRank } from "../../lib/ranks";
import { getValidAccessToken } from "../../lib/googleToken";

const GREEN_COLOR_IDS = new Set(["2", "10"]);

// Tipos que son siempre cara a cara (verde por keyword)
const ALWAYS_GREEN_KEYWORDS: [string[], string][] = [
  [["tasac", "captac"], "tasacion"],
  [["primera visita", "1ra visita", "1° visita"], "primera_visita"],
  [["foto", "video", "creacion de contenido", "creación de contenido"], "fotos_video"],
  [["propuesta", "presentacion", "presentación"], "propuesta"],
  [["firma", "escritura"], "firma"],
  [["conocer propiedad", "conocer prop"], "conocer"],
  [["visita"], "visita"],
  [["reuni", "meeting"], "reunion"],
];

// Solo verde si fue pintado por el usuario
const USER_ONLY_GREEN_KEYWORDS = ["prospecc", "prospección"];

// Siempre amarillo
const YELLOW_KEYWORDS = ["llamada", "call", "meet", "zoom", "teams", "videollamada", "capacitac", "entrena", "formac", "curso"];

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  colorId?: string;
  isGreen: boolean;
  isProceso: boolean;
  isCierre: boolean;
  isUserColored: boolean;
  type: string;
  attendees: string[];
}

export interface DailySummary {
  date: string;
  greenCount: number;
  procesosCount: number;
  events: CalendarEvent[];
  isProductive: boolean;
}

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function processEventDynamic(
  e: any,
  greenTypes: Set<string>,
  procesoTypes: Set<string>,
  cierreTypes: Set<string>,
  keywordsMap: Array<{ type: string; keywords: string[] }>
): Promise<CalendarEvent> {
  const t = normalize(e.summary || "");

  // Detectar tipo usando keywords dinámicos (DB) con fallback a hardcoded
  let type = "otro";
  const sorted = [...keywordsMap].sort((a, b) =>
    Math.max(...b.keywords.map(k => k.length)) - Math.max(...a.keywords.map(k => k.length))
  );
  for (const { type: ktype, keywords } of sorted) {
    if (keywords.some(kw => t.includes(kw))) { type = ktype; break; }
  }
  // Fallback estático si no matcheó ninguno
  if (type === "otro") {
    for (const [keywords, ktype] of ALWAYS_GREEN_KEYWORDS) {
      if (keywords.some(kw => t.includes(kw))) { type = ktype; break; }
    }
  }

  const isUserColored = !!(e.colorId && GREEN_COLOR_IDS.has(e.colorId));
  const isGreen = isUserColored || greenTypes.has(type);

  return {
    id: e.id!,
    title: e.summary!,
    start: e.start?.dateTime || e.start?.date || "",
    end: e.end?.dateTime || e.end?.date || "",
    colorId: e.colorId ?? undefined,
    isGreen,
    isProceso: isGreen && procesoTypes.has(type),
    isCierre: isGreen && cierreTypes.has(type),
    isUserColored,
    type,
    attendees: (e.attendees || []).filter((a: any) => !a.self).map((a: any) => a.email || a.displayName || ""),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "No autenticado" });

  const sessionToken = (session as any).accessToken;
  const accessToken = sessionToken || await getValidAccessToken(session.user!.email!);
  if (!accessToken) return res.status(401).json({ error: "Sin token de Calendar" });

  const requestedDays = parseInt(req.query.days as string) || 30;

  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: "v3", auth });

    // Determinar días a sincronizar — primera vez trae 180 días de historial
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("team_id, onboarding_done")
      .eq("email", session.user?.email!)
      .single();

    const isFirstSync = !sub?.onboarding_done;
    const days = isFirstSync ? 180 : requestedDays;

    const now = new Date();
    const timeMin = formatISO(startOfDay(subDays(now, days)));
    const timeMax = formatISO(endOfDay(addDays(now, 90))); // incluir reuniones futuras

    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 2500,
    });

    const items = response.data.items || [];
    // Usar config dinámica de tipos de evento (misma que calendarSync)
    const typeConfig = await getEventTypeConfig();
    const mappedEvents: CalendarEvent[] = await Promise.all(
      items
        .filter(e => e.status !== "cancelled" && e.summary)
        .map(e => processEventDynamic(e, typeConfig.green, typeConfig.procesos, typeConfig.cierres, typeConfig.keywordsMap))
    );

    await syncAndPersist(accessToken, session.user?.email!, sub?.team_id, days)
      .catch(e => console.error("Persist error:", e));

    // Agrupar por día
    const byDay: Record<string, CalendarEvent[]> = {};
    mappedEvents.forEach(ev => {
      const day = ev.start.slice(0, 10);
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(ev);
    });

    const productivityGoal = parseInt(process.env.NEXT_PUBLIC_PRODUCTIVITY_GOAL || "2");

    const dailySummaries: DailySummary[] = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, events]) => {
        const greenCount = events.filter(e => e.isGreen).length;
        const procesosCount = events.filter(e => e.isProceso).length;
        return { date, greenCount, procesosCount, events, isProductive: greenCount >= productivityGoal };
      });

    const greenEvents = mappedEvents.filter(e => e.isGreen);

    // Calcular semanas en el período para el IAC
    const semanas = Math.max(1, Math.ceil(days / 7));
    const avgPorSemana = greenEvents.length / semanas;

    const totals = {
      tasaciones: greenEvents.filter(e => e.type === "tasacion").length,
      primerasVisitas: greenEvents.filter(e => e.type === "primera_visita").length,
      fotosVideo: greenEvents.filter(e => e.type === "fotos_video").length,
      visitas: greenEvents.filter(e => ["visita", "conocer", "primera_visita"].includes(e.type)).length,
      propuestas: greenEvents.filter(e => e.type === "propuesta").length,
      firmas: greenEvents.filter(e => e.isCierre).length,
      reuniones: greenEvents.filter(e => e.type === "reunion").length,
      procesosNuevos: greenEvents.filter(e => e.isProceso).length,
      totalGreen: greenEvents.length,
      totalEvents: mappedEvents.length,
      iac: calcIAC(avgPorSemana),
      iacGoal: IAC_GOAL,
      procesosGoal: PROCESOS_GOAL,
    };

    const productiveDays = dailySummaries.filter(d => d.isProductive).length;
    const totalDays = dailySummaries.length;

    return res.status(200).json({
      user: { name: session.user?.name, email: session.user?.email, image: session.user?.image },
      syncedAt: new Date().toISOString(),
      period: { from: timeMin, to: timeMax, days },
      totals,
      productivityGoal,
      productiveDays,
      totalDays,
      productivityRate: totalDays > 0 ? Math.round((productiveDays / totalDays) * 100) : 0,
      dailySummaries,
      recentEvents: mappedEvents.slice(-50).reverse(),
      onboardingDone: sub?.onboarding_done ?? false,
      ...await (async () => {
        try {
          const streakData = await computeAndSaveStreak(session.user?.email!, dailySummaries);
          // Semana actual: lunes a hoy
          const now = new Date();
          const monday = new Date(now);
          monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
          monday.setHours(0, 0, 0, 0);
          const weekStart = monday.toISOString().slice(0, 10);
          // Contar eventos verdes de esta semana por fecha de inicio
          const weekGreen = mappedEvents.filter(e => e.isGreen && e.start.slice(0, 10) >= weekStart);
          const weekIac = Math.min(100, Math.round((weekGreen.length / 15) * 100));
          await saveWeeklyStatsAndRank(session.user?.email!, weekStart, weekIac, weekGreen.length, streakData?.best ?? 0);
          const rankStats = await getAgentRankStats(session.user?.email!);
          return { streak: streakData, rankStats };
        } catch (e) {
          console.error("streak/rank error:", e);
          return { streak: null, rankStats: null };
        }
      })(),
    });
  } catch (err: any) {
    console.error("Calendar API error:", err?.message);
    return res.status(500).json({ error: "Error al consultar Google Calendar", detail: err?.message });
  }
}
