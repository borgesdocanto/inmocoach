// Server-only — usa supabaseAdmin, NO importar desde cliente
import { supabaseAdmin } from "./supabase";
import type { Rank } from "./ranksConfig";
import { calcRank, getRankBySlug, getNextRank } from "./ranksConfig";
export type { Rank };
export { calcRank, getRankBySlug, getNextRank };

export async function saveWeeklyStatsAndRank(email: string, weekStart: string, iac: number, greenTotal: number, bestStreak: number): Promise<Rank> {
  await supabaseAdmin.from("weekly_stats").upsert({ email, week_start: weekStart, iac, green_total: greenTotal }, { onConflict: "email,week_start" });
  const { data: history } = await supabaseAdmin.from("weekly_stats").select("iac").eq("email", email).gt("iac", 0).order("week_start", { ascending: false }).limit(12);
  const activeWeeks = history?.length ?? 0;
  const iacAvg = activeWeeks > 0 ? Math.round(history!.reduce((s, w) => s + w.iac, 0) / activeWeeks) : 0;
  const rank = calcRank(activeWeeks, iacAvg, bestStreak);
  await supabaseAdmin.from("subscriptions").update({ rank_slug: rank.slug, rank_updated_at: new Date().toISOString() }).eq("email", email);
  return rank;
}

export async function getAgentRankStats(email: string) {
  const { data: sub } = await supabaseAdmin.from("subscriptions").select("rank_slug, streak_best").eq("email", email).single();
  const { data: history } = await supabaseAdmin.from("weekly_stats").select("iac").eq("email", email).gt("iac", 0).order("week_start", { ascending: false }).limit(12);
  const activeWeeks = history?.length ?? 0;
  const iacAvg = activeWeeks > 0 ? Math.round(history!.reduce((s, w) => s + w.iac, 0) / activeWeeks) : 0;
  const rank = getRankBySlug(sub?.rank_slug ?? "junior");
  return { rank, nextRank: getNextRank(rank.slug), activeWeeks, iacAvg, bestStreak: sub?.streak_best ?? 0 };
}
