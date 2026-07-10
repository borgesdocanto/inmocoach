import { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { supabaseAdmin } from "../../../lib/supabase";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getSession({ req });
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Traer info del usuario
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("team_id, team_role")
      .eq("email", session.user?.email)
      .single();

    if (!sub) {
      return res.status(403).json({ error: "User not found" });
    }

    const teamId = sub.team_id;
    const role = sub.team_role;

    // Solo owner o team_leader de GALAS
    const isGalasTeam = teamId === "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93";
    const isAuthorized = (role === "owner" || role === "team_leader") && isGalasTeam;

    if (!isAuthorized) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { data: logs } = await supabaseAdmin
      .from("trello_sync_log")
      .select("*")
      .eq("team_id", teamId)
      .order("started_at", { ascending: false })
      .limit(50);

    res.status(200).json({
      success: true,
      logs: (logs || []).map((log: any) => ({
        id: log.id,
        team_id: log.team_id,
        status: log.status,
        properties_found: log.properties_found,
        cards_created: log.cards_created,
        started_at: log.started_at,
        completed_at: log.completed_at,
        errors: log.errors || [],
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
