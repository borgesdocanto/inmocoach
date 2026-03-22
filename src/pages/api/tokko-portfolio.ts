// Consulta la cartera activa del agente directamente contra Tokko API en tiempo real
// Usa el producer_id del agente para filtrar sus propiedades
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { supabaseAdmin } from "../../lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).end();

  const email = session.user.email;

  // Buscar API key del equipo
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id")
    .eq("email", email)
    .single();

  if (!sub?.team_id) return res.status(200).json({ properties: [], connected: false });

  const { data: team } = await supabaseAdmin
    .from("teams")
    .select("tokko_api_key")
    .eq("id", sub.team_id)
    .single();

  const apiKey = team?.tokko_api_key;
  if (!apiKey) return res.status(200).json({ properties: [], connected: false, reason: "no_key" });

  // Buscar el producer_id del agente en tokko_agents (sincronizado por el cron)
  const { data: tokkoAgent } = await supabaseAdmin
    .from("tokko_agents")
    .select("tokko_id")
    .eq("team_id", sub.team_id)
    .ilike("email", email)
    .single();

  try {
    let url: string;

    if (tokkoAgent?.tokko_id) {
      // Filtrar por producer_id del agente — solo sus propiedades
      url = `https://www.tokkobroker.com/api/v1/property/?key=${apiKey}&format=json&lang=es_ar&limit=100&producer_id=${tokkoAgent.tokko_id}`;
    } else {
      // No encontramos el agente en Tokko — traer todas y filtrar por email
      url = `https://www.tokkobroker.com/api/v1/property/?key=${apiKey}&format=json&lang=es_ar&limit=200&order_by=-last_update`;
    }

    const r = await fetch(url);
    if (!r.ok) return res.status(200).json({ properties: [], connected: false, reason: "tokko_error" });

    const data = await r.json();
    let props = data.objects || [];

    // Si no teníamos producer_id, filtrar por email del agente
    if (!tokkoAgent?.tokko_id) {
      props = props.filter((p: any) =>
        p.producer?.email?.toLowerCase() === email.toLowerCase()
      );
    }

    // Mapear a formato limpio para el dashboard
    const properties = props.map((p: any) => {
      const op = p.operations?.[0];
      const price = op?.prices?.[0];
      const photos = (p.photos || []).filter((ph: any) => !ph.is_blueprint);
      const now = new Date();
      const daysOnline = p.created_date
        ? Math.floor((now.getTime() - new Date(p.created_date).getTime()) / 86400000)
        : null;
      const daysSinceUpdate = p.last_update
        ? Math.floor((now.getTime() - new Date(p.last_update).getTime()) / 86400000)
        : null;

      return {
        id: p.id,
        referenceCode: p.reference_code || null,
        title: p.publication_title || p.address || "Sin título",
        address: p.address || null,
        type: p.type?.name || null,
        operationType: op?.operation_type || null,
        price: price?.price || null,
        currency: price?.currency || null,
        status: p.status, // 1=publicada, 2=reservada, 3=vendida, 0=no publicada
        photosCount: photos.length,
        daysOnline,
        daysSinceUpdate,
        thumbnail: photos[0]?.thumb || null,
        branch: p.branch?.name || null,
      };
    });

    // Stats de cartera
    const active = properties.filter((p: any) => p.status === 1);
    const reserved = properties.filter((p: any) => p.status === 2);
    const withPhotos = active.filter((p: any) => p.photosCount >= 5);
    const stale = active.filter((p: any) => p.daysSinceUpdate !== null && p.daysSinceUpdate > 30);

    return res.status(200).json({
      connected: true,
      properties,
      stats: {
        total: properties.length,
        active: active.length,
        reserved: reserved.length,
        withPhotos: withPhotos.length,
        stale: stale.length,
        avgDaysOnline: active.length
          ? Math.round(active.reduce((s: number, p: any) => s + (p.daysOnline || 0), 0) / active.length)
          : 0,
      },
    });
  } catch (e: any) {
    console.error("[tokko-portfolio] error:", e.message);
    return res.status(200).json({ properties: [], connected: false, reason: "error" });
  }
}
