import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getStoredEvents } from "../../../lib/calendarSync";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const { agentEmail } = req.query;
  if (!agentEmail || typeof agentEmail !== "string")
    return res.status(400).json({ error: "agentEmail requerido" });

  // Solo owner/team_leader del mismo equipo
  const { data: requester } = await supabaseAdmin
    .from("subscriptions").select("team_id, team_role").eq("email", session.user.email).single();

  if (!requester?.team_id || !["owner", "team_leader"].includes(requester.team_role))
    return res.status(403).json({ error: "Sin acceso" });

  const { data: agent } = await supabaseAdmin
    .from("subscriptions").select("email, team_id").eq("email", agentEmail).eq("team_id", requester.team_id).single();

  if (!agent) return res.status(404).json({ error: "Agente no encontrado" });

  // Semana actual: lunes a domingo
  const now = new Date();
  const day = now.getDay(); // 0=dom
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const events = await getStoredEvents(agentEmail, monday, sunday);

  return res.status(200).json({
    weekStart: monday.toISOString(),
    events: events.map(e => ({
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      type: e.type,
      isGreen: e.isGreen,
      durationMinutes: e.durationMinutes,
    })),
  });
}
