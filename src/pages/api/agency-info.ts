import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { supabaseAdmin } from "../../lib/supabase";

// Simple in-memory cache: teamId+branchId → { logo, name, ts }
const cache: Record<string, { logo: string | null; name: string | null; ts: number }> = {};
const TTL = 1000 * 60 * 60; // 1 hora

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).end();

  const email = session.user.email;

  // 1. Get team_id for this user
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id")
    .eq("email", email)
    .single();

  if (!sub?.team_id) return res.status(200).json({ logo: null, agencyName: null });

  // 2. Get team API key and agency name
  const { data: team } = await supabaseAdmin
    .from("teams")
    .select("agency_name, tokko_api_key")
    .eq("id", sub.team_id)
    .single();

  const agencyName = team?.agency_name ?? null;

  if (!team?.tokko_api_key) {
    return res.status(200).json({ logo: null, agencyName });
  }

  // 3. Find this agent's branch_id from tokko_agents
  const { data: tokkoAgent } = await supabaseAdmin
    .from("tokko_agents")
    .select("branch_id, branch_name")
    .eq("team_id", sub.team_id)
    .ilike("email", email)
    .maybeSingle();

  const branchId = tokkoAgent?.branch_id ?? null;
  const cacheKey = `${sub.team_id}:${branchId ?? "default"}`;

  // Check cache
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.ts < TTL) {
    return res.status(200).json({ logo: cached.logo, agencyName: cached.name ?? agencyName });
  }

  // 4. Fetch branches from Tokko
  try {
    const url = branchId
      ? `https://www.tokkobroker.com/api/v1/branch/${branchId}/?key=${team.tokko_api_key}&format=json`
      : `https://www.tokkobroker.com/api/v1/branch/?key=${team.tokko_api_key}&format=json&limit=1`;

    const r = await fetch(url);
    if (r.ok) {
      const d = await r.json();
      // Single branch endpoint returns object directly; list returns { objects: [...] }
      const branch = branchId ? d : d.objects?.[0];
      const logo = branch?.logo || branch?.logo_url || null;
      const name = agencyName || branch?.name || null;

      cache[cacheKey] = { logo, name, ts: Date.now() };
      return res.status(200).json({ logo, agencyName: name });
    }
  } catch { /* silencioso */ }

  cache[cacheKey] = { logo: null, name: agencyName, ts: Date.now() };
  return res.status(200).json({ logo: null, agencyName });
}
