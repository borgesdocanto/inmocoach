import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { getTeamByOwner, updateTeamSettings } from "../../../lib/teams";
import { getEffectiveEmail } from "../../../lib/impersonation";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  if (req.method === "GET") {
    // Lectura: soporta impersonación para ver como el usuario impersonado
    const effectiveEmail = getEffectiveEmail(req, session) ?? session.user.email;
    const team = await getTeamByOwner(effectiveEmail);
    if (!team) return res.status(404).json({ error: "Equipo no encontrado" });
    return res.status(200).json({
      showTeamLeaders: team.showTeamLeaders ?? true,
      showBroker: team.showBroker ?? true,
      anonymizeGlobal: team.anonymizeGlobal ?? false,
    });
  }

  if (req.method === "POST") {
    // Escritura: siempre email real de sesión (no se escribe en nombre de otro)
    const { showTeamLeaders, showBroker, anonymizeGlobal } = req.body;
    const result = await updateTeamSettings(session.user.email, { showTeamLeaders, showBroker, anonymizeGlobal });
    return res.status(result.ok ? 200 : 403).json(result);
  }

  return res.status(405).end();
}
