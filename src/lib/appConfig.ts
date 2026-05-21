import { supabaseAdmin } from "./supabase";

// Cache en memoria separado por team_id (null = global)
// Key del cache: "global" o el team_id
const caches: Record<string, { data: Record<string, string>; at: number }> = {};
const TTL = 5 * 60 * 1000;

/**
 * Obtiene la configuración efectiva para un team_id dado.
 * Lógica: override del team (si existe) > valor global de plataforma > default hardcodeado.
 *
 * Siempre pasar team_id cuando se llama desde un contexto de usuario autenticado.
 * Si team_id es null/undefined se devuelve solo la config global.
 */
export async function getAppConfig(teamId?: string | null): Promise<Record<string, string>> {
  const now = Date.now();

  // Cargar config global (team_id IS NULL)
  const globalKey = "global";
  if (!caches[globalKey] || now - caches[globalKey].at > TTL) {
    const { data } = await supabaseAdmin
      .from("app_config")
      .select("key, value")
      .is("team_id", null);
    const map: Record<string, string> = {};
    for (const row of data ?? []) map[row.key] = row.value;
    caches[globalKey] = { data: map, at: now };
  }
  const globalConfig = caches[globalKey].data;

  // Sin team_id: devolver solo global
  if (!teamId) return { ...globalConfig };

  // Cargar override del team
  const teamKey = teamId;
  if (!caches[teamKey] || now - caches[teamKey].at > TTL) {
    const { data } = await supabaseAdmin
      .from("app_config")
      .select("key, value")
      .eq("team_id", teamId);
    const map: Record<string, string> = {};
    for (const row of data ?? []) map[row.key] = row.value;
    caches[teamKey] = { data: map, at: now };
  }
  const teamConfig = caches[teamKey].data;

  // Merge: global como base, team override encima
  return { ...globalConfig, ...teamConfig };
}

export function invalidateAppConfig(teamId?: string | null) {
  delete caches["global"];
  if (teamId) delete caches[teamId];
}

/**
 * Obtiene metas para un team específico.
 * Siempre pasar team_id para obtener valores correctos por tenant.
 */
export async function getGoals(teamId?: string | null): Promise<{
  weeklyGoal: number;
  productiveDayMin: number;
}> {
  const config = await getAppConfig(teamId);
  return {
    weeklyGoal: parseInt(config["weekly_goal"] ?? "15"),
    productiveDayMin: parseInt(config["productive_day_min"] ?? "2"),
  };
}
