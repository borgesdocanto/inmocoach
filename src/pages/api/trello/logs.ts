import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { getSession } from "next-auth/react";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Obtener email (intenta sesión, luego header)
    let userEmail = null;
    try {
      const session = await getSession({ req });
      userEmail = session?.user?.email;
    } catch (e) {
      console.log("⚠️ [logs] getSession falló");
    }

    if (!userEmail) {
      userEmail = req.headers["x-user-email"] as string;
    }

    if (!userEmail) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Verificar GALAS owner/team_leader
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("team_id, team_role")
      .eq("email", userEmail)
      .single();

    if (!sub) {
      return res.status(403).json({ error: "User not found" });
    }

    const isGalasTeam = sub.team_id === "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93";
    const isAuthorized = (sub.team_role === "owner" || sub.team_role === "team_leader") && isGalasTeam;

    if (!isAuthorized) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Traer logs
    const { data: logs } = await supabaseAdmin
      .from("trello_sync_log")
      .select("*")
      .eq("team_id", "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93")
      .order("created_at", { ascending: false })
      .limit(20);

    res.status(200).json({ logs: logs || [] });
  } catch (error: any) {
    console.error("Logs error:", error);
    res.status(500).json({ error: error.message });
  }
}
