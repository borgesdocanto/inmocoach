// POST /api/admin/systeme-toggle
// Activa o desactiva la sincronización Systeme.io para un team (solo super admin)
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { requireSuperAdmin } from "../../../lib/adminGuard";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!requireSuperAdmin(session, res)) return;

  const { teamId, active } = req.body as { teamId: string; active: boolean };
  if (!teamId || typeof active !== "boolean") return res.status(400).json({ error: "Parámetros inválidos" });

  // Upsert sync_config para este team
  const { error } = await supabaseAdmin
    .from("sync_configs")
    .upsert({ team_id: teamId, is_active: active, updated_at: new Date().toISOString() }, { onConflict: "team_id" });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true, active });
}
