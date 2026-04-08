import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getOrCreateSubscription, isFreemiumExpired } from "../../../lib/subscription";
import { fetchAllTokkoProps } from "../../../lib/tokkoPortfolio";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).end();

  const sub = await getOrCreateSubscription(session.user.email);
  if (isFreemiumExpired(sub)) return res.status(403).end();

  const { id } = req.query;
  if (!id || typeof id !== "string") return res.status(400).json({ error: "id requerido" });

  const { data: subData } = await supabaseAdmin
    .from("subscriptions").select("team_id").eq("email", session.user.email).single();
  if (!subData?.team_id) return res.status(404).json({ error: "Sin equipo" });

  const { data: team } = await supabaseAdmin
    .from("teams").select("tokko_api_key").eq("id", subData.team_id).single();
  if (!team?.tokko_api_key) return res.status(404).json({ error: "Tokko no conectado" });

  try {
    // Try direct endpoint first (more detail)
    const r = await fetch(
      `https://www.tokkobroker.com/api/v1/property/${id}/?key=${team.tokko_api_key}&format=json&lang=es_ar`
    );

    let prop: any;
    if (r.ok) {
      prop = await r.json();
    } else {
      // Fallback: search in cached list
      const all = await fetchAllTokkoProps(team.tokko_api_key);
      prop = all.find((p: any) => String(p.id) === String(id));
      if (!prop) return res.status(404).json({ error: "Propiedad no encontrada" });
    }

    const op = prop.operations?.[0];
    const price = op?.prices?.[0];
    const now = Date.now();

    // All photos: regular + blueprint
    const regularPhotos = (prop.photos || [])
      .filter((ph: any) => !ph.is_blueprint)
      .map((ph: any) => ({ url: ph.image || ph.thumb, thumb: ph.thumb, isBlueprint: false }));

    const blueprintPhotos = (prop.photos || [])
      .filter((ph: any) => ph.is_blueprint)
      .map((ph: any) => ({ url: ph.image || ph.thumb, thumb: ph.thumb, isBlueprint: true }));

    const allPhotos = [...regularPhotos, ...blueprintPhotos];

    // Videos & tours
    const videos = (prop.videos || []).map((v: any) => ({
      url: v.url || v.provider || "",
      title: v.title || "",
    }));

    // Tokko API does NOT expose property owners — only the assigned producer (agent)
    // Owner data is only visible in Tokko's web interface
    const producer = prop.producer ? {
      name: prop.producer.name || null,
      email: prop.producer.email || null,
      phone: prop.producer.phone || prop.producer.cellphone || null,
      picture: prop.producer.picture || null,
    } : null;

    return res.status(200).json({
      id: prop.id,
      referenceCode: prop.reference_code || null,
      title: prop.publication_title || prop.address || "Sin título",
      address: prop.fake_address || prop.address || null,
      realAddress: prop.real_address || prop.address || null,
      type: prop.type?.name || null,
      operationType: op?.operation_type || null,
      price: price?.price || null,
      currency: price?.currency || null,
      priceLabel: price ? `${price.currency === "USD" ? "USD " : "$"}${Number(price.price).toLocaleString("es-AR")}` : null,
      status: prop.status,
      // Surfaces
      totalSurface: prop.total_surface || null,
      coveredSurface: prop.roofed_surface || null,
      uncoveredSurface: prop.unroofed_surface || null,
      semiCoveredSurface: prop.semiroofed_surface || null,
      // Rooms
      rooms: prop.room_amount || null,
      bathrooms: prop.bathroom_amount || null,
      bedrooms: prop.suite_amount || null,
      toilets: prop.toilet_amount || null,
      parkingLots: prop.parking_lot_amount || null,
      floor: prop.floor || null,
      age: prop.age || null,
      // Description
      description: prop.description || prop.rich_description || null,
      // Location
      geo: prop.geo_lat && prop.geo_long ? { lat: prop.geo_lat, lng: prop.geo_long } : null,
      location: prop.location?.name || null,
      branch: prop.branch?.name || null,
      // Media
      photos: allPhotos,
      videos,
      hasBlueprint: blueprintPhotos.length > 0,
      hasVideo: videos.some((v: any) => v.url.includes("youtube") || v.url.includes("vimeo")),
      hasTour: videos.some((v: any) => v.url.includes("360") || v.url.includes("tour") || v.url.includes("matterport")),
      // Producer (agent)
      producer: prop.producer ? {
        name: prop.producer.name,
        email: prop.producer.email,
        phone: prop.producer.phone || prop.producer.cellphone,
      } : null,
      // Producer (assigned agent) — owners not available via Tokko API
      producer,
      owner: null, // Not available via Tokko API — see Tokko web for owner data
      owners: [],
      // Dates
      daysOnline: (prop.deleted_at || prop.created_at)
        ? Math.floor((now - new Date(prop.deleted_at || prop.created_at).getTime()) / 86400000)
        : null,
      editUrl: `https://www.tokkobroker.com/property/${prop.id}/`,
      publicUrl: prop.public_url || null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
