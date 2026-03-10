import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getAgentSummary } from "../../../lib/analytics";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const { agentEmail } = req.query;
  if (!agentEmail || typeof agentEmail !== "string")
    return res.status(400).json({ error: "agentEmail requerido" });

  // Verificar que el requester es owner o team_leader del mismo equipo
  const { data: requester } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, team_role")
    .eq("email", session.user.email)
    .single();

  if (!requester?.team_id || !["owner", "team_leader"].includes(requester.team_role))
    return res.status(403).json({ error: "Sin acceso" });

  const { data: agent } = await supabaseAdmin
    .from("subscriptions")
    .select("email, name, avatar, team_id")
    .eq("email", agentEmail)
    .eq("team_id", requester.team_id)
    .single();

  if (!agent) return res.status(404).json({ error: "Agente no encontrado en tu equipo" });

  const summary = await getAgentSummary(agentEmail);

  return res.status(200).json({
    ...summary,
    name: agent.name || agentEmail.split("@")[0],
    avatar: agent.avatar,
  });
}
