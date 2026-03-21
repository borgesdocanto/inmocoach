-- Columnas para Google Calendar Push Notifications (Watch API)
-- Cada usuario registra un "watcher" en Google Calendar.
-- Cuando hay cambios, Google llama a /api/webhooks/google-calendar con el channel_id.
-- Los watchers expiran en máx. 7 días → el cron /api/cron/renew-watches los renueva.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS watch_channel_id   TEXT,
  ADD COLUMN IF NOT EXISTS watch_resource_id  TEXT,
  ADD COLUMN IF NOT EXISTS watch_expiry       TIMESTAMPTZ;

-- Índice para lookup rápido del channel_id en el webhook
CREATE INDEX IF NOT EXISTS idx_subscriptions_watch_channel
  ON public.subscriptions(watch_channel_id)
  WHERE watch_channel_id IS NOT NULL;
