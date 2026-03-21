/**
 * Cron: renueva los Google Calendar watches que están por vencer.
 * Los watches expiran en máximo 7 días. Este cron corre 2x/día
 * y renueva los que vencen en las próximas 24 horas.
 */
import { NextApiRequest, NextApiResponse } from "next";
import { renewExpiringWatches } from "../../../lib/calendarWatch";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isVercel = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  const isManual = req.headers["x-cron-secret"] === process.env.CRON_SECRET || req.query.secret === process.env.CRON_SECRET;
  if (!isVercel && !isManual) return res.status(401).json({ error: "Unauthorized" });

  console.log("[renew-watches] Starting...");
  const result = await renewExpiringWatches();
  console.log("[renew-watches] Done:", result);

  return res.status(200).json({ ok: true, ...result });
}
