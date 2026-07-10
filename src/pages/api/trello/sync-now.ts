import { NextApiRequest, NextApiResponse } from "next";
import { syncReservedToTrello } from "../../../lib/trelloSync";
import { supabaseAdmin } from "../../../lib/supabase";
import { getSession } from "next-auth/react";

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
    // Intentar obtener sesión
    let userEmail = null;
    try {
      const session = await getSession({ req });
      userEmail = session?.user?.email;
    } catch (e) {
      console.log("⚠️ [sync-now] getSession falló, intentando por header");
    }

    // Si getSession falló, el cliente debe pasar el email
    if (!userEmail) {
      userEmail = req.headers["x-user-email"] as string;
    }

    console.log("🔍 [sync-now] User email:", userEmail || "MISSING");

    if (!userEmail) {
      return res.status(401).json({ error: "Unauthorized - No email provided" });
    }

    // Verificar que sea owner o team_leader de GALAS
    const { data: sub, error } = await supabaseAdmin
      .from("subscriptions")
      .select("team_id, team_role")
      .eq("email", userEmail)
      .single();

    if (error || !sub) {
      console.error("❌ [sync-now] User not found:", error);
      return res.status(403).json({ error: "User not found" });
    }

    const isGalasTeam = sub.team_id === "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93";
    const isAuthorized = (sub.team_role === "owner" || sub.team_role === "team_leader") && isGalasTeam;

    console.log("🔍 [sync-now] GALAS:", isGalasTeam, "Role:", sub.team_role, "Authorized:", isAuthorized);

    if (!isAuthorized) {
      return res.status(403).json({ error: "Forbidden - Not GALAS owner/team_leader" });
    }

    // Credenciales Trello
    const trelloKey = process.env.TRELLO_API_KEY;
    const trelloToken = process.env.TRELLO_TOKEN;
    const trelloBoardId = process.env.TRELLO_BOARD_ID;
    const teamId = "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93"; // GALAS

    if (!trelloKey || !trelloToken || !trelloBoardId) {
      console.error("❌ [sync-now] Trello credentials missing");
      return res.status(400).json({ error: "Trello credentials not configured" });
    }

    const branchId = req.body?.branchId || 62; // Ituzaingó por defecto

    console.log("✅ [sync-now] Iniciando sync...");
    const result = await syncReservedToTrello(
      teamId,
      trelloKey,
      trelloToken,
      trelloBoardId,
      branchId
    );

    if (result.success) {
      console.log("✅ [sync-now] Sync exitoso:", result.created, "tarjetas");
      res.status(200).json({
        success: true,
        message: `${result.created} tarjetas sincronizadas a Trello`,
        created: result.created,
      });
    } else {
      console.error("❌ [sync-now] Sync fallido:", result.error);
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error: any) {
    console.error("❌ [sync-now] Exception:", error.message);
    res.status(500).json({ error: error.message });
  }
}
