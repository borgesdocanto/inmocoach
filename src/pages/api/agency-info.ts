import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { getEffectiveEmail } from "../../lib/impersonation";
import { supabaseAdmin } from "../../lib/supabase";

const cache: Record<string, { logo: string | null; ts: number }> = {};
const TTL = 1000 * 60 * 60;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).end();

  const email = (getEffectiveEmail(req, session) ?? session.user.email).toLowerCase().trim();

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id")
    .eq("email", email)
    .single();

  if (!sub?.team_id) return res.status(200).json({ logo: null });

  const { data: team } = await supabaseAdmin
    .from("teams")
    .select("tokko_api_key, agency_name, name")
    .eq("id", sub.team_id)
    .single();

  if (!team?.tokko_api_key) return res.status(200).json({ logo: null });

  // 1. Try branch_id from tokko_agents (exact email match)
  const { data: agents } = await supabaseAdmin
    .from("tokko_agents")
    .select("branch_id, email")
    .eq("team_id", sub.team_id)
    .eq("email", email);

  let branchId: number | null = agents?.[0]?.branch_id ?? null;

  // 2. Fallback: derive branch from tokko_properties via producer_email
  if (!branchId) {
    const { data: prop } = await supabaseAdmin
      .from("tokko_properties")
      .select("branch_id")
      .eq("team_id", sub.team_id)
      .eq("producer_email", email)
      .not("branch_id", "is", null)
      .limit(1)
      .maybeSingle();

    branchId = prop?.branch_id ?? null;

    // Persist it so next sync is faster
    if (branchId && agents?.[0]) {
      void supabaseAdmin
        .from("tokko_agents")
        .update({ branch_id: branchId })
        .eq("team_id", sub.team_id)
        .eq("email", email);
    }
  }

  const agencyName = team?.agency_name || team?.name || null;
  if (!branchId) return res.status(200).json({ logo: null, agencyName });

  const cacheKey = `${sub.team_id}:${branchId}`;
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.ts < TTL) {
    return res.status(200).json({ logo: cached.logo, agencyName });
  }

  // 3. Fetch branches from Tokko and find matching one
  try {
    const r = await fetch(
      `https://www.tokkobroker.com/api/v1/branch/?key=${team.tokko_api_key}&format=json&limit=50`
    );
    if (r.ok) {
      const d = await r.json();
      const branches: any[] = d.objects || [];
      const branch = branches.find((b: any) =>
        Number(b.id) === Number(branchId)
      );
      const logo = branch?.logo || branch?.logo_url || branch?.picture || null;
      cache[cacheKey] = { logo, ts: Date.now() };
      return res.status(200).json({ logo, agencyName });
    }
  } catch { /* silencioso */ }

  cache[cacheKey] = { logo: null, ts: Date.now() };
  return res.status(200).json({ logo: null, agencyName });
}
