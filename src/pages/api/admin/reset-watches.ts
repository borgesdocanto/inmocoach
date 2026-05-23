// Endpoint admin: cancela todos los watches activos y los re-registra con la URL correcta
// Usar cuando cambia la URL del webhook (como en este fix)
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { requireSuperAdmin } from "../../../lib/adminGuard";
import { supabaseAdmin } from "../../../lib/supabase";
import { stopCalendarWatch, registerCalendarWatch } from "../../../lib/calendarWatch";
import { getValidAccessToken } from "../../../lib/googleToken";
import { google } from "googleapis";

export const config = { maxDuration: 300 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  const guard = await requireSuperAdmin(session);
  if (guard) return res.status(guard.status).json({ error: guard.error });

  // 1. Obtener todos los channels activos
  const { data: channels } = await supabaseAdmin
    .from("calendar_watch_channels")
    .select("*");

  console.log(`[reset-watches] Cancelando ${channels?.length ?? 0} channels...`);

  // 2. Cancelar cada channel en Google
  let stopped = 0;
  let stopFailed = 0;
  for (const ch of channels || []) {
    try {
      await stopCalendarWatch(ch.channel_id, ch.resource_id, ch.user_email);
      stopped++;
    } catch {
      stopFailed++;
    }
  }

  // 3. Borrar todos los channels de la DB
  await supabaseAdmin.from("calendar_watch_channels").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // 4. Re-registrar watches para todos los usuarios activos y trial con refresh token
  const { isFreeExpired } = await import("../../../lib/brand");
  const { data: users } = await supabaseAdmin
    .from("subscriptions")
    .select("email, plan, status, created_at, trial_ends_at, google_refresh_token")
    .in("status", ["active", "trial"])
    .not("google_refresh_token", "is", null);

  const validUsers = (users || []).filter(u => !isFreeExpired(u));
  console.log(`[reset-watches] Re-registrando watches para ${validUsers.length} usuarios...`);

  let registered = 0;
  let regFailed = 0;
  for (const user of validUsers) {
    const ok = await registerCalendarWatch(user.email);
    if (ok) registered++;
    else regFailed++;
    await new Promise(r => setTimeout(r, 500)); // rate limiting
  }

  return res.status(200).json({
    ok: true,
    stopped,
    stopFailed,
    registered,
    regFailed,
    totalUsers: validUsers.length,
  });
}
