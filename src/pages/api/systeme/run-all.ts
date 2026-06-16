// POST /api/systeme/run-all
// Procesa el sync Tokko → Systeme en CHUNKS para entrar en el timeout de 30s de cron-job.org.
//
// Flujo:
// 1ra llamada: si no hay progreso pendiente, hace fetch de Tokko y crea filas en sync_progress.
// Cada llamada: procesa hasta CHUNK_SIZE contactos pendientes y devuelve {pending: bool, processed, remaining}.
// Última llamada: cuando no quedan pendientes, finaliza el sync_log con totales.

import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { fetchTokkoContactsToday, processSingleContact, type TokkoContact } from "../../../lib/systemeSync";
import { Resend } from "resend";

export const config = { maxDuration: 60 };

const CRON_SECRET = process.env.CRON_SECRET;
const CHUNK_SIZE = 12; // contactos por llamada (cada uno tarda ~1.5s + tags) → 12 * 2s = ~24s
const resend = new Resend(process.env.RESEND_API_KEY);

async function notifyError(teamId: string, message: string) {
  try {
    await resend.emails.send({
      from: "InmoCoach <coach@inmocoach.com.ar>",
      to: "leandro@galas.com.ar",
      subject: `❌ Error en sync Systeme — team ${teamId.slice(0, 8)}`,
      html: `<p>Error en sync Tokko → Systeme.</p><p><b>Team:</b> ${teamId}</p><pre>${message}</pre>`,
    });
  } catch { /* ignorar */ }
}

interface TeamConfig {
  team_id: string;
  systeme_api_key: string;
  tokko_api_key: string;
  whitelistTags: string[];
  fixedTags: string[];
  log_id: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  // Auth
  const authHeader = req.headers.authorization ?? "";
  let authorized = authHeader === `Bearer ${CRON_SECRET}`;
  let triggerSource: "cron" | "github" = "cron";
  if (!authorized && authHeader.startsWith("Bearer ")) {
    const candidate = authHeader.slice(7);
    const { data: tokenRow } = await supabaseAdmin
      .from("app_config").select("value").eq("key", "systeme_cron_token")
      .is("team_id", null).maybeSingle();
    if (tokenRow?.value && tokenRow.value === candidate) {
      authorized = true;
      triggerSource = "github";
    }
  }
  if (!authorized) return res.status(401).json({ error: "Unauthorized" });

