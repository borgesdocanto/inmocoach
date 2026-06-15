// GET/POST /api/github-cron/[name]
// Proxy que GitHub Actions llama. Valida el token externo y reenvía al cron real
// con el CRON_SECRET interno. Esto evita modificar cada cron individualmente.
import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";

export const config = { maxDuration: 300 };

const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL = process.env.NEXTAUTH_URL ?? "https://www.inmocoach.com.ar";

const ALLOWED_CRONS = new Set([
  "weekly-email", "team-email", "midweek-alert", "daily-sync", "deep-sync",
  "tokko-sync", "trial-emails", "reactivation", "watch-renewal",
  "firma-cleanup", "birthday-email", "loyalty-emails", "streak-alert",
]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const name = req.query.name as string;
  if (!ALLOWED_CRONS.has(name)) {
    return res.status(404).json({ error: "Cron no permitido" });
  }

  // Validar token externo
  const authHeader = req.headers.authorization ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Falta Authorization Bearer" });
  }
  const candidate = authHeader.slice(7);
  const { data: tokenRow } = await supabaseAdmin
    .from("app_config").select("value").eq("key", "systeme_cron_token")
    .is("team_id", null).maybeSingle();
  if (!tokenRow?.value || tokenRow.value !== candidate) {
    return res.status(401).json({ error: "Token inválido" });
  }

  // Llamar al cron real con el CRON_SECRET de Vercel
  try {
    const r = await fetch(`${BASE_URL}/api/cron/${name}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
      signal: AbortSignal.timeout(290000),
    });
    const text = await r.text();
    let body: unknown;
    try { body = JSON.parse(text); } catch { body = text.slice(0, 500); }
    return res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status, body });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
}
