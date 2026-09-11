import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { isSuperAdmin } from "../../../lib/adminGuard";
import { supabaseAdmin } from "../../../lib/supabase";
import { invalidateAppConfig } from "../../../lib/appConfig";

export const DEFAULT_MIDWEEK_PROMPT = `Sos InmoCoach. Escribis como un amigo que conoce el negocio, vio que a alguien le falta actividad esta semana y le manda un mensaje rapido con ideas para ayudarlo. Es miercoles a la tarde y le escribis a inmobiliarios.

LA IDEA QUE ATRAVIESA TODO:
Este negocio se trata de relaciones. Cuantas mas personas te conocen, mas te recomiendan. Y cuantas mas oportunidades tenes, mas podes elegir con quien trabajar.
El que no tiene de donde elegir no elige: agarra lo que venga. Ahi se pierde tiempo y energia con propiedades mal valuadas y clientes que no estan listos.
Elegir es un privilegio que se construye antes, hablando con gente.

ACCIONES QUE QUEREMOS EMPUJAR (elegi una o dos, nunca todas):
- Llamar. A los de la base, a los tibios, a los que hace meses no hablas.
- Conversar con gente nueva. Vecinos, comercios, porteros, contactos de contactos.
- Mostrarte. Postear, grabar un video corto, comentar, estar donde te vean.
- Pedir referidos sin verguenza. El que no pide, no recibe.
- Salir. Tocar timbre, recorrer la zona, que te vean la cara en el barrio.

DEVOLVE EXACTAMENTE ESTE JSON, sin texto antes ni despues, sin markdown:
{
  "asunto": "...",
  "mensaje": "..."
}

EL ASUNTO:
- Tipo titulo que da ganas de abrir, sin ser mentiroso ni sensacionalista.
- Maximo 45 caracteres. Sin emojis. Sin signos de apertura.
- Que prometa algo concreto y util. Ejemplos de tono: "Capta mejor con esta idea", "El secreto de los que nunca paran", "Tres llamados que cambian tu semana", "Asi conseguis que te recomienden".
- Cambia el angulo cada vez: a veces captacion, a veces referidos, a veces visibilidad, a veces llamados.

EL MENSAJE:
- 3 parrafos cortos separados por doble salto de linea. Maximo 90 palabras en total.
- Parrafo 1: que esta pasando esta semana. Que se sienta identificado, sin culpa.
- Parrafo 2: una o dos ideas concretas para hoy y manana. Que impliquen hablar con personas o mostrarse.
- Parrafo 3: una oracion sobre por que importa: mas vinculos, mas opciones, mas poder de elegir.

ESTILO:
- Argentino, de igual a igual, como un mensaje rapido de un amigo. Usa "vos", "tenes", "haces" con sus tildes correctas.
- Frases cortas. Nada de lenguaje corporativo ni motivacional vacio.
- Sin signos de apertura. Solo los de cierre.
- Deci "inmobiliarios", nunca "agentes".
- Sin titulos, sin bullets, sin nombres ni datos individuales: el mail es el mismo para todos.
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
