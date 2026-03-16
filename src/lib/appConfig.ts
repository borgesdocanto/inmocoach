import { supabaseAdmin } from "./supabase";

// Cache en memoria — se invalida cada 5 minutos
let cache: Record<string, string> | null = null;
let cacheAt = 0;
const TTL = 5 * 60 * 1000;

export async function getAppConfig(): Promise<Record<string, string>> {
  if (cache && Date.now() - cacheAt < TTL) return cache;
  const { data } = await supabaseAdmin.from("app_config").select("key, value");
  cache = {};
  for (const row of data || []) cache[row.key] = row.value;
  cacheAt = Date.now();
  return cache;
}

export function invalidateAppConfig() { cache = null; }

// Defaults si no están en DB
export async function getGoals(): Promise<{ weeklyGoal: number; productiveDayMin: number }> {
  const config = await getAppConfig();
  return {
    weeklyGoal: parseInt(config["weekly_goal"] ?? "15"),
    productiveDayMin: parseInt(config["productive_day_min"] ?? "2"),
  };
}
