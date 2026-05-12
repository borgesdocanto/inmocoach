import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getEffectiveEmail } from "../../../lib/impersonation";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const email = getEffectiveEmail(req, session) ?? session.user.email;

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, team_role")
    .eq("email", email)
    .single();

  if (!sub?.team_id || sub.team_role !== "owner")
    return res.status(403).json({ error: "Solo el broker" });

  const { data: members } = await supabaseAdmin
    .from("subscriptions")
    .select("email, name, avatar, team_role")
    .eq("team_id", sub.team_id)
    .order("team_role", { ascending: true });

  return res.status(200).json({ members: members || [] });
}
