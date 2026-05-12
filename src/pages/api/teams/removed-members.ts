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

  if (sub?.team_role !== "owner" || !sub?.team_id)
    return res.status(200).json({ removed: [] });

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabaseAdmin
    .from("team_removals")
    .select("removed_email, removed_at, blocked_until, free_until")
    .eq("team_id", sub.team_id)
    .gte("removed_at", since)
    .order("removed_at", { ascending: false });

  return res.status(200).json({ removed: data || [] });
}
