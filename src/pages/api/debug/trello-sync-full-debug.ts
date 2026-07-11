import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { syncReservedToTrello } from "../../../lib/trelloSync";
import { getSession } from "next-auth/react";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let userEmail: string | undefined = req.query.email as string;
    
    if (!userEmail) {
      try {
        const session = await getSession({ req });
        userEmail = session?.user?.email || undefined;
      } catch (e) {
        userEmail = (req.headers["x-user-email"] as string) || undefined;
      }
    }

    if (!userEmail) {
      return res.status(401).json({ error: "Unauthorized" });
    }

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

    // Obtener credenciales
    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("id")
      .eq("id", sub.team_id)
      .single();

    if (!team) {
      return res.status(400).json({ error: "Team not found" });
    }

    // Obtener credenciales Trello de app_config
    const { data: appConfig } = await supabaseAdmin
      .from("app_config")
      .select("value")
      .eq("team_id", team.id)
      .in("key", ["TRELLO_KEY", "TRELLO_TOKEN", "TRELLO_BOARD_ID"])
      .single();

    if (!appConfig) {
      return res.status(400).json({ error: "Trello config not found" });
    }

    // Parsear config
    const trelloKey = process.env.TRELLO_API_KEY;
    const trelloToken = process.env.TRELLO_TOKEN;
    const trelloBoardId = process.env.TRELLO_BOARD_ID;

    if (!trelloKey || !trelloToken || !trelloBoardId) {
      return res.status(400).json({ error: "Trello credentials missing in env" });
    }

    console.log("🚀 Iniciando sync de debug...");
    console.log(`Trello Board ID: ${trelloBoardId}`);
    console.log(`Trello Key: ${trelloKey.substring(0, 5)}...`);

    // Ejecutar sync
    const result = await syncReservedToTrello(
      team.id,
      trelloKey,
      trelloToken,
      trelloBoardId,
      62 // branch Ituzaingó
    );

    res.status(200).json({
      success: true,
      syncResult: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: error.message,
      stack: error.stack?.split("\n").slice(0, 5),
    });
  }
}
