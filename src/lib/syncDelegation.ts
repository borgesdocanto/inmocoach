/**
 * lib/syncDelegation.ts
 * Interruptor para delegar la sincronización Tokko → Systeme al VPS (vps-sync/).
 *
 * Con SYNC_EN_VPS=1 en Vercel, los disparos AUTOMÁTICOS (cron-job.org, daily-sync,
 * birthday-email, loyalty-emails, schedulers) se saltean: hay un solo lugar que
 * sincroniza (el VPS). Las corridas MANUALES desde el dashboard siguen funcionando.
 * Para volver a Vercel: borrar la variable (o ponerla en 0) y redeployar.
 */
export function syncDelegatedToVps(): boolean {
  const v = (process.env.SYNC_EN_VPS ?? "").trim().toLowerCase();
  return v === "1" || v === "true";
}

export const SYNC_DELEGATED_MESSAGE =
  "Sync delegado al VPS (SYNC_EN_VPS activo): este disparo automático se omite.";
