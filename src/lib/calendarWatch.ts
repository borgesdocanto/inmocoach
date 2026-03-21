/**
 * Google Calendar Push Notifications (Watch API)
 *
 * Cuando un usuario crea/modifica/elimina un evento, Google llama a
 * POST /api/webhooks/google-calendar con el channel ID.
 * Nosotros lo mapeamos al usuario y disparamos un sync inmediato.
 *
 * Los watchers expiran en máximo 7 días → un cron los renueva.
 */
import { google } from "googleapis";
import { supabaseAdmin } from "./supabase";
import { getValidAccessToken } from "./googleToken";
const WATCH_TTL_MS = 6 * 24 * 60 * 60 * 1000; // 6 días (Google max 7, renovamos antes)

function getWebhookUrl(): string {
  const base = process.env.NEXTAUTH_URL || "";
  return `${base}/api/webhooks/google-calendar`;
}

/**
 * Registra (o renueva) un watcher en el calendario primario del usuario.
 * Si ya tiene uno vigente, no hace nada.
 */
export async function registerOrRenewWatch(email: string): Promise<void> {
  // Verificar si ya tiene un watch vigente (con más de 1 hora de vida restante)
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("watch_channel_id, watch_resource_id, watch_expiry, google_access_token")
    .eq("email", email)
    .single();

  if (!sub?.google_access_token) return; // sin token, no podemos registrar

  const expiryMs = sub?.watch_expiry ? new Date(sub.watch_expiry).getTime() : 0;
  const stillValid = expiryMs > Date.now() + 60 * 60 * 1000; // válido por más de 1 hora
  if (stillValid) return;

  // Si tenía un watch anterior, intentar detenerlo (best-effort)
  if (sub?.watch_channel_id && sub?.watch_resource_id) {
    await stopWatch(email, sub.watch_channel_id, sub.watch_resource_id).catch(() => {});
  }

  const accessToken = await getValidAccessToken(email);
  if (!accessToken) return;

  const channelId = crypto.randomUUID();
  const expiry = Date.now() + WATCH_TTL_MS;

  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: "v3", auth });

    const response = await calendar.events.watch({
      calendarId: "primary",
      requestBody: {
        id: channelId,
        type: "web_hook",
        address: getWebhookUrl(),
        expiration: String(expiry),
      },
    });

    const resourceId = response.data.resourceId ?? "";
    const googleExpiry = response.data.expiration
      ? new Date(Number(response.data.expiration)).toISOString()
      : new Date(expiry).toISOString();

    await supabaseAdmin
      .from("subscriptions")
      .update({
        watch_channel_id: channelId,
        watch_resource_id: resourceId,
        watch_expiry: googleExpiry,
      })
      .eq("email", email);

    console.log(`[watch] Registered for ${email}, channel ${channelId}, expires ${googleExpiry}`);
  } catch (err: any) {
    // No interrumpir el flujo si el watch falla (dominio no verificado en dev, etc.)
    console.warn(`[watch] Could not register for ${email}:`, err?.message);
  }
}

/**
 * Detiene un watcher existente en Google.
 */
export async function stopWatch(email: string, channelId: string, resourceId: string): Promise<void> {
  const accessToken = await getValidAccessToken(email);
  if (!accessToken) return;
  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: "v3", auth });
    await calendar.channels.stop({ requestBody: { id: channelId, resourceId } });
  } catch (err: any) {
    console.warn(`[watch] Stop failed for ${email}:`, err?.message);
  }
}

/**
 * Renueva todos los watches que expiran en las próximas 24 horas.
 * Llamado por el cron /api/cron/renew-watches.
 */
export async function renewExpiringWatches(): Promise<{ renewed: number; errors: number }> {
  const threshold = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: users } = await supabaseAdmin
    .from("subscriptions")
    .select("email, watch_channel_id, watch_resource_id, watch_expiry")
    .not("google_access_token", "is", null)
    .or(`watch_expiry.is.null,watch_expiry.lt.${threshold}`);

  if (!users?.length) return { renewed: 0, errors: 0 };

  let renewed = 0;
  let errors = 0;

  for (const user of users) {
    try {
      // Forzar renovación limpiando el watch_expiry para que registerOrRenewWatch lo recree
      await supabaseAdmin
        .from("subscriptions")
        .update({ watch_expiry: null })
        .eq("email", user.email);

      await registerOrRenewWatch(user.email);
      renewed++;
    } catch {
      errors++;
    }
  }

  return { renewed, errors };
}
