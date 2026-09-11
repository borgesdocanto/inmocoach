import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { isSuperAdmin } from "../../../lib/adminGuard";
import { buildHtml } from "../cron/midweek-alert";

// Preview del mail de miercoles. Reutiliza el buildHtml real del cron
// para que el preview nunca quede desfasado del mail que se envia.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email || !isSuperAdmin(session.user.email)) return res.status(403).end();

  const caso = (req.query.caso as string) || "problems";
  const firstName = "Leandro";
  const advice = [
    "Vas tres reuniones abajo de donde deberias estar a esta altura de la semana. No es falta de ganas: es que los dias se llenan de tareas que no te ponen frente a nadie.",
    "Hoy agarra el telefono y llama a cinco personas que no hablas hace mas de tres meses. Manana grabá un video corto contando una operacion de la zona y subilo.",
    "Cada conversacion que abris hoy es una opcion que vas a poder elegir el mes que viene.",
  ].join("\n\n");

  const common = { firstName, weeklyGoal: 12, advice };

  const html = caso === "congrats"
    ? buildHtml({
        ...common,
        greenCount: 4,
        minGreens: 6,
        tokkoTotal: 18,
        tokkoNeedAction: 0,
        tokkoTop3: [],
      })
    : buildHtml({
        ...common,
        greenCount: 3,
        minGreens: 6,
        tokkoTotal: 18,
        tokkoNeedAction: 7,
        tokkoTop3: [
          {
            title: "PH 3 ambientes en venta",
            address: "Av. Rivadavia 4521, Castelar",
            issues: ["4/15 fotos", "sin plano", "sin video/tour"],
            editUrl: "https://www.tokkobroker.com/property/123456/",
          },
          {
            title: "Casa 4 ambientes con jardin",
            address: "Belgrano 890, Ituzaingo",
            issues: ["+127 dias sin editar", "sin video/tour"],
            editUrl: "https://www.tokkobroker.com/property/234567/",
          },
          {
            title: "Departamento 2 ambientes",
            address: "Mitre 340, Moron",
            issues: ["8/15 fotos", "sin plano"],
            editUrl: "https://www.tokkobroker.com/property/345678/",
          },
        ],
      });

  res.setHeader("Content-Type", "text/html");
  return res.status(200).send(html);
}
