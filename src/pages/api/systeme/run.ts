// POST /api/systeme/run?teamId=xxx
// Ejecuta una corrida de sincronización para un team específico
// Llamado por el scheduler del cron O manualmente desde la UI
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { isSuperAdmin } from "../../../lib/adminGuard";
import { getEffectiveEmail } from "../../../lib/impersonation";
import { runSync, ensureCustomFields } from "../../../lib/systemeSync";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  // Autenticación: cron secret (scheduler) O super admin O el propio broker
  const cronAuth = req.headers.authorization === `Bearer ${CRON_SECRET}`;
  let teamId: string | undefined;

  if (cronAuth) {
    // Llamado desde el scheduler — teamId viene en el body
    teamId = req.body?.teamId;
    if (!teamId) return res.status(400).json({ error: "teamId requerido" });
  } else {
    // Llamado manual desde la UI
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });
    const email = getEffectiveEmail(req, session);

    if (isSuperAdmin(email)) {
      teamId = req.body?.teamId;
    } else {
      const { data: sub } = await supabaseAdmin
        .from("subscriptions")
        .select("team_id, team_role")
        .eq("email", email)
        .single();
      if (!sub?.team_id) return res.status(403).json({ error: "Sin equipo" });
      if (sub.team_role !== "owner" && sub.team_role !== "team_leader") {
        return res.status(403).json({ error: "Sin permiso" });
      }
      teamId = sub.team_id;
    }
  }

  // Cargar config del team
  const { data: syncConfig } = await supabaseAdmin
    .from("sync_configs")
    .select("*")
    .eq("team_id", teamId)
    .single();

  if (!syncConfig?.is_active) return res.status(400).json({ error: "Sync no activa para este team" });
  if (!syncConfig.is_configured) return res.status(400).json({ error: "Sync no configurada" });
  if (!syncConfig.systeme_api_key) return res.status(400).json({ error: "Sin API key de Systeme" });

  const { data: team } = await supabaseAdmin
    .from("teams")
    .select("tokko_api_key, agency_name")
    .eq("id", teamId)
    .single();

  if (!team?.tokko_api_key) return res.status(400).json({ error: "Sin API key de Tokko" });

  const [{ data: whitelist }, { data: fixed }] = await Promise.all([
    supabaseAdmin.from("sync_tags_whitelist").select("tag_name").eq("team_id", teamId),
    supabaseAdmin.from("sync_tags_fixed").select("tag_name").eq("team_id", teamId),
  ]);

  // Crear log con status 'running'
  const { data: log } = await supabaseAdmin
    .from("sync_logs")
    .insert({ team_id: teamId, started_at: new Date().toISOString(), status: "running" })
    .select("id")
    .single();

  const logId = log?.id;

  try {
    // Asegurar campos custom en Systeme si es la primera vez
    if (!syncConfig.systeme_fields_created) {
      await ensureCustomFields(syncConfig.systeme_api_key);
      await supabaseAdmin
        .from("sync_configs")
        .update({ systeme_fields_created: true, updated_at: new Date().toISOString() })
        .eq("team_id", teamId);
    }

    const result = await runSync({
      tokkoKey: team.tokko_api_key,
      systemeKey: syncConfig.systeme_api_key,
      whitelistTags: (whitelist || []).map((r: { tag_name: string }) => r.tag_name),
      fixedTags: (fixed || []).map((r: { tag_name: string }) => r.tag_name),
    });

    const status = result.errors > 0 && result.created + result.updated === 0
      ? "error"
      : result.errors > 0
      ? "partial"
      : "success";

    // Actualizar log con resultado
    if (logId) {
      await supabaseAdmin.from("sync_logs").update({
        finished_at: new Date().toISOString(),
        contacts_created: result.created,
        contacts_updated: result.updated,
        contacts_skipped: result.skipped,
        errors_count: result.errors,
        error_detail: result.errorDetail ?? null,
        status,
      }).eq("id", logId);
    }

    // Notificar a Leandro si hay errores
    if (result.errors > 0) {
      await notifyError(team.agency_name ?? teamId!, result.errorDetail ?? `${result.errors} errores`);
    }

    return res.json({ ok: true, ...result, status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";

    if (logId) {
      await supabaseAdmin.from("sync_logs").update({
        finished_at: new Date().toISOString(),
        errors_count: 1,
        error_detail: msg,
        status: "error",
      }).eq("id", logId);
    }

    await notifyError(team.agency_name ?? teamId!, msg);
    return res.status(500).json({ error: msg });
  }
}

async function notifyError(agencyName: string, detail: string) {
  try {
    await resend.emails.send({
      from: "coach@inmocoach.com.ar",
      to: "leandro@galas.com.ar",
      subject: `⚠️ Error sync Systeme — ${agencyName}`,
      html: `
        <p>Hubo un error en la sincronización Tokko → Systeme.io para <strong>${agencyName}</strong>.</p>
        <pre style="background:#f3f4f6;padding:12px;border-radius:8px;font-size:13px">${detail}</pre>
        <p style="color:#6b7280;font-size:12px">InmoCoach · ${new Date().toLocaleString("es-AR")}</p>
      `,
    });
  } catch { /* no romper el flujo si el mail falla */ }
}
