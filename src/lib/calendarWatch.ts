// Google Calendar Push Notifications — registra y renueva watches por usuario
import { google } from "googleapis";
import { supabaseAdmin } from "./supabase";
import { getValidAccessToken } from "./googleToken";

const WEBHOOK_URL = `https://www.inmocoach.com.ar/api/webhooks/calendar`;

// Registrar (o renovar) un watch para todos los calendarios de un usuario
export async function registerCalendarWatch(email: string): Promise<boolean> {
  const accessToken = await getValidAccessToken(email);
  if (!accessToken) return false;

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth });

  // Obtener todos los calendarios propios
  let calendarIds: string[] = ["primary"];
  try {
    const list = await calendar.calendarList.list();
    const owned = (list.data.items || []).filter(
      c => c.accessRole === "owner" || c.accessRole === "writer"
    );
    if (owned.length > 0) calendarIds = owned.map(c => c.id!);
  } catch {}

  let registered = 0;

  for (const calId of calendarIds) {
    try {
      const channelId = `ic-${email.replace(/[@.]/g, "-")}-${calId.replace(/[@.]/g, "-")}-${Date.now()}`;

      const response = await calendar.events.watch({
        calendarId: calId,
        requestBody: {
          id: channelId,
          type: "web_hook",
          address: WEBHOOK_URL,
          // TTL 7 días en ms
          expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const expiration = response.data.expiration
        ? new Date(parseInt(response.data.expiration)).toISOString()
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // Borrar channel anterior para este user+calendar si existe
      await supabaseAdmin
        .from("calendar_watch_channels")
        .delete()
        .eq("user_email", email)
        .eq("calendar_id", calId);

      // Guardar nuevo channel
      await supabaseAdmin.from("calendar_watch_channels").insert({
        user_email: email,
        channel_id: channelId,
        resource_id: response.data.resourceId,
        calendar_id: calId,
        expiration,
      });

      registered++;
    } catch (e: any) {
      console.warn(`[calendarWatch] watch failed for ${email} calId=${calId}:`, e?.message);
    }
  }

  return registered > 0;
}

// Detener un watch channel (llamar antes de renovar)
export async function stopCalendarWatch(channelId: string, resourceId: string, email: string): Promise<void> {
  const accessToken = await getValidAccessToken(email);
  if (!accessToken) return;

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth });

  try {
    await calendar.channels.stop({
      requestBody: { id: channelId, resourceId },
    });
  } catch (e: any) {
    console.warn(`[calendarWatch] stop failed for channel ${channelId}:`, e?.message);
  }
}

// Renovar channels que vencen en las próximas 24hs
export async function renewExpiringWatches(): Promise<{ renewed: number; failed: number }> {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: expiring } = await supabaseAdmin
    .from("calendar_watch_channels")
    .select("user_email, channel_id, resource_id, calendar_id")
    .lt("expiration", tomorrow);

  let renewed = 0;
  let failed = 0;

  const emailSet = new Set<string>(); (expiring || []).forEach(c => emailSet.add(c.user_email)); const emails = Array.from(emailSet);

  for (const email of emails) {
    const ok = await registerCalendarWatch(email);
    if (ok) renewed++;
    else failed++;
    await new Promise(r => setTimeout(r, 500));
  }

  return { renewed, failed };
}
