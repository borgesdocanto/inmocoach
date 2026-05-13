// pages/api/firma/editar-firmante.ts — Editar nombre/email de un firmante individual

import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getEffectiveEmail } from "../../../lib/impersonation";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const email = getEffectiveEmail(req, session);
  if (!email) return res.status(401).json({ error: "No autenticado" });

  const { firmante_id, documento_id, nombre, email: nuevoEmail } = req.body;

  if (!firmante_id || !documento_id || !nombre || !nuevoEmail) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  // Verificar que el documento pertenece al usuario (o es broker del equipo)
  const { data: doc } = await supabaseAdmin
    .from("firma_documentos")
    .select("id, usuario_email, estado")
    .eq("id", documento_id)
    .single();

  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });

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

  // Verificar que el firmante no haya firmado ya
  const { data: firmante } = await supabaseAdmin
    .from("firma_firmantes")
    .select("id, estado")
    .eq("id", firmante_id)
    .eq("documento_id", documento_id)
    .single();

  if (!firmante) return res.status(404).json({ error: "Firmante no encontrado" });
  if (firmante.estado === "firmado") {
    return res.status(400).json({ error: "No se puede editar un firmante que ya firmó" });
  }

  // Actualizar
  const { error } = await supabaseAdmin
    .from("firma_firmantes")
    .update({ nombre: nombre.trim(), email: nuevoEmail.trim() })
    .eq("id", firmante_id);

  if (error) return res.status(500).json({ error: error.message });

  // También actualizar en firma_documentos si es el primer firmante (campo legacy)
  const { data: primerFirmante } = await supabaseAdmin
    .from("firma_firmantes")
    .select("id")
    .eq("documento_id", documento_id)
    .order("orden")
    .limit(1)
    .single();

  if (primerFirmante?.id === firmante_id) {
    await supabaseAdmin
      .from("firma_documentos")
      .update({ firmante_nombre: nombre.trim(), firmante_email: nuevoEmail.trim() })
      .eq("id", documento_id);
  }

  return res.json({ ok: true });
}
