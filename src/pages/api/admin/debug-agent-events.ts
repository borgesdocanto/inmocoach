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

  let result: any = { calendars: [], primary: {}, other_calendars: [] };
  
  try {
    const accessToken = await getValidAccessToken(email);
    if (!accessToken) return res.status(200).json({ error: "no token" });

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: "v3", auth });

    // 1. Listar TODOS los calendarios del usuario
    const calList = await calendar.calendarList.list();
    result.calendars = calList.data.items?.map(c => ({
      id: c.id,
      summary: c.summary,
      primary: c.primary,
      accessRole: c.accessRole,
    }));

    // 2. Fetch semana 9-15 mar de CADA calendario
    const timeMin = "2026-03-09T00:00:00-03:00";
    const timeMax = "2026-03-15T23:59:59-03:00";

    for (const cal of calList.data.items || []) {
      const events: any[] = [];
      let pageToken: string | undefined;
      do {
        const response: any = await calendar.events.list({
          calendarId: cal.id!, timeMin, timeMax,
          singleEvents: true, orderBy: "startTime", maxResults: 250,
          ...(pageToken ? { pageToken } : {}),
        });
        events.push(...(response.data.items || []).filter((e: any) => e.status !== "cancelled" && e.summary));
        pageToken = response.data.nextPageToken ?? undefined;
      } while (pageToken);

      if (events.length > 0 || cal.primary) {
        result.other_calendars.push({
          calendar: cal.summary,
          id: cal.id,
          primary: cal.primary,
          event_count_this_week: events.length,
          events: events.map(e => ({
            title: e.summary,
            start: e.start?.dateTime || e.start?.date,
            organizer_self: e.organizer?.self ?? null,
            organizer_email: e.organizer?.email,
          })),
        });
      }
    }
  } catch (e: any) {
    result.error = e.message;
  }

  return res.status(200).json(result);
}
