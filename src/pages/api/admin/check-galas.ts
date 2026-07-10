import { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const session = await getSession({ req });

    if (!session || session.user?.email !== "leandro@galas.com.ar") {
      return res.status(403).json({ error: "Not GALAS" });
    }

    res.status(200).json({ success: true, isGalas: true });
  } catch {
    res.status(403).json({ error: "Not authorized" });
  }
}
