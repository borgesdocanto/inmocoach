import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { isSuperAdmin } from "../../../lib/adminGuard";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email || !isSuperAdmin(session.user.email)) return res.status(403).end();

  const { data: sub } = await supabaseAdmin.from("subscriptions").select("team_id").eq("email", session.user.email).single();
  const { data: team } = await supabaseAdmin.from("teams").select("tokko_api_key").eq("id", sub?.team_id || "").single();

  if (!team?.tokko_api_key) return res.status(200).json({ error: "no api key" });

  // Fetch ONE property live from Tokko and show ALL its fields
  const r = await fetch(`https://www.tokkobroker.com/api/v1/property/?key=${team.tokko_api_key}&format=json&limit=1`);
  const d = await r.json();
  const prop = d.objects?.[0];
  if (!prop) return res.status(200).json({ error: "no props" });

  // Extract all date/update related fields
  const dateFields: Record<string, any> = {};
  Object.keys(prop).forEach(k => {
    if (k.includes("date") || k.includes("update") || k.includes("modif") || k.includes("creat") || k.includes("time")) {
      dateFields[k] = prop[k];
    }
  });

  return res.status(200).json({
    dateFields,
    allKeys: Object.keys(prop),
    status: prop.status,
    producerEmail: prop.producer?.email,
  });
}
