// GET /api/systeme/tokko-tags
// Trae las tags únicas disponibles en Tokko para este team
// Las tags vienen embebidas en los contactos, no hay endpoint propio de tags
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getEffectiveEmail } from "../../../lib/impersonation";

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
    // Tokko tiene endpoint específico de tags: /api/v1/contact_tag/
    // Soporta paginación igual que otros endpoints
    const tagSet = new Set<string>();
    let url: string | null = `https://tokkobroker.com/api/v1/contact_tag/?key=${team.tokko_api_key}&format=json`;

    while (url) {
      const r: Response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) {
        return res.status(502).json({ error: `Tokko respondió con error ${r.status}` });
      }
      const data = await r.json();
      const objects: { name: string }[] = data?.objects ?? [];
      for (const tag of objects) {
        if (tag.name && tag.name.trim()) tagSet.add(tag.name.trim());
      }
      const next: string | undefined = data?.meta?.next;
      url = next ? `https://tokkobroker.com${next}` : null;
    }

    const tags = Array.from(tagSet).sort((a, b) => a.localeCompare(b, "es"));
    return res.json({ tags });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return res.status(502).json({ error: `No se pudo conectar con Tokko: ${message}` });
  }
}
