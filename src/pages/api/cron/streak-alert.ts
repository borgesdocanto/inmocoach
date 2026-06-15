import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { sendPushToUser } from "../../../lib/webpush";
import { getAppConfig } from "../../../lib/appConfig";

export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Auth: CRON_SECRET (Vercel) O token externo (GitHub Actions via app_config)
  const authHeader = req.headers.authorization ?? "";
  const cronSecret = process.env.CRON_SECRET;
  let authorized = authHeader === `Bearer ${cronSecret}` || req.headers["x-cron-secret"] === cronSecret || req.query.secret === cronSecret;
  if (!authorized && authHeader.startsWith("Bearer ")) {
    const candidate = authHeader.slice(7);
    const { data: tokenRow } = await supabaseAdmin
      .from("app_config").select("value").eq("key", "systeme_cron_token")
      .is("team_id", null).maybeSingle();
    authorized = !!tokenRow?.value && tokenRow.value === candidate;
  }
  if (!authorized) return res.status(401).json({ error: "No autorizado" });

  const globalCfg = await getAppConfig(null);

  // Obtener todos los usuarios activos con racha > 0
  const { data: users } = await supabaseAdmin
    .from("subscriptions")
    .select("email, streak_current, streak_shields, team_id")
    .eq("status", "active")
    .gt("streak_current", 0);

  if (!users?.length) return res.status(200).json({ ok: true, checked: 0 });

  // Fecha local AR de hoy
  const now = new Date();
  const ar = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const todayStr = ar.toISOString().slice(0, 10);

  let alerted = 0;
  for (const user of users) {
    // Config del tenant del usuario (override > global)
    const cfg = await getAppConfig(user.team_id);
    const MIN_GREENS = parseInt(cfg["streak_min_greens"] ?? globalCfg["streak_min_greens"] ?? "1");

    // Ver si tiene al menos MIN_GREENS eventos verdes hoy
    const { count } = await supabaseAdmin
      .from("calendar_events")
      .select("*", { count: "exact", head: true })
      .eq("user_email", user.email)
      .eq("is_productive", true)
      .gte("start_at", `${todayStr}T00:00:00Z`)
      .lte("start_at", `${todayStr}T23:59:59Z`);

    if ((count ?? 0) < MIN_GREENS) {
      const shieldMsg = (user.streak_shields ?? 0) > 0
        ? ` Tenés ${user.streak_shields} protector${user.streak_shields !== 1 ? "es" : ""} guardado${user.streak_shields !== 1 ? "s" : ""}.`
        : "";
      try {
        await sendPushToUser(user.email, {
          title: "⚠️ Tu racha está en riesgo",
          body: `Llevás ${user.streak_current} días de racha. Agendá al menos ${MIN_GREENS} reunión verde hoy para no perderla.${shieldMsg}`,
          url: "/",
        });
        alerted++;
      } catch { /* silencioso */ }
    }
  }

  return res.status(200).json({ ok: true, checked: users.length, alerted });
}
