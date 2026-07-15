// POST /api/systeme/run-all
// Procesa el sync Tokko → Systeme para todos los teams activos.
// Una sola llamada de ~60-180s. cron-job.org dispara y cierra (timeout 30s),
// pero Vercel sigue procesando en background hasta terminar gracias a maxDuration: 300.
// El resultado se ve en sync_logs cuando termina.

import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { runSync } from "../../../lib/systemeSync";
import { Resend } from "resend";

export const config = { maxDuration: 300 };

const CRON_SECRET = process.env.CRON_SECRET;
const resend = new Resend(process.env.RESEND_API_KEY);

async function notifyError(teamId: string, message: string) {
  try {
    await resend.emails.send({
      from: "InmoCoach <coach@inmocoach.com.ar>",
      to: "leandro@galas.com.ar",
      subject: `❌ Error sync Systeme — team ${teamId.slice(0, 8)}`,
      html: `<p>Error en sync Tokko → Systeme.</p><p><b>Team:</b> ${teamId}</p><pre>${message}</pre>`,
    });
  } catch { /* ignorar */ }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`[run-all] >>> INVOCACIÓN recibida ${new Date().toISOString()}`);
  if (req.method !== "POST") return res.status(405).end();

  // Auth: CRON_SECRET (Vercel) O token externo (cron-job.org via app_config)
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

  // Metadata de retry (viene cuando este sync es reintento automático de otro previo)
  const retryOf: string | null = typeof req.body?.retry_of === "string" ? req.body.retry_of : null;
  const retryCount: number = typeof req.body?.retry_count === "number" ? req.body.retry_count : 0;
  if (retryOf) {
    console.log(`[run-all] este sync es RETRY #${retryCount} del sync_log ${retryOf.slice(0, 8)}`);
  }

  console.log(`[run-all] auth OK (source: ${triggerSource}). Iniciando cleanup...`);
  // Auto-cleanup: cerrar sync_logs que quedaron "running" hace más de 10 minutos.
  // Esto pasa cuando Vercel mata el proceso por timeout sin que el código pueda escribir finished_at.
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: stuck } = await supabaseAdmin
    .from("sync_logs")
    .update({
      status: "error",
      error_detail: "Proceso cortado por timeout de Vercel (cleanup automático)",
      finished_at: new Date().toISOString(),
    })
    .eq("status", "running")
    .lt("started_at", cutoff)
    .select("id");
  if (stuck && stuck.length > 0) {
    console.log(`[run-all] cleanup: cerrados ${stuck.length} sync_logs colgados`);
  }

  const { data: configs, error: cfgErr } = await supabaseAdmin
    .from("sync_configs")
    .select("team_id, systeme_api_key")
    .eq("is_active", true)
    .eq("is_configured", true);

  if (cfgErr) return res.status(500).json({ error: "DB error", detail: cfgErr.message });
  if (!configs || configs.length === 0) return res.json({ ok: true, ran: 0 });

  // Integraciones: solo GALAS
  const galas_configs = configs.filter(c => c.team_id === "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93");

  console.log(`[run-all] configs query OK: ${galas_configs.length} teams para procesar`);
  const results: { team_id: string; result: string }[] = [];

  for (const { team_id, systeme_api_key } of galas_configs) {
    console.log(`[run-all] ↪ team ${team_id.slice(0, 8)}: creando sync_log...`);
    // Crear log con timeout duro de 10s
    const logInsert = await Promise.race([
      supabaseAdmin
        .from("sync_logs")
        .insert({
          team_id,
          started_at: new Date().toISOString(),
          status: "running",
          trigger: retryOf ? "retry" : triggerSource,
          retry_of: retryOf,
          retry_count: retryCount,
        })
        .select("id")
        .single(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout INSERT sync_log (10s)")), 10000)),
    ]).catch((err) => ({ data: null, error: err }));

    const log = logInsert.data;
    if (!log) {
      console.error(`[run-all] FAIL al crear sync_log para team ${team_id.slice(0, 8)}: ${logInsert.error?.message ?? "unknown"}`);
      results.push({ team_id, result: "fail_create_log" });
      continue;
    }
    console.log(`[run-all] sync_log creado (id: ${log.id.slice(0, 8)})`);

    try {
      console.log(`[run-all] cargando team data (tokko_api_key)...`);
      const teamQuery = await Promise.race([
        supabaseAdmin.from("teams").select("tokko_api_key").eq("id", team_id).maybeSingle(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout SELECT teams (10s)")), 10000)),
      ]);
      const { data: team } = teamQuery as { data: { tokko_api_key?: string } | null };

      if (!team?.tokko_api_key) {
        await supabaseAdmin.from("sync_logs").update({
          status: "error",
          error_detail: "Sin tokko_api_key",
          finished_at: new Date().toISOString(),
        }).eq("id", log!.id);
        results.push({ team_id, result: "no_tokko_key" });
        continue;
      }

      console.log(`[run-all] team data OK. Cargando whitelist + fixed tags...`);
      const tagsQuery = await Promise.race([
        Promise.all([
          supabaseAdmin.from("sync_tags_whitelist").select("tag_name").eq("team_id", team_id),
          supabaseAdmin.from("sync_tags_fixed").select("tag_name").eq("team_id", team_id),
        ]),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout SELECT tags (10s)")), 10000)),
      ]);
      const [{ data: whitelist }, { data: fixed }] = tagsQuery as [
        { data: Array<{ tag_name: string }> | null },
        { data: Array<{ tag_name: string }> | null }
      ];
      console.log(`[run-all] tags cargados: ${whitelist?.length ?? 0} whitelist, ${fixed?.length ?? 0} fixed. Llamando runSync...`);

      const result = await runSync({
        tokkoKey: team.tokko_api_key,
        systemeKey: systeme_api_key,
        whitelistTags: (whitelist ?? []).map(r => r.tag_name as string),
        fixedTags: (fixed ?? []).map(r => r.tag_name as string),
        teamId: team_id,
      });

      let status: "success" | "partial" | "error";
      if (result.errors > 0 && result.created + result.updated === 0) status = "error";
      else if (result.errors > 0) status = "partial";
      else status = "success";

      await supabaseAdmin.from("sync_logs").update({
        status,
        contacts_created: result.created,
        contacts_updated: result.updated,
        contacts_skipped: result.skipped,
        errors_count: result.errors,
        error_detail: result.errorDetail ?? null,
        finished_at: new Date().toISOString(),
      }).eq("id", log!.id);

      if (result.errors > 0 && result.errorDetail) {
        await notifyError(team_id, result.errorDetail);
      }
      results.push({ team_id, result: `${status} +${result.created} ↻${result.updated} ⚠${result.errors}` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      await supabaseAdmin.from("sync_logs").update({
        status: "error",
        error_detail: msg,
        finished_at: new Date().toISOString(),
      }).eq("id", log!.id);
      await notifyError(team_id, msg);
      results.push({ team_id, result: `error: ${msg}` });
    }
  }

  return res.json({ ok: true, ran: results.length, source: triggerSource, results });
}
