/**
 * vps-sync/vps-sync.ts
 * Entrada ÚNICA del sync Tokko → Systeme.io para el VPS (sin el límite de 300s de Vercel).
 * Usa el mismo motor que Vercel (src/lib/systemeSync.ts), así hay una sola lógica.
 *
 *   node systeme-sync-node.cjs recent             → ventana de 3 días (CRON 1)
 *   node systeme-sync-node.cjs historic           → retrocede 7 días desde lo más antiguo (CRON 2)
 *   node systeme-sync-node.cjs recent --if-stale  → solo corre si no hubo una corrida OK en las últimas 20h
 *
 * Cada corrida deja UNA fila en sync_logs (trigger = "vps") con el resultado real.
 */
import "dotenv/config";
import { supabaseAdmin } from "../src/lib/supabase";
import { runSync, getOldestSyncedDate } from "../src/lib/systemeSync";

// Tolerancia a fallas de Tokko: reintentos por página con espera creciente + tope largo.
process.env.TOKKO_PAGE_RETRIES ??= "6";
process.env.TOKKO_FETCH_TIMEOUT_MS ??= String(30 * 60 * 1000);

const TEAM_ID = process.env.SYNC_TEAM_ID ?? "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93"; // GALAS
const MODE: "recent" | "historic" = process.argv[2] === "historic" ? "historic" : "recent";
const IF_STALE = process.argv.includes("--if-stale");
const RUN_ATTEMPTS = Math.max(1, Number(process.env.SYNC_RUN_ATTEMPTS ?? 3));
const RETRY_WAITS_MIN = [5, 15, 30]; // espera entre intentos completos
const STALE_AFTER_H = 20;
const STUCK_AFTER_MIN = 90;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const log = (msg: string) => console.log(`[vps-sync ${MODE}] ${new Date().toISOString()} ${msg}`);

