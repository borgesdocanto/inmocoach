import { NextApiRequest, NextApiResponse } from "next";
import { waitUntil } from "@vercel/functions";
import { getAppConfig } from "../../../lib/appConfig";
import { syncReservedToTrello } from "../../../lib/trelloSync";

export const config = {
  maxDuration: 60,
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

  const trelloKey = process.env.TRELLO_API_KEY;
  const trelloToken = process.env.TRELLO_TOKEN;
  const trelloBoardId = process.env.TRELLO_BOARD_ID;

  if (!trelloKey || !trelloToken || !trelloBoardId) {
    return res.status(400).json({ error: "Trello credentials not configured" });
  }

  // Responder ya y trabajar en background: cron-job.org corta a los 30s
  // y esta corrida venia tardando 27s.
  waitUntil(runTrelloSync(trelloKey, trelloToken, trelloBoardId));
  return res.status(202).json({ ok: true, message: "Trello sync iniciado" });
}

async function runTrelloSync(trelloKey: string, trelloToken: string, trelloBoardId: string) {
  const teamId = "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93"; // GALAS exclusivo
  try {
    console.log("🔄 [CRON] Iniciando sincronización Trello diaria...");
    const result = await syncReservedToTrello(teamId, trelloKey, trelloToken, trelloBoardId, 62);
    console.log(`✅ [CRON] Sincronización completada: ${result.created} tarjetas`);
  } catch (error: any) {
    console.error("❌ [CRON] Error:", error.message);
  }
}
