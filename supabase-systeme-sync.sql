-- ============================================================
-- InmoCoach — Módulo Tokko → Systeme.io
-- Migration: supabase-systeme-sync.sql
-- ============================================================

-- 1. Configuración de sincronización por equipo
CREATE TABLE IF NOT EXISTS sync_configs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  systeme_api_key text,
  is_active       boolean NOT NULL DEFAULT false,   -- activado por super admin
  is_configured   boolean NOT NULL DEFAULT false,   -- el broker terminó de configurar
  systeme_fields_created boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id)
);

-- 2. Whitelist de tags Tokko que se sincronizan
CREATE TABLE IF NOT EXISTS sync_tags_whitelist (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id   uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  tag_name  text NOT NULL,
  UNIQUE(team_id, tag_name)
);

-- 3. Tags fijas que se agregan siempre a cada contacto
CREATE TABLE IF NOT EXISTS sync_tags_fixed (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id   uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  tag_name  text NOT NULL,
  UNIQUE(team_id, tag_name)
);

-- 4. Historial de corridas de sincronización
CREATE TABLE IF NOT EXISTS sync_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id           uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  started_at        timestamptz NOT NULL DEFAULT now(),
  finished_at       timestamptz,
  contacts_created  int NOT NULL DEFAULT 0,
  contacts_updated  int NOT NULL DEFAULT 0,
  contacts_skipped  int NOT NULL DEFAULT 0,
  errors_count      int NOT NULL DEFAULT 0,
  error_detail      text,
  status            text NOT NULL DEFAULT 'running' -- 'running' | 'success' | 'partial' | 'error'
);

-- RLS: solo el super admin y el owner del team acceden
ALTER TABLE sync_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_tags_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_tags_fixed ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para service_role (endpoints API)
DROP POLICY IF EXISTS "service_role_sync_configs" ON sync_configs;
CREATE POLICY "service_role_sync_configs" ON sync_configs USING (true);

DROP POLICY IF EXISTS "service_role_sync_tags_whitelist" ON sync_tags_whitelist;
CREATE POLICY "service_role_sync_tags_whitelist" ON sync_tags_whitelist USING (true);

DROP POLICY IF EXISTS "service_role_sync_tags_fixed" ON sync_tags_fixed;
CREATE POLICY "service_role_sync_tags_fixed" ON sync_tags_fixed USING (true);

DROP POLICY IF EXISTS "service_role_sync_logs" ON sync_logs;
CREATE POLICY "service_role_sync_logs" ON sync_logs USING (true);
