import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { getOrCreateSubscription, isFreemiumExpired } from "../../lib/subscription";
import { getPlanById } from "../../lib/plans";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const sub = await getOrCreateSubscription(
    session.user.email,
    session.user.name ?? undefined,
    session.user.image ?? undefined
  );

  const plan = getPlanById(sub.plan);

  const isExpired = isFreemiumExpired(sub) || sub.status === "cancelled" || sub.status === "past_due";

  return res.status(200).json({
    subscription: { ...sub, isExpired },
    plan,
    isActive: sub.status === "active" && !isExpired,
    isPaid: sub.plan !== "free",
  });
}
