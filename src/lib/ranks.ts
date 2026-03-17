// Server-only — usa supabaseAdmin
import { supabaseAdmin } from "./supabase";
import { getAppConfig } from "./appConfig";
import { sendPushToUser } from "./webpush";
import type { Rank } from "./ranksConfig";
import { DEFAULT_RANKS, getRankBySlug, getNextRank, calcRankFromHistory } from "./ranksConfig";
export type { Rank };
export { getRankBySlug, getNextRank };

// Cargar rangos desde DB (con fallback a defaults)
export async function getRanksFromDB(): Promise<Rank[]> {
  const { data } = await supabaseAdmin
    .from("rank_config")
    .select("*")
    .order("sort_order");

  if (!data?.length) return DEFAULT_RANKS;

  return data.map(r => ({
    slug: r.slug,
    label: r.label,
    icon: r.icon,
    sortOrder: r.sort_order,
    minWeeks: r.min_weeks,
    minIacUp: r.min_iac_up,
    minIacKeep: r.min_iac_keep,
    minStreak: r.min_streak ?? undefined,
    description: DEFAULT_RANKS.find(d => d.slug === r.slug)?.description ?? "",
  }));
}

export async function saveWeeklyStatsAndRank(
  email: string,
  weekStart: string,
  iac: number,
  greenTotal: number,
  bestStreak: number
): Promise<Rank> {
  await supabaseAdmin.from("weekly_stats")
    .upsert({ email, week_start: weekStart, iac, green_total: greenTotal }, { onConflict: "email,week_start" });

  const [ranks, config, { data: sub }, { data: history }] = await Promise.all([
    getRanksFromDB(),
    getAppConfig(),
    supabaseAdmin.from("subscriptions").select("rank_slug").eq("email", email).single(),
    supabaseAdmin.from("weekly_stats").select("iac").eq("email", email)
      .order("week_start", { ascending: false }).limit(30),
  ]);

  const weeksToUp = parseInt(config["rank_weeks_to_up"] ?? "4");
  const weeksToDown = parseInt(config["rank_weeks_to_down"] ?? "2");
  const currentSlug = sub?.rank_slug ?? "junior";
  const recentIacs = (history ?? []).map(w => w.iac);

  const { rank: newRank, status } = calcRankFromHistory(recentIacs, currentSlug, weeksToUp, weeksToDown, ranks);

  const activeWeeks = recentIacs.filter(v => v > 0).length;
  const iacAvg = activeWeeks > 0 ? Math.round(recentIacs.filter(v => v > 0).reduce((s, v) => s + v, 0) / activeWeeks) : 0;

  await supabaseAdmin.from("subscriptions")
    .update({ rank_slug: newRank.slug, rank_updated_at: new Date().toISOString() })
    .eq("email", email);

  // Push si subió o bajó de rango
  if (status === "up" && newRank.slug !== currentSlug) {
    try {
      await sendPushToUser(email, {
        title: `${newRank.icon} ¡Subiste a ${newRank.label}!`,
        body: `Tu consistencia te llevó al siguiente nivel. Seguí así para mantenerlo.`,
        url: "/",
      });
    } catch { /* silencioso */ }
  } else if (status === "down" && newRank.slug !== currentSlug) {
    const prev = getRankBySlug(currentSlug, ranks);
    try {
      await sendPushToUser(email, {
        title: `📉 Bajaste a ${newRank.label}`,
        body: `Dos semanas seguidas bajo el umbral de ${prev.label}. Subí tu actividad para recuperarlo.`,
        url: "/",
      });
    } catch { /* silencioso */ }
  }

  return newRank;
}

export async function getAgentRankStats(email: string) {
  const [ranks, config, { data: sub }, { data: history }] = await Promise.all([
    getRanksFromDB(),
    getAppConfig(),
    supabaseAdmin.from("subscriptions").select("rank_slug, streak_best").eq("email", email).single(),
    supabaseAdmin.from("weekly_stats").select("iac, week_start").eq("email", email)
      .order("week_start", { ascending: false }).limit(30),
  ]);

  const weeksToUp = parseInt(config["rank_weeks_to_up"] ?? "4");
  const weeksToDown = parseInt(config["rank_weeks_to_down"] ?? "2");
  const currentSlug = sub?.rank_slug ?? "junior";
  const recentIacs = (history ?? []).map(w => w.iac);
  const activeWeeks = recentIacs.filter(v => v > 0).length;
  const iacAvg = activeWeeks > 0 ? Math.round(recentIacs.filter(v => v > 0).reduce((s, v) => s + v, 0) / activeWeeks) : 0;

  const { rank, status } = calcRankFromHistory(recentIacs, currentSlug, weeksToUp, weeksToDown, ranks);
  const nextRank = getNextRank(rank.slug, ranks);

  // Progreso hacia el próximo rango: cuántas semanas consecutivas sobre el umbral
  let weeksOnTrack = 0;
  if (nextRank) {
    for (const iacVal of recentIacs) {
      if (iacVal >= nextRank.minIacUp) weeksOnTrack++;
      else break;
    }
  }

  return {
    rank,
    nextRank,
    activeWeeks,
    iacAvg,
    bestStreak: sub?.streak_best ?? 0,
    status,
    weeksToUp,
    weeksToDown,
    weeksOnTrack,
    ranks, // todos los rangos para mostrar la escalera
  };
}
