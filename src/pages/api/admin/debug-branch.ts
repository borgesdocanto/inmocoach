import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { isSuperAdmin } from "../../../lib/adminGuard";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email || !isSuperAdmin(session.user.email)) return res.status(403).end();

  const targetEmail = (req.query.email as string) || session.user.email;

  const { data: sub } = await supabaseAdmin.from("subscriptions").select("team_id").eq("email", targetEmail).single();
  const { data: team } = await supabaseAdmin.from("teams").select("tokko_api_key, agency_name").eq("id", sub?.team_id || "").single();
  const { data: agents } = await supabaseAdmin.from("tokko_agents").select("name, email, branch_id, branch_name").eq("team_id", sub?.team_id || "").eq("email", targetEmail);

  const branchId = agents?.[0]?.branch_id;

  let branches: any[] = [];
  let matchedBranch: any = null;

  if (team?.tokko_api_key) {
    const r = await fetch(`https://www.tokkobroker.com/api/v1/branch/?key=${team.tokko_api_key}&format=json&limit=50`);
    if (r.ok) {
      const d = await r.json();
      branches = (d.objects || []).map((b: any) => ({
        id: b.id, name: b.name,
        logo: b.logo || null, logo_url: b.logo_url || null,
        picture: b.picture || null, image: b.image || null,
        keys: Object.keys(b),
      }));
      matchedBranch = branches.find(b => String(b.id) === String(branchId));
    }
  }

  return res.status(200).json({
    targetEmail, teamId: sub?.team_id, agencyName: team?.agency_name,
    hasApiKey: !!team?.tokko_api_key,
    tokkoAgent: agents?.[0] || null,
    branchId, branches, matchedBranch,
  });
}
// Note: also check tokko_properties sample via GET ?mode=props
