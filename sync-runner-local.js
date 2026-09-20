#!/usr/bin/env node

/**
 * sync-runner-local.js
 * Ejecutor local del sync histórico en el VPS
 * Corre el script systeme-sync-node.js directamente sin depender de Vercel
 */

import cron from 'node-cron';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SYNC_SCRIPT = path.join(__dirname, 'systeme-sync-node.js');

async function runSync() {
  console.log(`\n⏰ ${new Date().toISOString()} — Iniciando sync histórico...`);

  return new Promise((resolve, reject) => {
    const process = spawn('node', [SYNC_SCRIPT], {
      stdio: 'inherit', // mostrar logs del subprocess
      env: { ...process.env },
    });

    process.on('exit', (code) => {
      if (code === 0) {
        console.log('✅ Sync completado exitosamente');
        resolve();
      } else {
        console.error(`❌ Sync falló con código ${code}`);
        reject(new Error(`Sync exit code: ${code}`));
      }
    });

    process.on('error', (err) => {
      console.error(`❌ Error al ejecutar sync: ${err.message}`);
      reject(err);
    });
  });
}

// Programar CRON — 23:00 UTC diario
console.log('📅 Scheduler iniciado — Cron cada día a las 23:00 UTC');
cron.schedule('0 23 * * *', runSync, { timezone: 'UTC' });

// Ejecutar también al iniciar (después de 10 segundos para que PM2 se estabilice)
setTimeout(() => {
  runSync().catch(err => console.error('Error en first run:', err));
}, 10000);

// Mantener el proceso vivo
process.on('SIGTERM', () => {
  console.log('⏹️  SIGTERM recibido, cerrando gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('⏹️  SIGINT recibido, cerrando gracefully...');
  process.exit(0);
});
