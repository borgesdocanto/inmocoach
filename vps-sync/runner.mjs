#!/usr/bin/env node
/**
 * vps-sync/runner.mjs — scheduler único del sync Tokko → Systeme en el VPS.
 *   22:00 UTC (19:00 ARG) → CRON 1 "recent"   (ventana de 3 días)
 *   23:00 UTC (20:00 ARG) → CRON 2 "historic" (retrocede 7 días)
 * Las corridas van en fila (nunca dos a la vez). Al arrancar, si la última corrida
 * "recent" exitosa tiene más de 20h, se ejecuta una para ponerse al día (ej. tras reiniciar el VPS).
 */
import cron from "node-cron";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOTOR = path.join(__dirname, "systeme-sync-node.cjs");

let queue = Promise.resolve();
let current = null;

function run(mode, extra = []) {
  queue = queue.then(() => new Promise((resolve) => {
    console.log(`\n⏰ ${new Date().toISOString()} — lanzando sync ${mode} ${extra.join(" ")}`);
    current = spawn(process.execPath, [MOTOR, mode, ...extra], { cwd: __dirname, stdio: "inherit" });
    current.on("exit", (code) => { console.log(`↩ sync ${mode} terminó con código ${code}`); current = null; resolve(); });
    current.on("error", (err) => { console.error(`❌ no se pudo lanzar el motor: ${err.message}`); current = null; resolve(); });
  }));
  return queue;
}

cron.schedule("0 22 * * *", () => run("recent"), { timezone: "UTC" });
cron.schedule("0 23 * * *", () => run("historic"), { timezone: "UTC" });
console.log("📅 Scheduler iniciado — recent 22:00 UTC (19:00 ARG), historic 23:00 UTC (20:00 ARG)");

// Puesta al día tras (re)inicio: solo corre si hace falta.
setTimeout(() => run("recent", ["--if-stale"]), 15_000);

for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    console.log(`⏹️  ${sig} recibido, cerrando…`);
    if (current) current.kill(sig);
    process.exit(0);
  });
}
