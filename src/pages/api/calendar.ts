import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { google } from "googleapis";
import { startOfDay, endOfDay, subDays, formatISO } from "date-fns";

// ─── Colores de Google Calendar que se consideran "VERDE" ──────────────────
// Google usa colorId del 1 al 11. Verde = "2" (Sage), "10" (Basil), "5" (Banana no, ese es amarillo)
// Referencia: https://developers.google.com/calendar/api/v3/reference/colors
const GREEN_COLOR_IDS = new Set(["2", "10"]); // Sage y Basil

// Palabras clave en el título que identifican eventos productivos
const PRODUCTIVE_KEYWORDS = [
  "tasacion", "tasación",
  "visita",
  "propuesta",
  "reunion", "reunión",
  "meeting",
  "seguimiento",
  "cierre",
  "entrevista",
];

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  colorId?: string;
  isGreen: boolean;
  type: "tasacion" | "visita" | "propuesta" | "reunion" | "otro";
  attendees: string[];
}

export interface DailySummary {
  date: string;           // "2025-06-12"
  greenCount: number;
  events: CalendarEvent[];
  isProductive: boolean;  // >= PRODUCTIVITY_GOAL
}

function detectType(title: string): CalendarEvent["type"] {
  const t = title.toLowerCase();
  if (t.includes("tasac")) return "tasacion";
  if (t.includes("visit")) return "visita";
  if (t.includes("propuesta")) return "propuesta";
  if (t.includes("reuni") || t.includes("meeting")) return "reunion";
  return "otro";
}

function isGreenEvent(event: any): boolean {
  // Verde por colorId
  if (event.colorId && GREEN_COLOR_IDS.has(event.colorId)) return true;
  // Verde por palabra clave en título
  const title = (event.summary || "").toLowerCase();
  return PRODUCTIVE_KEYWORDS.some(kw => title.includes(kw));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "No autenticado" });

  const accessToken = (session as any).accessToken;
  if (!accessToken) return res.status(401).json({ error: "Sin token de Calendar" });

  const days = parseInt(req.query.days as string) || 30;

  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: "v3", auth });

    const now = new Date();
    const timeMin = formatISO(startOfDay(subDays(now, days)));
    const timeMax = formatISO(endOfDay(now));

    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 500,
    });

    const items = response.data.items || [];

    // Mapear y filtrar
    const mappedEvents: CalendarEvent[] = items
      .filter(e => e.status !== "cancelled" && e.summary)
      .map(e => ({
        id: e.id!,
        title: e.summary!,
        start: e.start?.dateTime || e.start?.date || "",
        end: e.end?.dateTime || e.end?.date || "",
        colorId: e.colorId,
        isGreen: isGreenEvent(e),
        type: detectType(e.summary!),
        attendees: (e.attendees || [])
          .filter(a => !a.self)
          .map(a => a.email || a.displayName || ""),
      }));

    // Agrupar por día
    const byDay: Record<string, CalendarEvent[]> = {};
    mappedEvents.forEach(ev => {
      const day = ev.start.slice(0, 10);
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(ev);
    });

    const productivityGoal = parseInt(process.env.NEXT_PUBLIC_PRODUCTIVITY_GOAL || "10");

    const dailySummaries: DailySummary[] = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, events]) => {
        const greenCount = events.filter(e => e.isGreen).length;
        return {
          date,
          greenCount,
          events,
          isProductive: greenCount >= productivityGoal,
        };
      });

    // Totales por tipo
    const greenEvents = mappedEvents.filter(e => e.isGreen);
    const totals = {
      tasaciones: greenEvents.filter(e => e.type === "tasacion").length,
      visitas: greenEvents.filter(e => e.type === "visita").length,
      propuestas: greenEvents.filter(e => e.type === "propuesta").length,
      reuniones: greenEvents.filter(e => e.type === "reunion").length,
      otros: greenEvents.filter(e => e.type === "otro").length,
      totalGreen: greenEvents.length,
      totalEvents: mappedEvents.length,
    };

    const productiveDays = dailySummaries.filter(d => d.isProductive).length;
    const totalDays = dailySummaries.length;

    return res.status(200).json({
      user: {
        name: session.user?.name,
        email: session.user?.email,
        image: session.user?.image,
      },
      syncedAt: new Date().toISOString(),
      period: { from: timeMin, to: timeMax, days },
      totals,
      productivityGoal,
      productiveDays,
      totalDays,
      productivityRate: totalDays > 0 ? Math.round((productiveDays / totalDays) * 100) : 0,
      dailySummaries,
      recentEvents: mappedEvents.slice(-50).reverse(),
    });
  } catch (err: any) {
    console.error("Calendar API error:", err?.message);
    return res.status(500).json({ error: "Error al consultar Google Calendar", detail: err?.message });
  }
}
