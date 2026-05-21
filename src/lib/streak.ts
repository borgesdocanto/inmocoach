import { supabaseAdmin } from "./supabase";
import { getAppConfig } from "./appConfig";
import { sendPushToUser } from "./webpush";

function isWeekday(date: Date): boolean {
  const d = date.getDay();
  return d !== 0 && d !== 6;
}

function prevWeekday(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  do { d.setDate(d.getDate() - 1); } while (!isWeekday(d));
  return d.toISOString().slice(0, 10);
}

function localDateStr(d: Date = new Date()): string {
  const ar = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return ar.toISOString().slice(0, 10);
}

export interface StreakData {
  current: number;
  best: number;
  lastActiveDate: string | null;
  todayActive: boolean;
  minGreens: number;
  shields: number;
  shieldUsed: boolean;
}

export async function computeAndSaveStreak(
  email: string,
  _dailySummaries: Array<{ date: string; greenCount: number }>,
  teamId?: string | null
): Promise<StreakData> {

  const config = await getAppConfig(teamId);
  const MIN_GREENS = parseInt(config["streak_min_greens"] ?? "1");

  const from = new Date();
  from.setDate(from.getDate() - 365);

  const { data: events } = await supabaseAdmin
    .from("calendar_events")
    .select("start_at")
    .eq("user_email", email)
    .eq("is_productive", true)
    .gte("start_at", from.toISOString())
    .order("start_at");

  const countByDay: Record<string, number> = {};
  for (const ev of events || []) {
    const dateStr = localDateStr(new Date(ev.start_at));
    countByDay[dateStr] = (countByDay[dateStr] || 0) + 1;
  }

  const activeDays = new Set(
    Object.entries(countByDay)
      .filter(([date, count]) => isWeekday(new Date(date + "T12:00:00")) && count >= MIN_GREENS)
      .map(([date]) => date)
  );

  const todayStr = localDateStr();
  const todayActive = activeDays.has(todayStr);

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("streak_current, streak_best, streak_shields")
    .eq("email", email)
    .single();

  const prevStreakCurrent = sub?.streak_current ?? 0;
  let shields = sub?.streak_shields ?? 0;
  let shieldUsed = false;

  // Calcular racha actual desde hoy hacia atrás
  let cursor = todayStr;
  if (!isWeekday(new Date(cursor + "T12:00:00"))) {
    cursor = prevWeekday(cursor);
  }

  const allDates = Object.keys(countByDay).sort();
  const oldest = allDates[0] ?? todayStr;

  let current = 0;
  while (cursor >= oldest) {
    if (activeDays.has(cursor)) {
      current++;
      cursor = prevWeekday(cursor);
    } else if (cursor === todayStr && !todayActive) {
      cursor = prevWeekday(cursor);
    } else {
      break;
    }
  }

  // Protector automático: si tenía racha, hoy no tiene eventos y ayer tampoco
  const lastWeekday = prevWeekday(todayStr);
  const brokStreak = prevStreakCurrent > 0 && current === 0 && !todayActive && !activeDays.has(lastWeekday);

  if (brokStreak && shields > 0) {
    shields -= 1;
    shieldUsed = true;
    current = prevStreakCurrent;
    try {
      await sendPushToUser(email, {
        title: "🛡️ Protector de racha usado",
        body: `Perdiste un día sin reuniones pero tenías un protector. Tu racha de ${current} días sigue en pie. Te quedan ${shields} protector${shields !== 1 ? "es" : ""}.`,
        url: "/",
      });
    } catch { /* silencioso */ }
  }

  // Mejor racha histórica
  const weekdays = allDates
    .filter(d => isWeekday(new Date(d + "T12:00:00")))
    .sort();

  let best = current;
  let tempStreak = 0;
  let prevDay: string | null = null;

  for (const day of weekdays) {
    if (activeDays.has(day)) {
      if (prevDay !== null && prevWeekday(day) === prevDay) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
      if (tempStreak > best) best = tempStreak;
      prevDay = day;
    } else {
      tempStreak = 0;
      prevDay = null;
    }
  }

  const finalBest = Math.max(best, sub?.streak_best ?? 0, current);

  // Protectores ganados cada 10 días
  const prevMilestone = Math.floor(prevStreakCurrent / 10);
  const newMilestone = Math.floor(current / 10);
  if (newMilestone > prevMilestone && current > prevStreakCurrent) {
    const earned = newMilestone - prevMilestone;
    shields += earned;
    try {
      await sendPushToUser(email, {
        title: "🛡️ ¡Ganaste un protector de racha!",
        body: `Llegaste a ${current} días de racha. Tenés ${shields} protector${shields !== 1 ? "es" : ""} guardado${shields !== 1 ? "s" : ""}.`,
        url: "/",
      });
    } catch { /* silencioso */ }
  }

  await supabaseAdmin
    .from("subscriptions")
    .update({
      streak_current: current,
      streak_best: finalBest,
      streak_last_active_date: todayActive ? todayStr : (current > 0 ? prevWeekday(todayStr) : null),
      streak_shields: shields,
    })
    .eq("email", email);

  return { current, best: finalBest, lastActiveDate: todayActive ? todayStr : null, todayActive, minGreens: MIN_GREENS, shields, shieldUsed };
}
