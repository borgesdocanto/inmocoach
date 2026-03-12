import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { isSuperAdmin } from "../../../lib/adminGuard";
import { getValidAccessToken } from "../../../lib/googleToken";
import { google } from "googleapis";

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
  const calendar = google.calendar({ version: "v3", auth });

  const timeMin = "2026-03-09T00:00:00-03:00";
  const timeMax = "2026-03-15T23:59:59-03:00";

  // Intentar listar calendarios — puede fallar si el token es viejo
  let calendarIds: string[] = ["primary"];
  let calListError = null;
  let calendarNames: any[] = [];
  try {
    const calList = await calendar.calendarList.list();
    calendarNames = (calList.data.items || []).map(c => ({ id: c.id, name: c.summary, primary: c.primary }));
    calendarIds = calList.data.items?.map(c => c.id!) || ["primary"];
  } catch (e: any) {
    calListError = e.message;
    // Token viejo — solo tenemos primary
  }

  // Fetch eventos de cada calendario
  const results: any[] = [];
  for (const calId of calendarIds) {
    const events: any[] = [];
    let pageToken: string | undefined;
    let fetchError = null;
    try {
      do {
        const response: any = await calendar.events.list({
          calendarId: calId, timeMin, timeMax,
          singleEvents: true, orderBy: "startTime", maxResults: 250,
          ...(pageToken ? { pageToken } : {}),
        });
        events.push(...(response.data.items || []).filter((e: any) => e.status !== "cancelled" && e.summary));
        pageToken = response.data.nextPageToken ?? undefined;
      } while (pageToken);
    } catch (e: any) { fetchError = e.message; }

    results.push({
      calendarId: calId,
      calendarName: calendarNames.find(c => c.id === calId)?.name ?? calId,
      primary: calendarNames.find(c => c.id === calId)?.primary ?? (calId === "primary"),
      error: fetchError,
      event_count: events.length,
      events: events.map(e => ({
        title: e.summary,
        start: e.start?.dateTime || e.start?.date,
        organizer_self: e.organizer?.self ?? null,
      })),
    });
  }

  // DB info
  const { count } = await supabaseAdmin
    .from("calendar_events").select("*", { count: "exact", head: true }).eq("user_email", email);
  const { data: weekDb } = await supabaseAdmin
    .from("calendar_events").select("title, start_at, is_productive")
    .eq("user_email", email).gte("start_at", "2026-03-09T00:00:00Z").lte("start_at", "2026-03-15T23:59:59Z").order("start_at");

  return res.status(200).json({
    token_scope_issue: calListError,
    needs_relogin: !!calListError,
    calendars_found: calendarNames,
    google_results: results,
    db: { total: count, this_week: weekDb?.length, events: weekDb?.map(e => ({ title: e.title, start: e.start_at, green: e.is_productive })) },
  });
}
