import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getStoredEvents } from "../../../lib/calendarSync";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const { agentEmail, year, month } = req.query;
  if (!agentEmail || typeof agentEmail !== "string")
    return res.status(400).json({ error: "agentEmail requerido" });

  const { data: requester } = await supabaseAdmin
    .from("subscriptions").select("team_id, team_role").eq("email", session.user.email).single();

  if (!requester?.team_id || !["owner", "team_leader"].includes(requester.team_role))
    return res.status(403).json({ error: "Sin acceso" });

  const { data: agent } = await supabaseAdmin
    .from("subscriptions").select("email, team_id").eq("email", agentEmail).eq("team_id", requester.team_id).single();

  if (!agent) return res.status(404).json({ error: "Agente no encontrado" });

  const y = year ? parseInt(year as string) : new Date().getFullYear();
  const m = month ? parseInt(month as string) : new Date().getMonth(); // 0-indexed

  // From first day of prev month to last day of next month (for calendar padding)
  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m + 2, 0, 23, 59, 59);

  const events = await getStoredEvents(agentEmail, from, to);

  return res.status(200).json({
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
