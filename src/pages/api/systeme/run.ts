// POST /api/systeme/run?teamId=xxx
// Ejecuta una corrida de sincronización para un team específico
// Llamado por el scheduler del cron O manualmente desde la UI
// 
// Responde 202 (Accepted) inmediatamente. El trabajo real corre en background
// via waitUntil() porque para GALAS puede tardar > 300s. Ver sync_logs para resultado.
import { NextApiRequest, NextApiResponse } from "next";
import { waitUntil } from "@vercel/functions";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { isSuperAdmin } from "../../../lib/adminGuard";
import { getEffectiveEmail } from "../../../lib/impersonation";
import { runSync } from "../../../lib/systemeSync";
import { Resend } from "resend";

export const config = { maxDuration: 300 }; // Vercel Hobby — pero waitUntil sigue con su propio timeout

const resend = new Resend(process.env.RESEND_API_KEY);
const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  // Autenticación: cron secret (scheduler) O super admin O el propio broker
  const cronAuth = req.headers.authorization === `Bearer ${CRON_SECRET}`;
  let teamId: string | undefined;
  let trigger: "cron" | "manual" = "manual";

  if (cronAuth) {
    // Llamado desde el scheduler — teamId viene en el body
    teamId = req.body?.teamId;
    if (!teamId) return res.status(400).json({ error: "teamId requerido" });
    trigger = "cron";
  } else {
    // Llamado manual desde la UI
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });
    const email = getEffectiveEmail(req, session);

    // Super admin impersonando desde el panel admin puede pasar teamId en el body.
    // En cualquier otro caso (incluyendo super admin usando su propia cuenta),
    // resolvemos el teamId desde la sesión para garantizar aislamiento entre tenants.
    if (isSuperAdmin(email) && req.body?.teamId) {
      // Solo cuando viene teamId explícito (llamado desde panel admin)
      teamId = req.body.teamId;
    } else {
      // Resolver siempre desde la sesión — aplica a todos los usuarios incluyendo super admin
      const { data: sub } = await supabaseAdmin
        .from("subscriptions")
        .select("team_id, team_role")
        .eq("email", email)
        .single();
      if (!sub?.team_id) return res.status(403).json({ error: "Sin equipo" });
      if (!isSuperAdmin(email) && sub.team_role !== "owner" && sub.team_role !== "team_leader") {
        return res.status(403).json({ error: "Sin permiso" });
      }
      teamId = sub.team_id;
    }
  }

  // Integraciones: solo GALAS
  if (teamId !== "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93") {
    return res.status(403).json({ error: "Feature no disponible" });
  }

  // Parámetros de rango (UI manda fromDate/toDate cuando el usuario lo elige)
  const fromDate: string | undefined = req.body?.fromDate;
  const toDate: string | undefined = req.body?.toDate;
  const dateRange = fromDate && /^\d{4}-\d{2}-\d{2}$/.test(fromDate)
    ? { fromDate, toDate: toDate && /^\d{4}-\d{2}-\d{2}$/.test(toDate) ? toDate : undefined }
    : undefined;

  // Responder YA con 202 (Accepted) — el trabajo real corre en background
  // Sin esto, cron-job.org corta a los 30s y Vercel mata a los 300s
  waitUntil(runSyncInBackground(teamId, trigger, dateRange));
  return res.status(202).json({ ok: true, message: "Sincronización iniciada" });
}

async function runSyncInBackground(
  teamId: string,
  trigger: "cron" | "manual",
  dateRange?: { fromDate: string; toDate?: string }
) {
  console.log(`[systeme/run] sync iniciado para team ${teamId.slice(0, 8)}`);

  // Cargar config del team
  const { data: syncConfig } = await supabaseAdmin
    .from("sync_configs")
    .select("*")
    .eq("team_id", teamId)
    .single();

  if (!syncConfig) {
    console.error(`[systeme/run] sync_config not found para team ${teamId.slice(0, 8)}`);
    return;
  }
  if (!syncConfig.is_active || !syncConfig.is_configured) {
    console.error(`[systeme/run] sync no activa/configurada para team ${teamId.slice(0, 8)}`);
    return;
  }
  if (!syncConfig.systeme_api_key) {
    console.error(`[systeme/run] sin systeme_api_key para team ${teamId.slice(0, 8)}`);
    return;
  }

  const { data: team } = await supabaseAdmin
    .from("teams")
    .select("tokko_api_key, agency_name")
    .eq("id", teamId)
    .single();

  if (!team?.tokko_api_key) {
    console.error(`[systeme/run] sin tokko_api_key para team ${teamId.slice(0, 8)}`);
    return;
  }

  const [{ data: whitelist }, { data: fixed }] = await Promise.all([
    supabaseAdmin.from("sync_tags_whitelist").select("tag_name").eq("team_id", teamId),
    supabaseAdmin.from("sync_tags_fixed").select("tag_name").eq("team_id", teamId),
  ]);

  // Crear log con status 'running'
  const { data: log } = await supabaseAdmin
    .from("sync_logs")
    .insert({ team_id: teamId, started_at: new Date().toISOString(), status: "running", trigger })
    .select("id")
    .single();

  const logId = log?.id;

  try {
    const result = await runSync({
      tokkoKey: team.tokko_api_key,
      systemeKey: syncConfig.systeme_api_key,
      whitelistTags: (whitelist || []).map((r: { tag_name: string }) => r.tag_name),
      fixedTags: (fixed || []).map((r: { tag_name: string }) => r.tag_name),
      teamId,
      dateRange,
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

    console.log(`[systeme/run] sync OK para team ${teamId.slice(0, 8)}: ${status}`);
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
    console.error(`[systeme/run] sync ERROR para team ${teamId.slice(0, 8)}: ${msg}`);
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
