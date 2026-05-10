-- Agregar team_id a firma_plantillas para multitenancy
ALTER TABLE firma_plantillas ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE firma_plantillas ADD COLUMN IF NOT EXISTS es_global boolean DEFAULT false;

-- Las plantillas insertadas inicialmente son globales (visibles para todos)
UPDATE firma_plantillas SET es_global = true WHERE team_id IS NULL;

-- Agregar team_id a firma_documentos para queries más fáciles
ALTER TABLE firma_documentos ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id);

-- Índice para filtrar por team
CREATE INDEX IF NOT EXISTS idx_firma_plantillas_team ON firma_plantillas(team_id);
CREATE INDEX IF NOT EXISTS idx_firma_documentos_team ON firma_documentos(team_id);
