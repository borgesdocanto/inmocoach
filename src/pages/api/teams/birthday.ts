import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase";
import { getEffectiveEmail } from "../../../lib/impersonation";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const effectiveEmail = getEffectiveEmail(req, session);

  // Verificar que el requester sea owner o team_leader
  const { data: requester } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, team_role")
    .eq("email", effectiveEmail)
    .single();

  if (!requester?.team_id) return res.status(403).json({ error: "Sin equipo" });
  const canManage = requester.team_role === "owner" || requester.team_role === "team_leader";

  // GET — obtener cumpleaños de todos los miembros del equipo
  if (req.method === "GET") {
    const { data: members } = await supabaseAdmin
      .from("subscriptions")
      .select("email, name, birthday, team_role")
      .eq("team_id", requester.team_id)
      .order("name");

    return res.json({ members: members || [] });
  }

  // PUT — actualizar cumpleaños de un agente
  if (req.method === "PUT") {
    if (!canManage) return res.status(403).json({ error: "Sin permisos" });

    const { agentEmail, birthday } = req.body;
    if (!agentEmail) return res.status(400).json({ error: "Falta agentEmail" });

    // Verificar que el agente pertenece al mismo equipo
    const { data: agent } = await supabaseAdmin
      .from("subscriptions")
      .select("email, team_id")
      .eq("email", agentEmail)
      .eq("team_id", requester.team_id)
      .single();

    if (!agent) return res.status(404).json({ error: "Agente no encontrado en el equipo" });

    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({ birthday: birthday || null })
      .eq("email", agentEmail);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Método no permitido" });
}
