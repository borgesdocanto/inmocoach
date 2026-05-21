// pages/api/firma/reenviar-firmante.ts — Reenviar email a un firmante individual

import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getEffectiveEmail } from "../../../lib/impersonation";
import { enviarEmailFirma, getAgencyName } from "../../../lib/firmaEmail";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const email = getEffectiveEmail(req, session);
  if (!email) return res.status(401).json({ error: "No autenticado" });

  const { firmante_id, documento_id } = req.body;

  // Verificar que el documento pertenece al usuario O a su equipo (broker/TL puede reenviar)
  const { data: doc } = await supabaseAdmin
    .from("firma_documentos")
    .select("id, usuario_email, team_id, datos_json, firma_plantillas(nombre)")
    .eq("id", documento_id)
    .single();

  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });

  // Obtener team_id del caller para validar aislamiento entre tenants
  const { data: callerSub } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, team_role")
    .eq("email", email)
    .single();

  const callerTeamId = callerSub?.team_id ?? null;
  const isOwnerOrTL = callerSub?.team_role === "owner" || callerSub?.team_role === "team_leader";

  // El caller puede acceder si: es el dueño del doc, o es broker/TL del mismo equipo
  const isSameUser = doc.usuario_email === email;
  const isSameTeam = doc.team_id && callerTeamId && doc.team_id === callerTeamId && isOwnerOrTL;

  if (!isSameUser && !isSameTeam) {
    return res.status(403).json({ error: "No tenés permiso para reenviar este documento" });
  }

  // Obtener el firmante
  const { data: firmante } = await supabaseAdmin
    .from("firma_firmantes")
    .select("*")
    .eq("id", firmante_id)
    .eq("documento_id", documento_id)
    .single();

  if (!firmante) return res.status(404).json({ error: "Firmante no encontrado" });
  if (firmante.estado === "firmado") return res.status(400).json({ error: "Este firmante ya firmó" });

  // Contar total de firmantes
  const { count } = await supabaseAdmin
    .from("firma_firmantes")
    .select("id", { count: "exact", head: true })
    .eq("documento_id", documento_id);

  const agencyName = await getAgencyName(email);
  const nombreDoc = (doc.datos_json as Record<string, string>)?.nombre_documento
    || (doc.firma_plantillas as unknown as { nombre?: string } | null)?.nombre
    || "Documento";

  const result = await enviarEmailFirma({
    firmante_nombre: firmante.nombre,
    firmante_email: firmante.email,
    firma_token: firmante.firma_token,
    nombre_documento: nombreDoc,
    agency_name: agencyName,
    rol_firmante: firmante.rol,
    total_firmantes: count || 1,
  });

  if (!result.ok) return res.status(500).json({ error: "Error al enviar email" });

  // Actualizar timestamp de último envío
  await supabaseAdmin
    .from("firma_firmantes")
    .update({ email_enviado_at: new Date().toISOString(), recordatorio_count: (firmante.recordatorio_count || 0) + 1 })
    .eq("id", firmante_id);

  return res.json({ ok: true });
}
