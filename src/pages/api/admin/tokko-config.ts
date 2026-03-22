// Gestiona la API key de Tokko por equipo
// Cualquier broker (owner) puede configurar la suya
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { isSuperAdmin } from "../../../lib/adminGuard";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).end();

  const email = session.user.email;

  // Obtener team_id del usuario
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, team_role")
    .eq("email", email)
    .single();

  const isOwner = sub?.team_role === "owner" || isSuperAdmin(email);
  if (!isOwner) return res.status(403).json({ error: "Solo el broker puede configurar Tokko" });

  if (!sub?.team_id) return res.status(400).json({ error: "No tenés un equipo configurado" });

  if (req.method === "GET") {
    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("tokko_api_key")
      .eq("id", sub.team_id)
      .single();

    // Nunca devolver la key completa — solo si existe
    const hasKey = !!team?.tokko_api_key;
    const maskedKey = hasKey
      ? team.tokko_api_key.slice(0, 6) + "..." + team.tokko_api_key.slice(-4)
      : null;

    return res.status(200).json({ hasKey, maskedKey, teamId: sub.team_id });
  }

  if (req.method === "POST") {
    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== "string" || apiKey.length < 10) {
      return res.status(400).json({ error: "API key inválida" });
    }

    await supabaseAdmin
      .from("teams")
      .update({ tokko_api_key: apiKey })
      .eq("id", sub.team_id);

    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    await supabaseAdmin
      .from("teams")
      .update({ tokko_api_key: null })
      .eq("id", sub.team_id);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
