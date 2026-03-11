import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { getTeamStatus } from "../../../lib/subscription";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const { teamId } = req.query;
  if (!teamId || typeof teamId !== "string") return res.status(400).json({ error: "teamId requerido" });

  const result = await getTeamStatus(teamId);
  return res.status(200).json(result);
}
