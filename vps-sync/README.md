# vps-sync — sync Tokko → Systeme.io en el VPS

Un solo motor (`src/lib/systemeSync.ts`, el mismo que usa Vercel) y un solo scheduler.
No tiene límite de 300s. Cada corrida deja una fila en `sync_logs` con `trigger = 'vps'`.

| Hora (UTC) | Hora ARG | Modo | Qué hace |
|---|---|---|---|
| 22:00 | 19:00 | `recent` (CRON 1) | Ventana de 3 días |
| 23:00 | 20:00 | `historic` (CRON 2) | Retrocede 7 días desde lo más antiguo |

Al arrancar el runner, si la última corrida `recent` exitosa tiene más de 20h, ejecuta una para ponerse al día.

## Resistencia a fallas

- Tokko 502/503/504, 429, timeout o error de red: reintento por página (5s, 10s, 20s, 40s, 80s, 120s).
- Si aun así falla todo: reintento de la corrida completa (a los 5 y 15 min, hasta 3 intentos).
- Un 4xx de Tokko (ej. API key inválida) NO se reintenta: es un error real y se informa.
- Emails que Systeme rechaza (inválido, buzón lleno) cuentan como **salteados**, no como errores.
- Estados: `success` (sin errores) · `partial` (errores reales en algunos contactos) · `error` (falla total tras todos los intentos).
- Nunca corren dos a la vez; un log "running" de más de 90 min se cierra como colgado.

## Archivos

- `vps-sync.ts` — fuente de la entrada (modos `recent` / `historic`, flag `--if-stale`).
- `dist/systeme-sync-node.cjs` — bundle generado (motor + Supabase). **No editar a mano.**
- `runner.mjs` — scheduler (node-cron). Se levanta con PM2.

## Regenerar el bundle

```bash
npm i --no-save esbuild dotenv
npx esbuild vps-sync/vps-sync.ts --bundle --platform=node --target=node20 --format=cjs \
  --outfile=vps-sync/dist/systeme-sync-node.cjs
```

## Despliegue en el VPS (`/opt/inmocoach-sync`)

```bash
cd /opt/inmocoach-sync
git fetch origin <rama> && git checkout FETCH_HEAD -- vps-sync
cp vps-sync/dist/systeme-sync-node.cjs systeme-sync-node.cjs
cp vps-sync/runner.mjs sync-runner-local.js   # o arrancar runner.mjs directo
pm2 restart inmocoach-sync && pm2 save
```

Requiere `.env` con `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en la misma carpeta.
