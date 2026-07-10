// POST /api/systeme/run-range
// Sincroniza un rango personalizado de fechas (en lugar de las últimas 72 horas).
// Body: { fromDate: "YYYY-MM-DD", toDate?: "YYYY-MM-DD" }
// Requiere sesión de super admin O CRON_SECRET.
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { isSuperAdmin } from "../../../lib/adminGuard";
import { runSync } from "../../../lib/systemeSync";
import { Resend } from "resend";

export const config = { maxDuration: 300 };

const CRON_SECRET = process.env.CRON_SECRET;
const resend = new Resend(process.env.RESEND_API_KEY);

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  // Auth: super admin O CRON_SECRET (no acepta token externo: endpoint sensible)
  const authHeader = req.headers.authorization ?? "";
  const isCron = authHeader === `Bearer ${CRON_SECRET}`;
  if (!isCron) {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email || !isSuperAdmin(session.user.email)) {
      return res.status(401).json({ error: "Solo super admin" });
    }
  }

  // Validar body
  const { fromDate, toDate, teamId: bodyTeamId } = req.body ?? {};
  if (!fromDate || !isValidDate(fromDate)) {
    return res.status(400).json({ error: "fromDate requerido en formato YYYY-MM-DD" });
  }
  if (toDate && !isValidDate(toDate)) {
    return res.status(400).json({ error: "toDate inválido (debe ser YYYY-MM-DD)" });
  }
  if (toDate && fromDate > toDate) {
    return res.status(400).json({ error: "fromDate debe ser <= toDate" });
  }

  // Cleanup de logs colgados
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  await supabaseAdmin
    .from("sync_logs")
    .update({
      status: "error",
      error_detail: "Proceso cortado por timeout de Vercel (cleanup automático)",
      finished_at: new Date().toISOString(),
    })
    .eq("status", "running")
    .lt("started_at", cutoff);

  // Traer teams activos (o uno solo si bodyTeamId)
  // Integraciones: solo GALAS
  const galasTeamId = "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93";
  if (bodyTeamId && bodyTeamId !== galasTeamId) {
    return res.status(403).json({ error: "Feature no disponible para este team" });
  }

  let query = supabaseAdmin
    .from("sync_configs")
    .select("team_id, systeme_api_key")
    .eq("is_active", true)
    .eq("is_configured", true)
    .eq("team_id", galasTeamId); // Siempre filtrar a GALAS

  const { data: configs, error: cfgErr } = await query;
  if (cfgErr) return res.status(500).json({ error: "DB error", detail: cfgErr.message });
  if (!configs || configs.length === 0) {
    return res.json({ ok: true, ran: 0, message: "Sin teams activos" });
  }

  const results: { team_id: string; result: string }[] = [];

  for (const { team_id, systeme_api_key } of configs) {
    const { data: log } = await supabaseAdmin
      .from("sync_logs")
      .insert({
        team_id,
        started_at: new Date().toISOString(),
        status: "running",
        trigger: "range",
        error_detail: `Rango: ${fromDate}${toDate ? ` → ${toDate}` : " → hoy"}`,
      })
      .select("id")
      .single();

    try {
      const { data: team } = await supabaseAdmin
        .from("teams")
        .select("tokko_api_key")
        .eq("id", team_id)
        .maybeSingle();

      if (!team?.tokko_api_key) {
        await supabaseAdmin.from("sync_logs").update({
          status: "error",
          error_detail: "Sin tokko_api_key",
          finished_at: new Date().toISOString(),
        }).eq("id", log!.id);
        results.push({ team_id, result: "no_tokko_key" });
        continue;
      }

      const [{ data: whitelist }, { data: fixed }] = await Promise.all([
        supabaseAdmin.from("sync_tags_whitelist").select("tag_name").eq("team_id", team_id),
        supabaseAdmin.from("sync_tags_fixed").select("tag_name").eq("team_id", team_id),
      ]);

      const result = await runSync({
        tokkoKey: team.tokko_api_key,
        systemeKey: systeme_api_key,
        whitelistTags: (whitelist ?? []).map(r => r.tag_name as string),
        fixedTags: (fixed ?? []).map(r => r.tag_name as string),
        teamId: team_id,
        dateRange: { fromDate, toDate },
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
        error_detail: result.errorDetail
          ? `Rango: ${fromDate}${toDate ? ` → ${toDate}` : " → hoy"}\n${result.errorDetail}`
          : `Rango: ${fromDate}${toDate ? ` → ${toDate}` : " → hoy"}`,
        finished_at: new Date().toISOString(),
      }).eq("id", log!.id);

      if (result.errors > 0 && result.errorDetail) {
        try {
          await resend.emails.send({
            from: "InmoCoach <coach@inmocoach.com.ar>",
            to: "leandro@galas.com.ar",
            subject: `⚠️ Sync por rango (${fromDate}) — team ${team_id.slice(0, 8)}`,
            html: `<p>Sincronización por rango con errores.</p><pre>${result.errorDetail}</pre>`,
          });
        } catch { /* ignorar */ }
      }
      results.push({ team_id, result: `${status} +${result.created} ↻${result.updated} ⚠${result.errors}` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      await supabaseAdmin.from("sync_logs").update({
        status: "error",
        error_detail: `Rango: ${fromDate}${toDate ? ` → ${toDate}` : " → hoy"}\n${msg}`,
        finished_at: new Date().toISOString(),
      }).eq("id", log!.id);
      results.push({ team_id, result: `error: ${msg}` });
    }
  }

  return res.json({ ok: true, ran: results.length, range: { fromDate, toDate }, results });
}
