// GET /api/systeme/tokko-tags
// Trae las tags disponibles en Tokko para este team (en vivo)
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase";
import { getEffectiveEmail } from "../../../lib/impersonation";

interface TokkoTag {
  id: number;
  name: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });
  const email = getEffectiveEmail(req, session);

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, team_role")
    .eq("email", email)
    .single();

  if (!sub?.team_id) return res.status(403).json({ error: "Sin equipo" });
  if (sub.team_role !== "owner" && sub.team_role !== "team_leader") {
    return res.status(403).json({ error: "Sin permiso" });
  }

  const { data: team } = await supabaseAdmin
    .from("teams")
    .select("tokko_api_key")
    .eq("id", sub.team_id)
    .single();

  if (!team?.tokko_api_key) return res.status(400).json({ error: "No hay API key de Tokko configurada" });

  try {
    // Tokko: traer tags de contactos (endpoint /contact/tag/)
    const r = await fetch(
      `https://tokkobroker.com/api/v1/contact/tag/?key=${team.tokko_api_key}&format=json`,
      { signal: AbortSignal.timeout(15000) }
    );

    if (!r.ok) {
      return res.status(502).json({ error: `Tokko respondió con error ${r.status}` });
    }

    const data = await r.json();
    // Tokko devuelve { objects: [{id, name}] } o directo un array según el endpoint
    const raw: TokkoTag[] = data?.objects ?? (Array.isArray(data) ? data : []);
    const tags = raw
      .filter((t: TokkoTag) => t.name && t.name.trim())
      .map((t: TokkoTag) => t.name.trim())
      .sort((a: string, b: string) => a.localeCompare(b, "es"));

    return res.json({ tags });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return res.status(502).json({ error: `No se pudo conectar con Tokko: ${message}` });
  }
}
