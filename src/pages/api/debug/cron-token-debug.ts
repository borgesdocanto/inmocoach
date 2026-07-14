import { NextApiRequest, NextApiResponse } from "next";
import { getAppConfig } from "../../../lib/appConfig";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const secret = req.headers.authorization?.replace("Bearer ", "");
  const vercelSecret = req.headers["x-cron-secret"];

  const appConfig = await getAppConfig();
  const systemeCronToken = appConfig?.systeme_cron_token;

  res.status(200).json({
    success: true,
    headers_received: {
      authorization_header: req.headers.authorization || "NOT FOUND",
      secret_extracted: secret || "NOT FOUND",
      "x-cron-secret": vercelSecret || "NOT FOUND",
    },
    config: {
      systeme_cron_token_in_db: systemeCronToken || "NOT FOUND",
      CRON_SECRET_env: process.env.CRON_SECRET || "NOT FOUND",
    },
    comparisons: {
      secret_matches_systeme_token: secret === systemeCronToken,
      secret_matches_cron_secret: vercelSecret === process.env.CRON_SECRET,
      secret_length: secret?.length || 0,
      systeme_token_length: systemeCronToken?.length || 0,
    },
  });
}