  // 1. Buscar si hay un sync_log "running" reciente (< 30 min) que tenga progreso pendiente
  const recentCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: runningLog } = await supabaseAdmin
    .from("sync_logs")
    .select("id, team_id")
    .eq("status", "running")
    .gte("started_at", recentCutoff)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let teamConfig: TeamConfig | null = null;

  if (runningLog) {
    // Hay un sync en marcha — continuarlo
    teamConfig = await loadTeamConfig(runningLog.team_id, runningLog.id);
    if (!teamConfig) {
      // Inconsistencia — cerrar el log
      await supabaseAdmin.from("sync_logs").update({
        status: "error", error_detail: "Team config no disponible",
        finished_at: new Date().toISOString(),
      }).eq("id", runningLog.id);
      return res.json({ ok: false, error: "team_config_missing" });
    }
  } else {
    // No hay sync en marcha — empezar uno nuevo
    const { data: configs } = await supabaseAdmin
      .from("sync_configs")
      .select("team_id, systeme_api_key")
      .eq("is_active", true)
      .eq("is_configured", true)
      .order("team_id");

    if (!configs || configs.length === 0) {
      return res.json({ ok: true, message: "Sin teams activos", source: triggerSource });
    }

    // Procesar el primer team (luego iteramos los demás en próximas llamadas si hace falta)
    const cfg = configs[0];

    // Crear sync_log
    const { data: log } = await supabaseAdmin
      .from("sync_logs")
      .insert({
        team_id: cfg.team_id,
        started_at: new Date().toISOString(),
        status: "running",
        trigger: triggerSource,
      })
      .select("id")
      .single();

    if (!log) return res.status(500).json({ error: "no se pudo crear sync_log" });

    teamConfig = await loadTeamConfig(cfg.team_id, log.id);
    if (!teamConfig) {
      await supabaseAdmin.from("sync_logs").update({
        status: "error", error_detail: "team config faltante",
        finished_at: new Date().toISOString(),
      }).eq("id", log.id);
      return res.json({ ok: false });
    }
    teamConfig.systeme_api_key = cfg.systeme_api_key;

    // Cargar contactos de Tokko y poner en sync_progress
    try {
      const contacts = await fetchTokkoContactsToday(teamConfig.tokko_api_key);
      if (contacts.length === 0) {
        await supabaseAdmin.from("sync_logs").update({
          status: "success", contacts_created: 0, contacts_updated: 0,
          contacts_skipped: 0, errors_count: 0,
          finished_at: new Date().toISOString(),
        }).eq("id", log.id);
        return res.json({ ok: true, pending: false, message: "0 contactos en Tokko" });
      }

      // Insertar contactos a procesar en batches de 100 (límite de Supabase)
      const batchSize = 100;
      for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize).map(c => ({
          team_id: teamConfig!.team_id,
          log_id: log.id,
          contact_data: c,
          status: "pending",
        }));
        await supabaseAdmin.from("sync_progress").insert(batch);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error Tokko";
      await supabaseAdmin.from("sync_logs").update({
        status: "error", error_detail: msg,
        finished_at: new Date().toISOString(),
      }).eq("id", log.id);
      return res.json({ ok: false, error: msg });
    }
  }

  // 2. Procesar un chunk
  const { data: pending } = await supabaseAdmin
    .from("sync_progress")
    .select("id, contact_data")
    .eq("team_id", teamConfig.team_id)
    .eq("log_id", teamConfig.log_id)
    .eq("status", "pending")
    .order("created_at")
    .limit(CHUNK_SIZE);

  if (!pending || pending.length === 0) {
    // No queda nada — finalizar log
    await finalizeLog(teamConfig.log_id, teamConfig.team_id);
    return res.json({ ok: true, pending: false, message: "Sync finalizado" });
  }

  // Cargar cache compartido para este chunk
  const cache = await loadCacheFromSupabase(teamConfig.team_id);

  // Cargar tags de Systeme una vez por chunk
  const tagsCache = await loadSystemeTags(teamConfig.systeme_api_key);

  // Procesar cada contacto
  let chunkCreated = 0, chunkUpdated = 0, chunkSkipped = 0, chunkErrors = 0;
  const chunkErrorDetails: string[] = [];

  for (const row of pending) {
    const contact = row.contact_data as TokkoContact;
    try {
      const result = await processSingleContact({
        contact,
        systemeKey: teamConfig.systeme_api_key,
        whitelistTags: teamConfig.whitelistTags,
        fixedTags: teamConfig.fixedTags,
        contactsCache: cache,
        tagsCache,
        teamId: teamConfig.team_id,
      });
      if (result.action === "created") chunkCreated++;
      else if (result.action === "updated") chunkUpdated++;
      else if (result.action === "skipped") chunkSkipped++;
      if (result.tagErrors.length > 0) {
        chunkErrors++;
        chunkErrorDetails.push(`${contact.email}: ${result.tagErrors.join(" | ")}`);
      }

      await supabaseAdmin.from("sync_progress").update({
        status: "done",
        processed_at: new Date().toISOString(),
        error_detail: result.tagErrors.length > 0 ? result.tagErrors.join(" | ") : null,
      }).eq("id", row.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error";
      chunkErrors++;
      chunkErrorDetails.push(`${contact.email}: ${msg}`);
      await supabaseAdmin.from("sync_progress").update({
        status: "error", processed_at: new Date().toISOString(), error_detail: msg,
      }).eq("id", row.id);
    }
  }

  // Actualizar el log con los acumulados del chunk
  const { data: currentLog } = await supabaseAdmin
    .from("sync_logs")
    .select("contacts_created, contacts_updated, contacts_skipped, errors_count, error_detail")
    .eq("id", teamConfig.log_id)
    .single();

  await supabaseAdmin.from("sync_logs").update({
    contacts_created: (currentLog?.contacts_created ?? 0) + chunkCreated,
    contacts_updated: (currentLog?.contacts_updated ?? 0) + chunkUpdated,
    contacts_skipped: (currentLog?.contacts_skipped ?? 0) + chunkSkipped,
    errors_count: (currentLog?.errors_count ?? 0) + chunkErrors,
    error_detail: chunkErrorDetails.length > 0
      ? [currentLog?.error_detail, ...chunkErrorDetails].filter(Boolean).join("\n").slice(0, 8000)
      : currentLog?.error_detail,
  }).eq("id", teamConfig.log_id);

  // Contar pendientes restantes
  const { count: remaining } = await supabaseAdmin
    .from("sync_progress")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamConfig.team_id)
    .eq("log_id", teamConfig.log_id)
    .eq("status", "pending");

  const stillPending = (remaining ?? 0) > 0;

  if (!stillPending) {
    await finalizeLog(teamConfig.log_id, teamConfig.team_id);
  }

  return res.json({
    ok: true,
    pending: stillPending,
    processed: pending.length,
    remaining: remaining ?? 0,
    created: chunkCreated,
    updated: chunkUpdated,
    skipped: chunkSkipped,
    errors: chunkErrors,
  });
}

