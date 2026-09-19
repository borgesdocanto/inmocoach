# Migration: Agregar tokko_deleted_at a systeme_contact_cache

## Estado: PENDIENTE EJECUTAR

Este archivo contiene las instrucciones para ejecutar la migration SQL que agrégá la columna `tokko_deleted_at` a la tabla `systeme_contact_cache`.

## Paso 1: Acceder a Supabase SQL Editor

1. Ir a https://supabase.com/dashboard/project/hjyyqxjzlgiywgvikzsa/sql/new
2. Copiar el SQL de abajo

## Paso 2: Ejecutar SQL

Pegá este SQL en el SQL Editor de Supabase:

```sql
-- Agregar columna tokko_deleted_at
ALTER TABLE systeme_contact_cache
ADD COLUMN tokko_deleted_at DATE;

-- Crear índice para búsquedas eficientes
CREATE INDEX idx_systeme_contact_cache_tokko_deleted_at 
ON systeme_contact_cache(tokko_deleted_at);

-- Comentario para referencia
COMMENT ON COLUMN systeme_contact_cache.tokko_deleted_at IS 
'Fecha de última edición en Tokko (deleted_at). Usado para sync histórico hacia atrás.';
```

Presioná **RUN** (Ctrl+Enter).

## Paso 3: Verificar

Chequeá que la columna aparezca en la tabla:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'systeme_contact_cache'
ORDER BY ordinal_position;
```

Debería incluir: `tokko_deleted_at | date`

## Qué hace:

- Agregá una columna `DATE` que guardá la fecha de última edición en Tokko (`deleted_at`)
- Creá un índice para que las búsquedas en CRON 2 (sync histórico) sean rápidas
- Permite sincronizar contactos hacia atrás en el tiempo sin conflictos de whitelist

## Cambios de código ya aplicados:

- ✅ `persistNewContactToCache()` ahora guarda `tokko_deleted_at`
- ✅ `processSingleContact()` guarda `tokko_deleted_at` en ambas rutas
- ✅ `getOldestSyncedDate()` nueva función exportada para CRON 2
- ✅ Commit: `1450bcd`

## Próximos pasos:

1. [PENDIENTE] Ejecutar esta migration en Supabase
2. [PENDIENTE] Implementar CRON 2 en `pages/api/systeme/run.ts`
3. [PENDIENTE] Mostrar fecha más antigua en UI
