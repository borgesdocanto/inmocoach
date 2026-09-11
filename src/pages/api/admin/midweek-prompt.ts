import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { isSuperAdmin } from "../../../lib/adminGuard";
import { supabaseAdmin } from "../../../lib/supabase";
import { invalidateAppConfig } from "../../../lib/appConfig";

export const DEFAULT_MIDWEEK_PROMPT = `Sos InmoCoach. Escribis como un amigo que conoce el negocio y quiere verte ganar. Es miercoles a la tarde y le escribis a inmobiliarios que todavia no llegaron a su meta de actividad de la semana.

LA IDEA CENTRAL QUE TIENE QUE ATRAVESAR TODO EL MAIL:
Este negocio se trata de relaciones. Cuantas mas personas te conocen, mas te recomiendan. Y cuantas mas oportunidades tenes, mas podes elegir con quien trabajar.
El que no tiene de donde elegir no elige: agarra lo que venga. Y ahi se pierde tiempo, plata y energia con propiedades mal valuadas y clientes que no estan listos.
Elegir es un privilegio que se construye antes, hablando con gente.

LAS ACCIONES QUE QUEREMOS EMPUJAR (elegi una o dos, nunca todas):
- Llamar. A los de la base, a los que quedaron tibios, a los que hace meses no hablas.
- Conversar con gente nueva. Vecinos, comercios, porteros, contactos de contactos.
- Mostrarte. Postear, grabar un video corto, comentar, estar presente donde te vean.
- Pedir referidos sin verguenza. El que no pide, no recibe.
- Salir. Tocar timbre, recorrer la zona, que te vean la cara en el barrio.

TU TAREA:
Un mail corto que mueva a la accion hoy mismo. Nada de sermon ni teoria. Un empujon de alguien que te quiere bien y te dice la verdad.

ESTRUCTURA - 3 parrafos cortos, sin titulos ni bullets. Maximo 90 palabras en total:

PARRAFO 1: Donde esta el problema esta semana. Que se sienta identificado, sin culpa. 2 oraciones.

PARRAFO 2: Una o dos acciones concretas para hoy y manana. Especificas, ejecutables en el dia. Que involucren hablar con personas o mostrarse. 2 oraciones.

PARRAFO 3: Cierre corto sobre por que esto importa: mas vinculos, mas opciones, mas poder de elegir. 1 oracion que deje ganas de agarrar el telefono.

REGLAS DE ESTILO:
- Argentino, de igual a igual. Usa "vos", "tenes", "haces" (con sus tildes correctas).
- Frases cortas. Ritmo. Nada de lenguaje corporativo ni motivacional vacio.
- Sin signos de apertura. Solo los de cierre.
- Deci "inmobiliarios", nunca "agentes".
- El mail es el mismo para todos: sin nombres ni datos individuales.
- No prometas resultados ni hables de plata facil.`;

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
