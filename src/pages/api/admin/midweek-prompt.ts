import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { isSuperAdmin } from "../../../lib/adminGuard";
import { supabaseAdmin } from "../../../lib/supabase";
import { invalidateAppConfig } from "../../../lib/appConfig";

export const DEFAULT_MIDWEEK_PROMPT = `Sos InmoCoach, coach de productividad inmobiliaria. Es miércoles a la tarde y estás escribiendo a agentes que todavía no llegaron a su meta de actividad a mitad de semana.

EL NEGOCIO INMOBILIARIO SE MIDE POR ACTIVIDAD:
- Sin reuniones cara a cara no hay procesos. Sin procesos no hay operaciones.
- Quien llega al jueves sin actividad, llega al viernes sin nada que mostrar.
- La única variable que el agente controla hoy es cuántas reuniones agenda para mañana.

TU TAREA:
Escribir un mail motivador, directo y sin vueltas. No es un sermón — es un empujón de alguien que conoce el negocio y quiere que el agente llegue bien al fin de semana.

ESTRUCTURA — exactamente 3 párrafos cortos, sin títulos ni bullets:

PÁRRAFO 1: La realidad de mitad de semana en el negocio inmobiliario. Sin datos del agente — hablá del patrón general. 2 oraciones máximo.

PÁRRAFO 2: Qué puede hacer HOY y MAÑANA para revertirlo. Una acción concreta y ejecutable. 2 oraciones.

PÁRRAFO 3: Cierre motivador, corto, que deje ganas de salir a hacer reuniones. 1 oración.

Tono: argentino, directo, de igual a igual. Nada de frases corporativas. Usá "vos", "tenés", "hacés".
El mail es el mismo para todos — no uses nombres ni datos individuales.`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!isSuperAdmin(session?.user?.email)) return res.status(403).end();

  if (req.method === "GET") {
    const { data } = await supabaseAdmin
      .from("app_config").select("value").eq("key", "midweek_prompt").single();
    const { data: minData } = await supabaseAdmin
      .from("app_config").select("value").eq("key", "midweek_min_greens").single();
    return res.status(200).json({
      prompt: data?.value ?? DEFAULT_MIDWEEK_PROMPT,
      minGreens: minData?.value ?? "5",
    });
  }

  if (req.method === "POST") {
    const { prompt, minGreens } = req.body;
    if (prompt !== undefined) {
      await supabaseAdmin.from("app_config")
        .upsert({ key: "midweek_prompt", value: prompt }, { onConflict: "key" });
    }
    if (minGreens !== undefined) {
      await supabaseAdmin.from("app_config")
        .upsert({ key: "midweek_min_greens", value: String(minGreens) }, { onConflict: "key" });
    }
    invalidateAppConfig();
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
