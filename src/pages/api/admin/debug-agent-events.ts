import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { isSuperAdmin } from "../../../lib/adminGuard";
import { getValidAccessToken } from "../../../lib/googleToken";
import { google } from "googleapis";
import { formatISO, startOfDay, subDays, addDays } from "date-fns";

export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!isSuperAdmin(session?.user?.email)) return res.status(403).end();

  const email = req.query.email as string;
  if (!email) return res.status(400).json({ error: "email requerido" });

  const accessToken = await getValidAccessToken(email);
  if (!accessToken) return res.status(200).json({ error: "no token" });

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const cal = google.calendar({ version: "v3", auth });

  const timeMin = "2026-03-08T00:00:00-03:00";
  const timeMax = "2026-03-15T00:00:00-03:00";

  // Listar TODOS los calendarios sin filtrar por rol
  let allCalendars: any[] = [];
  let calListError = null;
  try {
    const calList = await cal.calendarList.list({ maxResults: 50 });
    allCalendars = (calList.data.items || []).map(c => ({
      id: c.id, name: c.summary, primary: !!c.primary, role: c.accessRole,
    }));
  } catch (e: any) { calListError = e.message; }

  // Fetch eventos de TODOS los calendarios (no solo owner/writer)
  const results: any[] = [];
  const calIds = allCalendars.length > 0 ? allCalendars.map(c => c.id!) : ["primary"];

  for (const calId of calIds) {
    const events: any[] = [];
    let err = null;
    try {
      let pageToken: string | undefined;
      do {
        const r: any = await cal.events.list({
          calendarId: calId, timeMin, timeMax,
          singleEvents: true, orderBy: "startTime", maxResults: 250,
          ...(pageToken ? { pageToken } : {}),
        });
        events.push(...(r.data.items || []).filter((e: any) => e.status !== "cancelled" && e.summary));
        pageToken = r.data.nextPageToken ?? undefined;
      } while (pageToken);
    } catch (e: any) { err = e.message; }

    results.push({
      calendarId: calId,
      name: allCalendars.find(c => c.id === calId)?.name ?? calId,
      role: allCalendars.find(c => c.id === calId)?.role,
      primary: allCalendars.find(c => c.id === calId)?.primary ?? false,
      error: err,
      count: events.length,
      events: events.map(e => ({
        title: e.summary,
        start: e.start?.dateTime || e.start?.date,
        organizer_email: e.organizer?.email,
        organizer_self: e.organizer?.self ?? "MISSING",
      })),
    });
  }

  // DB esta semana
  const { data: dbEvents } = await supabaseAdmin
    .from("calendar_events").select("title, start_at, is_productive, event_type")
    .eq("user_email", email)
    .gte("start_at", "2026-03-08T00:00:00Z").lte("start_at", "2026-03-15T00:00:00Z")
    .order("start_at");

  return res.status(200).json({
    calListError,
    all_calendars: allCalendars,
    google_per_calendar: results,
    db: {
      this_week: dbEvents?.length,
      events: dbEvents?.map(e => ({
        title: e.title,
        start: new Date(e.start_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
        green: e.is_productive, type: e.event_type,
      })),
    },
  });
}
