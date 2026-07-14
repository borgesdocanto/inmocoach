import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.status(200).json({
    success: true,
    headers_received: {
      authorization: req.headers.authorization || "NOT FOUND",
      "x-cron-secret": req.headers["x-cron-secret"] || "NOT FOUND",
      "content-type": req.headers["content-type"] || "NOT FOUND",
      host: req.headers.host || "NOT FOUND",
      "user-agent": req.headers["user-agent"] || "NOT FOUND",
    },
    all_headers: Object.keys(req.headers),
    method: req.method,
  });
}
