-- Migration: Agregar campos trigger y cron_mode a sync_logs
-- Permite trackear cómo se disparó el sync (cron vs manual) y qué tipo de CRON fue

ALTER TABLE sync_logs
ADD COLUMN trigger TEXT DEFAULT 'manual', -- 'cron' | 'manual'
ADD COLUMN cron_mode TEXT DEFAULT 'recent'; -- 'recent' | 'historic'

-- Comentarios para referencia
COMMENT ON COLUMN sync_logs.trigger IS 'Cómo se disparó: cron (scheduler) | manual (UI)';
COMMENT ON COLUMN sync_logs.cron_mode IS 'Tipo de sync: recent (últimos 3 días) | historic (hacia atrás)';