async function main(): Promise<number> {
  // 0. Cerrar logs que quedaron "running" colgados (proceso muerto, reinicio del VPS, etc.)
  const stuckCutoff = new Date(Date.now() - STUCK_AFTER_MIN * 60_000).toISOString();
  await supabaseAdmin.from("sync_logs").update({
    status: "error",
    finished_at: new Date().toISOString(),
    error_detail: "Cerrado automáticamente: la corrida quedó colgada (proceso interrumpido).",
  }).eq("team_id", TEAM_ID).eq("status", "running").lt("started_at", stuckCutoff);

  // 1. Si hay otra corrida activa, no pisarla.
  const { data: running } = await supabaseAdmin.from("sync_logs").select("id, cron_mode, started_at")
    .eq("team_id", TEAM_ID).eq("status", "running").limit(1);
  if (running && running.length > 0) {
    log(`hay una corrida activa (${running[0].cron_mode}, desde ${running[0].started_at}); no se lanza otra.`);
    return 0;
  }

  // 2. Modo --if-stale: ponerse al día solo si hace falta (p. ej. tras reiniciar el VPS).
  if (IF_STALE) {
    const { data: last } = await supabaseAdmin.from("sync_logs").select("finished_at")
      .eq("team_id", TEAM_ID).eq("cron_mode", MODE).in("status", ["success", "partial"])
      .order("started_at", { ascending: false }).limit(1);
    const lastOk = last?.[0]?.finished_at ? new Date(last[0].finished_at).getTime() : 0;
    if (Date.now() - lastOk < STALE_AFTER_H * 3600_000) {
      log(`última corrida OK hace menos de ${STALE_AFTER_H}h; nada que hacer.`);
      return 0;
    }
    log(`última corrida OK hace más de ${STALE_AFTER_H}h: se ejecuta ahora para ponerse al día.`);
  }

  // 3. Crear la fila de log (visible en el dashboard desde el primer segundo).
  const { data: newLog, error: logErr } = await supabaseAdmin.from("sync_logs").insert({
    team_id: TEAM_ID, started_at: new Date().toISOString(), status: "running",
    trigger: "vps", cron_mode: MODE,
    contacts_created: 0, contacts_updated: 0, contacts_skipped: 0, errors_count: 0,
  }).select("id").single();
  if (logErr || !newLog) { log(`no se pudo crear sync_log: ${logErr?.message}`); return 1; }
  const logId: string = newLog.id;

  const finish = async (fields: Record<string, unknown>) => {
    const { error } = await supabaseAdmin.from("sync_logs")
      .update({ finished_at: new Date().toISOString(), ...fields }).eq("id", logId);
    if (error) log(`ATENCIÓN: no se pudo actualizar sync_log: ${error.message}`);
  };

  try {
    // 4. Configuración del team
    const { data: cfg } = await supabaseAdmin.from("sync_configs").select("systeme_api_key, is_active, is_configured")
      .eq("team_id", TEAM_ID).single();
    if (!cfg?.is_active || !cfg?.is_configured || !cfg?.systeme_api_key) {
      await finish({ status: "error", errors_count: 1, error_detail: "Sync desactivada o sin API key de Systeme en sync_configs" });
      return 1;
    }
    const { data: team } = await supabaseAdmin.from("teams").select("tokko_api_key").eq("id", TEAM_ID).single();
    if (!team?.tokko_api_key) {
      await finish({ status: "error", errors_count: 1, error_detail: "El team no tiene tokko_api_key" });
      return 1;
    }
    const [{ data: whitelist }, { data: fixed }] = await Promise.all([
      supabaseAdmin.from("sync_tags_whitelist").select("tag_name").eq("team_id", TEAM_ID),
      supabaseAdmin.from("sync_tags_fixed").select("tag_name").eq("team_id", TEAM_ID),
    ]);

    // 5. Ventana de fechas. recent = default del motor (3 días). historic = 7 días hacia atrás.
    let dateRange: { fromDate: string; toDate?: string } | undefined;
    if (MODE === "historic") {
      const oldest = await getOldestSyncedDate(TEAM_ID);
      if (oldest) {
        const from = new Date(new Date(oldest).getTime() - 7 * 86_400_000).toISOString().split("T")[0];
        dateRange = { fromDate: from, toDate: oldest };
      }
    }
    if (dateRange) {
      await supabaseAdmin.from("sync_logs").update({ from_date: dateRange.fromDate, to_date: dateRange.toDate ?? null }).eq("id", logId);
      log(`ventana: ${dateRange.fromDate} → ${dateRange.toDate}`);
    }

    // 6. Ejecutar, con reintentos completos si la falla fue total (Tokko/Systeme caídos).
    let result = await runSync({
      tokkoKey: team.tokko_api_key, systemeKey: cfg.systeme_api_key,
      whitelistTags: (whitelist ?? []).map(r => r.tag_name as string), // TODA sincro usa solo las tags del dashboard
      fixedTags: (fixed ?? []).map(r => r.tag_name as string),
      teamId: TEAM_ID, dateRange,
    });
    let attempt = 1;
    const totalFailure = (r: typeof result) => r.errors > 0 && r.created + r.updated + r.skipped === 0;
    while (totalFailure(result) && attempt < RUN_ATTEMPTS) {
      const waitMin = RETRY_WAITS_MIN[Math.min(attempt - 1, RETRY_WAITS_MIN.length - 1)];
      log(`intento ${attempt}/${RUN_ATTEMPTS} falló (${result.errorDetail}). Reintento en ${waitMin} min.`);
      await supabaseAdmin.from("sync_logs").update({
        error_detail: `Intento ${attempt}/${RUN_ATTEMPTS} falló: ${result.errorDetail}. Reintentando en ${waitMin} min…`,
      }).eq("id", logId);
      await sleep(waitMin * 60_000);
      attempt++;
      result = await runSync({
        tokkoKey: team.tokko_api_key, systemeKey: cfg.systeme_api_key,
        whitelistTags: (whitelist ?? []).map(r => r.tag_name as string),
        fixedTags: (fixed ?? []).map(r => r.tag_name as string),
        teamId: TEAM_ID, dateRange,
      });
    }

    // 7. Estado final HONESTO: success = sin errores; partial = hubo errores reales en algunos contactos;
    //    error = falla total tras todos los intentos.
    const status = totalFailure(result) ? "error" : result.errors > 0 ? "partial" : "success";
    await finish({
      status,
      contacts_created: result.created, contacts_updated: result.updated, contacts_skipped: result.skipped,
      errors_count: result.errors,
      error_detail: totalFailure(result)
        ? `${result.errorDetail} (tras ${attempt} intentos)`
        : (result.errorDetail ?? null),
    });
    log(`FIN ${status}: +${result.created} ↻${result.updated} ⤼${result.skipped} ⚠${result.errors} (${attempt} intento/s)`);
    return status === "error" ? 1 : 0;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await finish({ status: "error", errors_count: 1, error_detail: `Error inesperado: ${msg}` });
    log(`ERROR inesperado: ${msg}`);
    return 1;
  }
}

main().then(code => process.exit(code), err => { console.error(err); process.exit(1); });
