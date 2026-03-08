-- Campos nuevos para el modelo IAC
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS is_proceso BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_cierre BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_user_colored BOOLEAN DEFAULT false;

-- Actualizar registros existentes según el tipo
UPDATE public.calendar_events SET is_proceso = true WHERE event_type IN ('tasacion', 'primera_visita', 'fotos_video');
UPDATE public.calendar_events SET is_cierre = true WHERE event_type IN ('firma');
