// GET /api/systeme/tokko-tags
// Trae las tags únicas disponibles en Tokko para este team
// Las tags vienen embebidas en los contactos, no hay endpoint propio de tags
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getEffectiveEmail } from "../../../lib/impersonation";

interface TokkoContact {
  tags?: { name: string }[];
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
    // Tokko no tiene endpoint de tags — las tags vienen en los contactos.
    // Traemos la primera página de contactos y extraemos las tags únicas.
    // limit=100 es suficiente para cubrir la variedad de tags de una inmo.
    const url = `https://tokkobroker.com/api/v1/contact/?key=${team.tokko_api_key}&format=json&limit=100`;
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });

    if (!r.ok) {
      return res.status(502).json({ error: `Tokko respondió con error ${r.status}` });
    }

    const data = await r.json();
    const contacts: TokkoContact[] = data?.objects ?? [];

    // Extraer tags únicas de todos los contactos
    const tagSet = new Set<string>();
    for (const contact of contacts) {
      for (const tag of (contact.tags ?? [])) {
        if (tag.name && tag.name.trim()) {
          tagSet.add(tag.name.trim());
        }
      }
    }

    const tags = Array.from(tagSet).sort((a, b) => a.localeCompare(b, "es"));
    return res.json({ tags, contactsSampled: contacts.length });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return res.status(502).json({ error: `No se pudo conectar con Tokko: ${message}` });
  }
}
