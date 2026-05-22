// pages/api/firma/agregar-firmante.ts

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

  const { documento_id, nombre, email: emailFirmante, telefono, rol } = req.body;

  if (!documento_id || !nombre?.trim() || !emailFirmante?.trim()) {
    return res.status(400).json({ error: "Nombre y email son obligatorios" });
  }

  // Verificar que el documento pertenece al usuario (o es broker del equipo)
  const { data: doc } = await supabaseAdmin
    .from("firma_documentos")
    .select("id, usuario_email, estado, datos_json, firma_plantillas(nombre)")
    .eq("id", documento_id)
    .single();

  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
  if (doc.estado === "firmado") return res.status(400).json({ error: "El documento ya está completamente firmado" });
  if (doc.estado === "cancelado" || doc.estado === "vencido") {
    return res.status(400).json({ error: "No se puede modificar un documento cancelado o vencido" });
  }

  // Verificar permisos
  if (doc.usuario_email !== email) {
    const { data: caller } = await supabaseAdmin
      .from("subscriptions").select("team_id, team_role").eq("email", email).single();
    const { data: owner } = await supabaseAdmin
      .from("subscriptions").select("team_id").eq("email", doc.usuario_email).single();
    const esBroker = caller?.team_role === "owner" || caller?.team_role === "team_leader";
    if (!esBroker || caller?.team_id !== owner?.team_id) {
      return res.status(403).json({ error: "Sin permisos" });
    }
  }

  // Obtener el orden máximo actual
  const { data: firmantesExistentes } = await supabaseAdmin
    .from("firma_firmantes")
    .select("orden")
    .eq("documento_id", documento_id)
    .order("orden", { ascending: false })
    .limit(1);

  const maxOrden = firmantesExistentes?.[0]?.orden || 0;

  // Insertar nuevo firmante
  const { data: nuevoFirmante, error } = await supabaseAdmin
    .from("firma_firmantes")
    .insert({
      documento_id,
      nombre: nombre.trim(),
      email: emailFirmante.trim(),
      telefono: telefono?.trim() || null,
      rol: rol || "Firmante",
      orden: maxOrden + 1,
      estado: "pendiente",
    })
    .select()
    .single();

  if (error || !nuevoFirmante) return res.status(500).json({ error: error?.message || "Error al agregar firmante" });

  // Contar total de firmantes
  const { count: total } = await supabaseAdmin
    .from("firma_firmantes")
    .select("id", { count: "exact", head: true })
    .eq("documento_id", documento_id);

  const agencyName = await getAgencyName(doc.usuario_email);
  const nombreDoc = (doc.datos_json as Record<string, string>)?.nombre_documento
    || (doc.firma_plantillas as { nombre?: string } | null)?.nombre
    || "Documento";

  // Enviar email al nuevo firmante
  await enviarEmailFirma({
    firmante_nombre: nuevoFirmante.nombre,
    firmante_email: nuevoFirmante.email,
    firma_token: nuevoFirmante.firma_token,
    nombre_documento: nombreDoc,
    agency_name: agencyName,
    rol_firmante: nuevoFirmante.rol,
    total_firmantes: total || 1,
  });

  // Marcar email enviado
  await supabaseAdmin
    .from("firma_firmantes")
    .update({ email_enviado_at: new Date().toISOString() })
    .eq("id", nuevoFirmante.id);

  return res.status(201).json(nuevoFirmante);
}
