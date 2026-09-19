-- ============================================================
-- InmoCoach — Cache de contactos sincronizados con Systeme
-- Migration: supabase-systeme-contact-cache.sql
-- ============================================================

-- Cache para mapear emails de contactos a sus IDs en Systeme
-- Permite verificar rápidamente si un contacto ya fue creado
CREATE TABLE IF NOT EXISTS systeme_contact_cache (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email           text NOT NULL,
  systeme_id      bigint NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, email)
);

-- Índice para búsquedas rápidas por team_id
CREATE INDEX IF NOT EXISTS idx_systeme_contact_cache_team_id ON systeme_contact_cache(team_id);

-- RLS: solo service_role accede (desde endpoints API)
ALTER TABLE systeme_contact_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_systeme_contact_cache" ON systeme_contact_cache;
CREATE POLICY "service_role_systeme_contact_cache" ON systeme_contact_cache USING (true);
