import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { supabaseAdmin } from "../../lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).end();

  const { data } = await supabaseAdmin
    .from("coach_reports")
    .select("period_key, advice, profile, created_at")
    .eq("user_email", session.user.email)
    .order("created_at", { ascending: false })
    .limit(20);

  return res.status(200).json({ reports: data ?? [] });
}
