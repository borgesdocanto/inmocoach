import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase";
import { getEffectiveEmail } from "../../../lib/impersonation";

export const DEFAULT_MSG_AGENT = `¡Feliz cumpleaños, {nombre}! 🎂

Desde {inmobiliaria} te deseamos un día lleno de alegría y todo lo mejor en este nuevo año de vida.

¡Gracias por ser parte de nuestro equipo!`;

export const DEFAULT_MSG_TEAM = `¡Hoy es el cumpleaños de {nombre}! 🎂

Desde {inmobiliaria} te invitamos a saludar a tu compañero/a en este día especial.

¡Que lo pase muy bien!`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const effectiveEmail = getEffectiveEmail(req, session);

  const { data: requester } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, team_role")
    .eq("email", effectiveEmail)
    .single();

  if (!requester?.team_id) return res.status(403).json({ error: "Sin equipo" });
  const canManage = requester.team_role === "owner" || requester.team_role === "team_leader";

  // GET — leer templates actuales
  if (req.method === "GET") {
    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("birthday_msg_agent, birthday_msg_team, agency_name")
      .eq("id", requester.team_id)
      .single();

    return res.json({
      birthdayMsgAgent: team?.birthday_msg_agent || DEFAULT_MSG_AGENT,
      birthdayMsgTeam: team?.birthday_msg_team || DEFAULT_MSG_TEAM,
      agencyName: team?.agency_name || "",
      isDefault: {
        agent: !team?.birthday_msg_agent,
        team: !team?.birthday_msg_team,
      },
    });
  }

  // PUT — guardar templates
  if (req.method === "PUT") {
    if (!canManage) return res.status(403).json({ error: "Sin permisos" });

    const { birthdayMsgAgent, birthdayMsgTeam } = req.body;

    const { error } = await supabaseAdmin
      .from("teams")
      .update({
        birthday_msg_agent: birthdayMsgAgent || null,
        birthday_msg_team: birthdayMsgTeam || null,
      })
      .eq("id", requester.team_id);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Método no permitido" });
}
