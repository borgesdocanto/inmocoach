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

  // 1. DB info
  const { count: totalCount } = await supabaseAdmin
    .from("calendar_events").select("*", { count: "exact", head: true }).eq("user_email", email);

  const { data: oldest } = await supabaseAdmin
    .from("calendar_events").select("start_at").eq("user_email", email).order("start_at", { ascending: true }).limit(1);
  const { data: newest } = await supabaseAdmin
    .from("calendar_events").select("start_at").eq("user_email", email).order("start_at", { ascending: false }).limit(1);

  const { data: weekEvents } = await supabaseAdmin
    .from("calendar_events").select("title, start_at, is_productive, is_organizer, event_type")
    .eq("user_email", email).gte("start_at", "2026-03-09T00:00:00Z").lte("start_at", "2026-03-15T23:59:59Z").order("start_at");

  // 2. Fetch directo a Google para comparar
  let googleEvents: any[] = [];
  let googleError = null;
  let pages = 0;
  try {
    const accessToken = await getValidAccessToken(email);
    if (accessToken) {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const calendar = google.calendar({ version: "v3", auth });
      const now = new Date();
      const timeMin = formatISO(startOfDay(subDays(now, 90)));
      const timeMax = formatISO(addDays(now, 30));

      let pageToken: string | undefined;
      do {
        const response: any = await calendar.events.list({
          calendarId: "primary", timeMin, timeMax,
          singleEvents: true, orderBy: "startTime", maxResults: 2500,
          ...(pageToken ? { pageToken } : {}),
        });
        googleEvents.push(...(response.data.items || []));
        pageToken = response.data.nextPageToken ?? undefined;
        pages++;
      } while (pageToken);
    }
  } catch (e: any) {
    googleError = e.message;
  }

  // Filtrar semana 9-15 mar desde Google
  const googleWeek = googleEvents.filter(e => {
    const start = e.start?.dateTime || e.start?.date || "";
    return start >= "2026-03-09" && start <= "2026-03-15T23:59:59";
  });

  return res.status(200).json({
    db: {
      total_events: totalCount,
      oldest: oldest?.[0]?.start_at,
      newest: newest?.[0]?.start_at,
      week_count: weekEvents?.length,
      week_events: weekEvents?.map(e => ({
        title: e.title,
        start_ar: new Date(e.start_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
        type: e.event_type, green: e.is_productive, organizer: e.is_organizer,
      })),
    },
    google: {
      total_fetched: googleEvents.length,
      pages_fetched: pages,
      error: googleError,
      week_count: googleWeek.length,
      week_events: googleWeek.map(e => ({
        title: e.summary,
        start: e.start?.dateTime || e.start?.date,
        organizer_self: e.organizer?.self,
        status: e.status,
        colorId: e.colorId,
      })),
    },
  });
}
