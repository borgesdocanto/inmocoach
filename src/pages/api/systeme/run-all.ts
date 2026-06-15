// POST /api/systeme/run-all
// Ejecuta sync de Systeme para todos los teams activos y configurados.
// Acepta CRON_SECRET (Vercel) o token externo en app_config (GitHub Actions).
// Procesa cada team INLINE — sin fetch interno — para evitar errores de auth en cascada.
import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { runSync } from "../../../lib/systemeSync";
import { Resend } from "resend";

export const config = { maxDuration: 300 };

const CRON_SECRET = process.env.CRON_SECRET;
const resend = new Resend(process.env.RESEND_API_KEY);

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function notifyError(teamId: string, message: string) {
  try {
    await resend.emails.send({
      from: "InmoCoach <coach@inmocoach.com.ar>",
      to: "leandro@galas.com.ar",
      subject: `❌ Error en sync Systeme — team ${teamId.slice(0, 8)}`,
      html: `<p>Error en la sincronización Tokko → Systeme.</p><p><b>Team:</b> ${teamId}</p><p><b>Error:</b></p><pre>${message}</pre>`,
    });
  } catch { /* ignorar fallo de email */ }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  // Auth: CRON_SECRET de Vercel O token externo guardado en app_config
  const authHeader = req.headers.authorization ?? "";
  let authorized = authHeader === `Bearer ${CRON_SECRET}`;
  let triggerSource: "cron" | "github" = "cron";
  if (!authorized && authHeader.startsWith("Bearer ")) {
    const candidate = authHeader.slice(7);
    const { data: tokenRow } = await supabaseAdmin
      .from("app_config")
      .select("value")
      .eq("key", "systeme_cron_token")
      .is("team_id", null)
      .maybeSingle();
    if (tokenRow?.value && tokenRow.value === candidate) {
      authorized = true;
      triggerSource = "github";
    }
  }
  if (!authorized) return res.status(401).json({ error: "Unauthorized" });

  // Traer teams configurados y activos
  const { data: configs, error: cfgErr } = await supabaseAdmin
    .from("sync_configs")
    .select("team_id, systeme_api_key")
    .eq("is_active", true)
    .eq("is_configured", true);

  if (cfgErr) {
    console.error("[run-all] Error leyendo sync_configs:", cfgErr);
    return res.status(500).json({ error: "DB error", detail: cfgErr.message });
  }

  if (!configs || configs.length === 0) {
    return res.json({ ok: true, ran: 0, source: triggerSource, message: "Sin teams activos" });
  }

  const results: { team_id: string; result: string }[] = [];

  for (let i = 0; i < configs.length; i++) {
    const { team_id, systeme_api_key } = configs[i];

    // Crear log con status 'running'
    const { data: log } = await supabaseAdmin
      .from("sync_logs")
      .insert({
        team_id,
        started_at: new Date().toISOString(),
        status: "running",
        trigger: triggerSource,
      })
      .select("id")
      .single();

    try {
      // Cargar configuración del team
      const { data: team } = await supabaseAdmin
        .from("teams")
        .select("tokko_api_key")
        .eq("id", team_id)
        .maybeSingle();

      if (!team?.tokko_api_key) {
        await supabaseAdmin.from("sync_logs").update({
          status: "error",
          error_detail: "Team sin tokko_api_key",
          finished_at: new Date().toISOString(),
        }).eq("id", log!.id);
        results.push({ team_id, result: "no_tokko_key" });
        continue;
      }

      // Cargar whitelist y tags fijas
      const [{ data: whitelist }, { data: fixed }] = await Promise.all([
        supabaseAdmin.from("sync_tags_whitelist").select("tag_name").eq("team_id", team_id),
        supabaseAdmin.from("sync_tags_fixed").select("tag_name").eq("team_id", team_id),
      ]);

      const whitelistTags = (whitelist ?? []).map(r => r.tag_name as string);
      const fixedTags = (fixed ?? []).map(r => r.tag_name as string);

      // Ejecutar sync
      const result = await runSync({
        tokkoKey: team.tokko_api_key,
        systemeKey: systeme_api_key,
        whitelistTags,
        fixedTags,
      });

      // Determinar status
      let status: "success" | "partial" | "error";
      if (result.errors > 0 && result.created + result.updated === 0) status = "error";
      else if (result.errors > 0) status = "partial";
      else status = "success";

      // Actualizar log
      await supabaseAdmin.from("sync_logs").update({
        status,
        contacts_created: result.created,
        contacts_updated: result.updated,
        contacts_skipped: result.skipped,
        errors_count: result.errors,
        error_detail: result.errorDetail ?? null,
        finished_at: new Date().toISOString(),
      }).eq("id", log!.id);

      // Notificar si hay errores
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

    // Pausa entre teams (excepto el último)
    if (i < configs.length - 1) await sleep(3000);
  }

  return res.json({ ok: true, ran: results.length, source: triggerSource, results });
}