async function loadTeamConfig(teamId: string, logId: string): Promise<TeamConfig | null> {
  const [{ data: syncCfg }, { data: team }, { data: wl }, { data: fx }] = await Promise.all([
    supabaseAdmin.from("sync_configs").select("systeme_api_key").eq("team_id", teamId).maybeSingle(),
    supabaseAdmin.from("teams").select("tokko_api_key").eq("id", teamId).maybeSingle(),
    supabaseAdmin.from("sync_tags_whitelist").select("tag_name").eq("team_id", teamId),
    supabaseAdmin.from("sync_tags_fixed").select("tag_name").eq("team_id", teamId),
  ]);
  if (!syncCfg?.systeme_api_key || !team?.tokko_api_key) return null;
  return {
    team_id: teamId,
    systeme_api_key: syncCfg.systeme_api_key,
    tokko_api_key: team.tokko_api_key,
    whitelistTags: (wl ?? []).map((r: { tag_name: string }) => r.tag_name),
    fixedTags: (fx ?? []).map((r: { tag_name: string }) => r.tag_name),
    log_id: logId,
  };
}

async function loadCacheFromSupabase(teamId: string): Promise<Map<string, number>> {
  const cache = new Map<string, number>();
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data } = await supabaseAdmin
      .from("systeme_contact_cache")
      .select("email, systeme_id")
      .eq("team_id", teamId)
      .range(from, from + pageSize - 1);
    if (!data || data.length === 0) break;
    for (const row of data) cache.set((row.email as string).toLowerCase(), row.systeme_id as number);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return cache;
}

async function loadSystemeTags(key: string): Promise<{ id: number; name: string }[]> {
  const r = await fetch("https://api.systeme.io/api/tags?limit=100", {
    headers: { "X-API-Key": key, accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) return [];
  const d = await r.json();
  return d.items ?? [];
}

async function finalizeLog(logId: string, teamId: string) {
  const { data: log } = await supabaseAdmin
    .from("sync_logs")
    .select("contacts_created, contacts_updated, contacts_skipped, errors_count, error_detail")
    .eq("id", logId)
    .single();

  let status: "success" | "partial" | "error" = "success";
  if (log) {
    if (log.errors_count > 0 && log.contacts_created + log.contacts_updated === 0) status = "error";
    else if (log.errors_count > 0) status = "partial";
  }

  await supabaseAdmin.from("sync_logs").update({
    status,
    finished_at: new Date().toISOString(),
  }).eq("id", logId);

  // Limpiar sync_progress de este log
  await supabaseAdmin.from("sync_progress").delete().eq("log_id", logId);

  if (log?.errors_count && log.errors_count > 0 && log.error_detail) {
    await notifyError(teamId, log.error_detail);
  }
}
