// POST /api/systeme/cleanup-stuck
// Limpia logs con status "running" antiguo (>5 min) y permite reintentar
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getEffectiveEmail } from "../../../lib/impersonation";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  
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
    return res.status(403).json({ error: "Sin permiso" });
  }

  if (sub.team_id !== "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93") {
    return res.status(403).json({ error: "Feature no disponible" });
  }

  // Buscar logs con status "running" más antiguos a 5 minutos
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  const { data: stuckLogs, error: selectError } = await supabaseAdmin
    .from("sync_logs")
    .select("id, started_at")
    .eq("team_id", sub.team_id)
    .eq("status", "running")
    .lt("started_at", fiveMinutesAgo);

  if (selectError) {
    return res.status(500).json({ error: selectError.message });
  }

  if (!stuckLogs || stuckLogs.length === 0) {
    return res.json({ message: "No hay logs atrapados", cleaned: 0 });
  }

  // Marcar como error parcial/expirado
  const { error: updateError } = await supabaseAdmin
    .from("sync_logs")
    .update({
      status: "error",
      error_detail: "Sincronización timeoutó en background (>5 min sin finalizar)",
      finished_at: new Date().toISOString()
    })
    .eq("team_id", sub.team_id)
    .eq("status", "running")
    .lt("started_at", fiveMinutesAgo);

  if (updateError) {
    return res.status(500).json({ error: updateError.message });
  }

  return res.json({
    message: "Logs atrapados marcados como error",
    cleaned: stuckLogs.length,
    logs: stuckLogs.map(l => ({ id: l.id, started_at: l.started_at }))
  });
}
