import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";

// Simple in-memory cache shared per API key
const cache = new Map<string, { data: any[]; ts: number }>();
const CACHE_TTL = 1000 * 60 * 5; // 5 min

async function fetchAllProps(apiKey: string): Promise<any[]> {
  const cacheKey = "team-" + apiKey.slice(-8);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  let allProps: any[] = [];
  let nextUrl: string | null = `https://www.tokkobroker.com/api/v1/property/?key=${apiKey}&format=json&lang=es_ar&limit=500`;
  while (nextUrl) {
    const r = await fetch(nextUrl);
    if (!r.ok) throw new Error(`Tokko error ${r.status}`);
    const d: any = await r.json();
    allProps = allProps.concat(d.objects || []);
    nextUrl = d.meta?.next ? `https://www.tokkobroker.com${d.meta.next}` : null;
  }
  cache.set(cacheKey, { data: allProps, ts: Date.now() });
  return allProps;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).end();

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, team_role")
    .eq("email", session.user.email)
    .single();

  if (!sub?.team_id || !["owner", "team_leader"].includes(sub.team_role)) {
    return res.status(403).json({ error: "Sin acceso" });
  }

  const { data: team } = await supabaseAdmin
    .from("teams")
    .select("tokko_api_key")
    .eq("id", sub.team_id)
    .single();

  if (!team?.tokko_api_key) {
    return res.status(200).json({ connected: false, active: [], uninvited: [] });
  }

  // Active team members
  const { data: members } = await supabaseAdmin
    .from("subscriptions")
    .select("email, name, avatar")
    .eq("team_id", sub.team_id);
  const memberEmails = new Set((members || []).map((m: any) => m.email.toLowerCase()));
  const memberByEmail: Record<string, any> = {};
  for (const m of members || []) memberByEmail[m.email.toLowerCase()] = m;

  // Pending invitations
  const { data: pending } = await supabaseAdmin
    .from("team_invitations")
    .select("email")
    .eq("team_id", sub.team_id)
    .eq("status", "pending");
  const pendingEmails = new Set((pending || []).map((p: any) => p.email.toLowerCase()));

  // Fetch live from Tokko (cached 5 min)
  let allProps: any[];
  try {
    allProps = await fetchAllProps(team.tokko_api_key);
  } catch {
    return res.status(200).json({ connected: true, active: [], uninvited: [], error: "tokko_fetch_failed" });
  }

  const now = Date.now();
  const available = allProps.filter((p: any) => p.status === 2 || p.status === "2");

  // Group by producer
  const byAgent: Record<string, {
    email: string; name: string; avatar?: string | null;
    total: number; complete: number; incomplete: number; stale: number;
    isMember: boolean;
  }> = {};

  for (const p of available) {
    const email = (p.producer?.email || "").toLowerCase();
    if (!email) continue;
    const name = p.producer?.name || email;
    if (!byAgent[email]) {
      const member = memberByEmail[email];
      byAgent[email] = {
        email,
        name: member?.name || name,
        avatar: member?.avatar || null,
        total: 0, complete: 0, incomplete: 0, stale: 0,
        isMember: memberEmails.has(email),
      };
    }
    byAgent[email].total++;

    const photos = (p.photos || []).filter((ph: any) => !ph.is_blueprint);
    const hasPhotos = photos.length >= 15;
    const hasBlueprint = (p.photos || []).some((ph: any) => ph.is_blueprint);
    const hasVideo = !!(p.videos?.length);
    const hasTour360 = !!(p.tags?.find((t: any) => t.name?.toLowerCase().includes("360") || t.name?.toLowerCase().includes("tour")));

    // Tokko only exposes created_at — use it as age proxy (>90 days = stale)
    const dateStr = p.created_at || null;
    let ageDays: number | null = null;
    if (dateStr) {
      try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          ageDays = Math.floor((now - d.getTime()) / 86400000);
        }
      } catch { /* ignore */ }
    }
    const stale = ageDays !== null && ageDays > 90;

    const complete = hasPhotos && hasBlueprint && (hasVideo || hasTour360) && !stale;
    if (complete) byAgent[email].complete++;
    else byAgent[email].incomplete++;
    if (stale) byAgent[email].stale++;
  }

  const all = Object.values(byAgent).sort((a, b) => b.total - a.total);
  const active = all.filter(a => a.isMember);
  const uninvited = all.filter(a => !a.isMember && !pendingEmails.has(a.email));

  return res.status(200).json({ connected: true, active, uninvited });
}
