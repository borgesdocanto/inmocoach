// GET  /api/systeme/config  — devuelve la config del team del usuario
// POST /api/systeme/config  — guarda apiKey, tags whitelist y tags fijas
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase";
import { getEffectiveEmail } from "../../../lib/impersonation";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });
  const email = getEffectiveEmail(req, session);

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, team_role")
    .eq("email", email)
    .single();

  if (!sub?.team_id) return res.status(403).json({ error: "Sin equipo" });
  if (sub.team_role !== "owner" && sub.team_role !== "team_leader") {
    return res.status(403).json({ error: "Solo el broker o team leader puede configurar esto" });
  }

  const teamId = sub.team_id;

  const { data: syncConfig } = await supabaseAdmin
    .from("sync_configs")
    .select("*")
    .eq("team_id", teamId)
    .single();

  if (!syncConfig?.is_active) return res.status(403).json({ error: "Feature no activada para este equipo" });

  if (req.method === "GET") {
    const [{ data: whitelist }, { data: fixed }] = await Promise.all([
      supabaseAdmin.from("sync_tags_whitelist").select("tag_name").eq("team_id", teamId),
      supabaseAdmin.from("sync_tags_fixed").select("tag_name").eq("team_id", teamId),
    ]);

    const keyPreview = syncConfig.systeme_api_key
      ? `${"•".repeat(Math.max(0, syncConfig.systeme_api_key.length - 6))}${syncConfig.systeme_api_key.slice(-6)}`
      : null;

    return res.json({
      hasKey: !!syncConfig.systeme_api_key,
      keyPreview,
      isConfigured: syncConfig.is_configured,
      whitelist: (whitelist || []).map((r: { tag_name: string }) => r.tag_name),
      fixed: (fixed || []).map((r: { tag_name: string }) => r.tag_name),
    });
  }

  if (req.method === "POST") {
    const { apiKey, whitelist, fixed } = req.body as {
      apiKey?: string;
      whitelist?: string[];
      fixed?: string[];
    };

    if (!whitelist || whitelist.length < 4) {
      return res.status(400).json({ error: "Debés seleccionar al menos 4 tags de Tokko para sincronizar" });
    }

    if (apiKey) {
      const valid = await validateSystemeKey(apiKey);
      if (!valid) return res.status(400).json({ error: "API key de Systeme.io inválida o sin acceso" });
    } else if (!syncConfig.systeme_api_key) {
      return res.status(400).json({ error: "Debés ingresar tu API key de Systeme.io" });
    }

    await Promise.all([
      supabaseAdmin.from("sync_configs").update({
        ...(apiKey ? { systeme_api_key: apiKey } : {}),
        is_configured: true,
        updated_at: new Date().toISOString(),
      }).eq("team_id", teamId),
      supabaseAdmin.from("sync_tags_whitelist").delete().eq("team_id", teamId),
      supabaseAdmin.from("sync_tags_fixed").delete().eq("team_id", teamId),
    ]);

    const inserts: Promise<unknown>[] = [];
    if (whitelist.length > 0) {
      inserts.push(
        supabaseAdmin.from("sync_tags_whitelist").insert(
          whitelist.map((tag_name: string) => ({ team_id: teamId, tag_name }))
        )
      );
    }
    if (fixed && fixed.length > 0) {
      inserts.push(
        supabaseAdmin.from("sync_tags_fixed").insert(
          fixed.map((tag_name: string) => ({ team_id: teamId, tag_name }))
        )
      );
    }
    await Promise.all(inserts);
    return res.json({ ok: true });
  }

  return res.status(405).end();
}

async function validateSystemeKey(apiKey: string): Promise<boolean> {
  try {
    const r = await fetch("https://api.systeme.io/api/tags?limit=1", {
      headers: { "X-API-Key": apiKey, accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    return r.status === 200;
  } catch {
    return false;
  }
}
