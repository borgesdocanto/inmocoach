import { NextApiRequest, NextApiResponse } from "next";
import { syncReservedToTrello } from "../../../lib/trelloSync";
import { getSession } from "next-auth/react";
import { supabaseAdmin } from "../../../lib/supabase";

export const config = {
  maxDuration: 60,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("🔍 [sync-now] Intentando obtener sesión...");
    const session = await getSession({ req });
    console.log("🔍 [sync-now] Sesión:", session?.user?.email || "NO SESSION");
    
    if (!session) {
      console.error("❌ [sync-now] No hay sesión - cookies recibidas:", req.headers.cookie ? "SÍ" : "NO");
      return res.status(401).json({ error: "Unauthorized - No session" });
    }
    console.log("✅ [sync-now] Sesión OK:", session.user?.email);

    // Verificar que sea owner o team_leader de GALAS
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("team_id, team_role")
      .eq("email", session.user?.email)
      .single();

    if (!sub) {
      return res.status(403).json({ error: "User not found" });
    }

    const isGalasTeam = sub.team_id === "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93";
    const isAuthorized = (sub.team_role === "owner" || sub.team_role === "team_leader") && isGalasTeam;

    if (!isAuthorized) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Credenciales Trello (guardar en Vercel env o Supabase)
    const trelloKey = process.env.TRELLO_API_KEY;
    const trelloToken = process.env.TRELLO_TOKEN;
    const trelloBoardId = process.env.TRELLO_BOARD_ID;
    const teamId = "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93"; // GALAS

    if (!trelloKey || !trelloToken || !trelloBoardId) {
      return res.status(400).json({ error: "Trello credentials not configured" });
    }

    const branchId = req.body?.branchId || 62; // Ituzaingó por defecto

    const result = await syncReservedToTrello(
      teamId,
      trelloKey,
      trelloToken,
      trelloBoardId,
      branchId
    );

    if (result.success) {
      res.status(200).json({
        success: true,
        message: `${result.created} tarjetas sincronizadas a Trello`,
        created: result.created,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error: any) {
    console.error("Sync error:", error);
    res.status(500).json({ error: error.message });
  }
}
