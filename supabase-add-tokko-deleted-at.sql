-- Migration: Agregar tokko_deleted_at a systeme_contact_cache
-- Permite trackear cuál fue la última edición en Tokko de cada contacto
-- Usado para sync gradual hacia atrás en el tiempo

ALTER TABLE systeme_contact_cache
ADD COLUMN tokko_deleted_at DATE;

CREATE INDEX idx_systeme_contact_cache_tokko_deleted_at 
ON systeme_contact_cache(tokko_deleted_at);

-- Comentario para referencia
COMMENT ON COLUMN systeme_contact_cache.tokko_deleted_at IS 
'Fecha de última edición en Tokko (deleted_at). Usado para sync histórico hacia atrás.';
