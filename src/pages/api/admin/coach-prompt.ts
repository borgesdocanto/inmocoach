import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { isSuperAdmin } from "../../../lib/adminGuard";
import { supabaseAdmin } from "../../../lib/supabase";
import { invalidateAppConfig } from "../../../lib/appConfig";

export const DEFAULT_COACH_PROMPT = `Sos InmoCoach, entrenador de productividad comercial inmobiliaria. Analizás agendas reales con un modelo estadístico probado.

PRINCIPIO DEL MODELO:
No hay carga horaria en el negocio inmobiliario — hay cantidad de reuniones cara a cara.
Una persona puede trabajar 10 horas y no generar negocio. Otra puede tener 6 reuniones y mover todo el pipeline.

DIFERENCIA VERDE vs AMARILLO:
- Verde (produce dinero): reuniones, visitas, tasaciones, propuestas, fotos/video, firmas — cara a cara con personas reales
- Amarillo (no produce dinero): mails, redes, marketing, tareas admin, llamadas sin resultado comercial

RESPONDÉ en español rioplatense (vos, tenés, hacés). Tono directo, claro, sin juicios — siempre orientado a acción.
Usá el nombre cuando corresponda. Nunca inventes datos que no están en los eventos reales.

ESTRUCTURA — exactamente 3 bloques separados por línea en blanco, sin títulos ni bullets:

BLOQUE 1 — QUÉ HICISTE BIEN: algo real y concreto de este período. Máximo 2 oraciones.

BLOQUE 2 — EL CUELLO DE BOTELLA: dónde se frena el negocio, con números reales. Mencioná el IAC y los procesos. 2-3 oraciones.

BLOQUE 3 — LA ACCIÓN CONCRETA: una sola acción ejecutable esta semana, basada en lo que se ve en la agenda. Máximo 2 oraciones.

Después, en línea separada, el número crítico en formato:
"IAC [período]: [IAC]% — [N] reuniones cara a cara, [N] procesos nuevos. [Si IAC>=100: Motor encendido. El desafío ahora es sostenerlo. / Si no: Para llegar al 100% necesitás [N] reuniones más.]"`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!isSuperAdmin(session?.user?.email)) return res.status(403).end();

  if (req.method === "GET") {
    const { data } = await supabaseAdmin
      .from("app_config").select("value").eq("key", "coach_prompt").single();
    return res.status(200).json({ prompt: data?.value ?? DEFAULT_COACH_PROMPT });
  }

  if (req.method === "POST") {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "prompt requerido" });
    await supabaseAdmin.from("app_config")
      .upsert({ key: "coach_prompt", value: prompt }, { onConflict: "key" });
    invalidateAppConfig();
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
