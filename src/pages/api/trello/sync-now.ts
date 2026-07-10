import { NextApiRequest, NextApiResponse } from "next";
import { syncReservedToTrello } from "../../../lib/trelloSync";
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
    const session = await getSession({ req });

    // Solo GALAS (super admin)
    if (!session || session.user?.email !== "leandro@galas.com.ar") {
      return res.status(403).json({ error: "Unauthorized" });
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
