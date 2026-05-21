-- Migration: app_config multitenant
-- Agrega team_id nullable para overrides por tenant
-- NULL = configuración global de plataforma (default)
-- team_id = override específico para esa inmobiliaria

ALTER TABLE app_config ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id) ON DELETE CASCADE;

-- Unique constraint: una key puede tener un valor global (team_id null) y un override por team
-- La constraint anterior era solo (key), ahora es (key, team_id) con nulls distintos
-- Primero eliminamos el unique viejo si existe
ALTER TABLE app_config DROP CONSTRAINT IF EXISTS app_config_key_key;
ALTER TABLE app_config DROP CONSTRAINT IF EXISTS app_config_pkey;

-- Nueva PK compuesta (si tenía id como PK, la mantenemos; si no, usamos key+team_id)
-- Verificamos: agregamos unique que soporte nulls correctamente
CREATE UNIQUE INDEX IF NOT EXISTS app_config_key_team_unique 
  ON app_config (key, team_id) 
  WHERE team_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS app_config_key_global_unique 
  ON app_config (key) 
  WHERE team_id IS NULL;

-- Índice de búsqueda por team
CREATE INDEX IF NOT EXISTS app_config_team_id_idx ON app_config (team_id);

-- RLS: la tabla es leída solo por service role (supabaseAdmin), no necesita RLS por usuario
