// Cartera del agente directo desde Tokko API, filtrada por producer_id en memoria
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { supabaseAdmin } from "../../lib/supabase";

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
      stats: { total: 0, active: 0, reserved: 0, withPhotos: 0, stale: 0, avgDaysOnline: 0 },
    });
  }

  try {
    let allProps: any[] = [];
    let nextUrl: string | null =
      `https://www.tokkobroker.com/api/v1/property/?key=${team.tokko_api_key}&format=json&lang=es_ar&limit=500`;

    while (nextUrl) {
      const r: Response = await fetch(nextUrl);
      if (!r.ok) throw new Error(`Tokko error ${r.status}`);
      const d: any = await r.json();
      allProps = allProps.concat(d.objects || []);
      nextUrl = d.meta?.next ? `https://www.tokkobroker.com${d.meta.next}` : null;
    }

    const agentProps = allProps.filter((p: any) => p.producer?.id === tokkoAgent.tokko_id);
    const now = new Date();

    const properties = agentProps.map((p: any) => {
      const op = p.operations?.[0];
      const price = op?.prices?.[0];
      const photos = (p.photos || []).filter((ph: any) => !ph.is_blueprint);
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
        thumbnail: photos[0]?.thumb || null,
        editUrl: `https://www.tokkobroker.com/property/${p.id}/`,
        daysOnline: p.created_date
          ? Math.floor((now.getTime() - new Date(p.created_date).getTime()) / 86400000)
          : null,
        daysSinceUpdate: p.last_update
          ? Math.floor((now.getTime() - new Date(p.last_update).getTime()) / 86400000)
          : null,
        branch: p.branch?.name || null,
      };
    });

    const active = properties.filter((p: any) => p.status === 2);
    const reserved = properties.filter((p: any) => p.status === 3);

    // Ficha completa = 15+ fotos + (video o tour360) + actualizada hace menos de 30 días
    const completeListings = active.filter((p: any) => {
      const goodPhotos = p.photosCount >= 15;
      const hasMedia = p.hasVideo || p.hasTour360;
      const fresh = p.daysSinceUpdate === null || p.daysSinceUpdate <= 30;
      return goodPhotos && hasMedia && fresh;
    });
    const incompleteListings = active.filter((p: any) => {
      const goodPhotos = p.photosCount >= 15;
      const hasMedia = p.hasVideo || p.hasTour360;
      const fresh = p.daysSinceUpdate === null || p.daysSinceUpdate <= 30;
      return !(goodPhotos && hasMedia && fresh);
    });
    const stale = active.filter((p: any) => (p.daysSinceUpdate || 0) > 30);

    return res.status(200).json({
      connected: true,
      properties,
      stats: {
        total: properties.length,
        active: active.length,
        reserved: reserved.length,
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
