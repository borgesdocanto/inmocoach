// GET /api/systeme/logs — historial de corridas del team
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getEffectiveEmail } from "../../../lib/impersonation";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
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

  // Integraciones: solo GALAS
  if (sub.team_id !== "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93") {
    return res.status(403).json({ error: "Feature no disponible" });
  }

  const [
    { data: logs, error: logsError },
    { data: cacheData, error: cacheError }
  ] = await Promise.all([
    supabaseAdmin
      .from("sync_logs")
      .select("*")
      .eq("team_id", sub.team_id)
      .order("started_at", { ascending: false })
      .limit(30),
    // Obtener fecha más antigua sincronizada
    supabaseAdmin
      .from("systeme_contact_cache")
      .select("tokko_deleted_at")
      .eq("team_id", sub.team_id)
      .order("tokko_deleted_at", { ascending: true })
      .limit(1)
  ]);

  if (logsError) return res.status(500).json({ error: logsError.message });
  
  const oldestDate = cacheData?.[0]?.tokko_deleted_at ?? null;
  return res.json({ 
    logs: logs || [],
    oldestSyncedDate: oldestDate 
  });
}
