import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { isSuperAdmin } from "../../../lib/adminGuard";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email || !isSuperAdmin(session.user.email)) return res.status(403).end();

  const { data: sub } = await supabaseAdmin.from("subscriptions").select("team_id").eq("email", session.user.email).single();
  
  const { data: sample } = await supabaseAdmin
    .from("tokko_properties")
    .select("producer_email, producer_name, days_since_update, photos_count, status, synced_at")
    .eq("team_id", sub?.team_id || "")
    .eq("status", 2)
    .limit(5);

  const { data: stats } = await supabaseAdmin
    .from("tokko_properties")
    .select("days_since_update, producer_email")
    .eq("team_id", sub?.team_id || "")
    .eq("status", 2)
    .not("days_since_update", "is", null)
    .gt("days_since_update", 30)
    .limit(10);

  return res.status(200).json({ sample, staleCount: stats?.length, staleExamples: stats });
}
