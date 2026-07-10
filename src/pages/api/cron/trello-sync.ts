import { NextApiRequest, NextApiResponse } from "next";
import { getAppConfig } from "../../../lib/appConfig";
import { syncReservedToTrello } from "../../../lib/trelloSync";

export const config = {
  maxDuration: 120,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const secret = req.headers.authorization?.replace("Bearer ", "");
  const vercelSecret = req.headers["x-cron-secret"];

  const appConfig = await getAppConfig();
  const systemeCronToken = appConfig?.systeme_cron_token;

  const isAuthorized =
    vercelSecret === process.env.CRON_SECRET ||
    secret === systemeCronToken;

  if (!isAuthorized) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    console.log("🔄 [CRON] Iniciando sincronización Trello diaria...");

    const trelloKey = process.env.TRELLO_API_KEY;
    const trelloToken = process.env.TRELLO_TOKEN;
    const trelloBoardId = process.env.TRELLO_BOARD_ID;
    const teamId = "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93"; // GALAS exclusivo

    if (!trelloKey || !trelloToken || !trelloBoardId) {
      return res.status(400).json({
        error: "Trello credentials not configured",
      });
    }

    const result = await syncReservedToTrello(
      teamId,
      trelloKey,
      trelloToken,
      trelloBoardId,
      62
    );

    console.log(`✅ [CRON] Sincronización completada: ${result.created} tarjetas`);

    res.status(200).json({
      success: result.success,
      created: result.created,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("❌ [CRON] Error:", error.message);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
