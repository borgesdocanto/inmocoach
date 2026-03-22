// Lee la cartera del agente desde tokko_properties (sincronizado por cron)
// Mucho más rápido y sin límites de API
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { supabaseAdmin } from "../../lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).end();

  const email = session.user.email;

  // Buscar team_id y si el equipo tiene Tokko configurado
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

  if (!team?.tokko_api_key) return res.status(200).json({ properties: [], connected: false, reason: "no_key" });

  // Buscar producer_id del agente
  const { data: tokkoAgent } = await supabaseAdmin
    .from("tokko_agents")
    .select("tokko_id")
    .eq("team_id", sub.team_id)
    .ilike("email", email)
    .single();

  if (!tokkoAgent?.tokko_id) {
    // Agente no encontrado en Tokko — Tokko conectado pero sin propiedades asignadas
    return res.status(200).json({ properties: [], connected: true, stats: { total: 0, active: 0, reserved: 0, withPhotos: 0, stale: 0, avgDaysOnline: 0 } });
  }

  // Leer propiedades del agente desde DB
  const { data: props } = await supabaseAdmin
    .from("tokko_properties")
    .select("*")
    .eq("team_id", sub.team_id)
    .eq("producer_id", tokkoAgent.tokko_id)
    .order("synced_at", { ascending: false });

  const properties = (props || []).map((p: any) => ({
    id: p.tokko_id,
    referenceCode: p.reference_code,
    title: p.title || p.address || "Sin título",
    address: p.address,
    type: p.property_type,
    operationType: p.operation_type,
    price: p.price,
    currency: p.currency,
    status: p.status ?? 1,
    photosCount: p.photos_count ?? 0,
    daysOnline: p.days_online ?? null,
    daysSinceUpdate: p.days_since_update ?? null,
    thumbnail: p.thumbnail || null,
    branch: p.branch_name,
  }));

  const active = properties.filter((p: any) => p.status === 2);      // Disponible
  const reserved = properties.filter((p: any) => p.status === 3);    // Reservada
  const cotizar = properties.filter((p: any) => p.status === 1);     // A cotizar
  const withPhotos = active.filter((p: any) => p.photosCount >= 5);
  const stale = active.filter((p: any) => p.daysSinceUpdate !== null && p.daysSinceUpdate > 30);

  return res.status(200).json({
    connected: true,
    properties,
    stats: {
      total: properties.length,
      active: active.length,
      reserved: reserved.length,
      cotizar: cotizar.length,
      withPhotos: withPhotos.length,
      stale: stale.length,
      avgDaysOnline: active.length
        ? Math.round(active.reduce((s: number, p: any) => s + (p.daysOnline || 0), 0) / active.length)
        : 0,
    },
  });
}
