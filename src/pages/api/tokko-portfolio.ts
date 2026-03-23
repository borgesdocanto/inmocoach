// Cartera del agente directo desde Tokko API, filtrada por producer_id en memoria
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { supabaseAdmin } from "../../lib/supabase";

export const config = { maxDuration: 60 };

// Cache en memoria — se comparte entre requests del mismo proceso
// Evita llamar a Tokko en cada carga del dashboard (se invalida cada 5 min)
const cache = new Map<string, { data: any[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const CACHE_VERSION = "v2"; // bump para invalidar cache al deployar

async function fetchAllProps(apiKey: string): Promise<any[]> {
  const cacheKey = CACHE_VERSION + apiKey.slice(-8);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  let allProps: any[] = [];
  let nextUrl: string | null = `https://www.tokkobroker.com/api/v1/property/?key=${apiKey}&format=json&lang=es_ar&limit=500`;
  while (nextUrl) {
    const r: Response = await fetch(nextUrl);
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

  const email = session.user.email;
  const targetEmail = (req.query.email as string) || email;

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, team_role")
    .eq("email", email)
    .single();

  if (!sub?.team_id) return res.status(200).json({ properties: [], connected: false });

  const isBroker = ["owner", "team_leader"].includes(sub.team_role || "");
  if (targetEmail !== email && !isBroker) return res.status(403).end();

  const { data: team } = await supabaseAdmin
    .from("teams")
    .select("tokko_api_key")
    .eq("id", sub.team_id)
    .single();

  if (!team?.tokko_api_key) {
    return res.status(200).json({ properties: [], connected: false, reason: "no_key" });
  }

  const { data: tokkoAgent } = await supabaseAdmin
    .from("tokko_agents")
    .select("tokko_id")
    .eq("team_id", sub.team_id)
    .ilike("email", targetEmail)
    .single();

  if (!tokkoAgent?.tokko_id) {
    return res.status(200).json({
      properties: [], connected: true,
      stats: { total: 0, active: 0, withPhotos: 0, stale: 0, avgDaysOnline: 0 },
    });
  }

  try {
    const allProps = await fetchAllProps(team.tokko_api_key);

    const agentProps = allProps.filter((p: any) => p.producer?.id === tokkoAgent.tokko_id);
    // Log temporal para ver campos de fecha disponibles
    if (agentProps[0]) {
      const p0 = agentProps[0];
      const dateFields: any = {};
      Object.keys(p0).forEach(k => { if (k.includes("date") || k.includes("update") || k.includes("modified") || k.includes("deleted")) dateFields[k] = p0[k]; });
      console.log("[tokko] date fields:", JSON.stringify(dateFields));
    }
    const now = new Date();

    const properties = agentProps.map((p: any) => {
      const op = p.operations?.[0];
      const price = op?.prices?.[0];
      const photos = (p.photos || []).filter((ph: any) => !ph.is_blueprint);
      const hasBlueprint = (p.photos || []).some((ph: any) => ph.is_blueprint === true);
      const videos = (p.videos || []);
      const hasVideo = videos.some((v: any) => {
        const url = (v.url || v.provider || "").toLowerCase();
        return url.includes("youtube") || url.includes("vimeo") || url.includes("video");
      });
      const hasTour360 = videos.some((v: any) => {
        const url = (v.url || v.provider || "").toLowerCase();
        return url.includes("360") || url.includes("tour") || url.includes("matterport") || url.includes("roundme");
      });

      return {
        id: p.id,
        referenceCode: p.reference_code || null,
        title: p.publication_title || p.address || "Sin título",
        address: p.address || null,
        type: p.type?.name || null,
        operationType: op?.operation_type || null,
        price: price?.price || null,
        currency: price?.currency || null,
        status: p.status ?? 2,
        photosCount: photos.length,
        hasVideo,
        hasTour360,
        hasBlueprint,
        thumbnail: photos[0]?.thumb || null,
        editUrl: `https://www.tokkobroker.com/property/${p.id}/`,
        daysOnline: p.created_at
          ? Math.floor((now.getTime() - new Date(p.created_at).getTime()) / 86400000)
          : null,
        daysSinceUpdate: p.created_at
          ? Math.floor((now.getTime() - new Date(p.created_at).getTime()) / 86400000)
          : null,
        branch: p.branch?.name || null,
      };
    });

    const active = properties.filter((p: any) => p.status === 2);

    // Ficha completa = 15+ fotos + plano + (video o tour360)
    // daysSinceUpdate is null when Tokko last_update=null — use daysOnline (>90d) as stale proxy
    const isStale = (p: any) => {
      const age = p.daysSinceUpdate ?? p.daysOnline;
      return age !== null && age > 90;
    };
    const completeListings = active.filter((p: any) => {
      const goodPhotos = p.photosCount >= 15;
      const hasMedia = p.hasVideo || p.hasTour360;
      return goodPhotos && p.hasBlueprint && hasMedia && !isStale(p);
    });
    const incompleteListings = active.filter((p: any) => {
      const goodPhotos = p.photosCount >= 15;
      const hasMedia = p.hasVideo || p.hasTour360;
      return !(goodPhotos && p.hasBlueprint && hasMedia && !isStale(p));
    });
    const stale = active.filter(isStale);

    return res.status(200).json({
      connected: true,
      properties,
      stats: {
        total: properties.length,
        active: active.length,
        complete: completeListings.length,
        incomplete: incompleteListings.length,
        stale: stale.length,
        avgDaysOnline: active.length
          ? Math.round(active.reduce((s: number, p: any) => s + (p.daysOnline || 0), 0) / active.length)
          : 0,
      },
    });
  } catch (e: any) {
    console.error("[tokko-portfolio]", e.message);
    return res.status(200).json({ properties: [], connected: false, reason: "error" });
  }
}
