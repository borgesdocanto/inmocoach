// pages/api/firmar/[token].ts — Portal público de firma (sin autenticación)

import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";

export const config = { api: { bodyParser: { sizeLimit: "15mb" } } };

// Obtener agency_name del propietario del documento
async function getDocAgencyName(usuarioEmail: string): Promise<string> {
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("name, team_id")
    .eq("email", usuarioEmail)
    .single();

  if (sub?.team_id) {
    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("agency_name, name")
      .eq("id", sub.team_id)
      .single();
    if (team?.agency_name) return team.agency_name;
    if (team?.name) return team.name;
  }
  return sub?.name || "InmoCoach";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { token } = req.query as { token: string };
  if (!token) return res.status(400).json({ error: "Token requerido" });

  // ── GET — datos del documento ──────────────────────────────────────────────
  if (req.method === "GET") {
    const { data: doc, error } = await supabaseAdmin
      .from("firma_documentos")
      .select(`
        id, estado, firmante_nombre, firmante_email, datos_json,
        firma_token, expires_at, signed_at, usuario_email,
        dni_frente_url, dni_dorso_url, selfie_url, firma_imagen_url,
        plantilla_id, firma_plantillas ( nombre )
      `)
      .eq("firma_token", token)
      .single();

    if (error || !doc) {
      console.error("Token lookup error:", error?.message, "token:", token);
      return res.status(404).json({ error: "Documento no encontrado" });
    }

    if (doc.expires_at && new Date(doc.expires_at) < new Date()) {
      await supabaseAdmin
        .from("firma_documentos")
        .update({ estado: "vencido" })
        .eq("firma_token", token);
      return res.status(410).json({ error: "El link de firma ha vencido" });
    }

    const agencyName = await getDocAgencyName(doc.usuario_email);
    const plantilla = doc.firma_plantillas as unknown as { nombre?: string } | null;
    const nombreDocumento =
      (doc.datos_json as Record<string, string>)?.nombre_documento ||
      plantilla?.nombre ||
      "Documento";

    return res.json({
      id: doc.id,
      estado: doc.estado,
      firmante_nombre: doc.firmante_nombre,
      firmante_email: doc.firmante_email,
      nombre_documento: nombreDocumento,
      agency_name: agencyName,
      expires_at: doc.expires_at,
      signed_at: doc.signed_at,
      tiene_dni: !!(doc.dni_frente_url && doc.dni_dorso_url),
      tiene_selfie: !!doc.selfie_url,
      tiene_firma: !!doc.firma_imagen_url,
      datos_formulario: doc.datos_json || {},
    });
  }

  // ── POST — acciones del firmante ───────────────────────────────────────────
  if (req.method === "POST") {
    const { action } = req.body;

    const { data: doc } = await supabaseAdmin
      .from("firma_documentos")
      .select("id, estado, expires_at, dni_frente_url, dni_dorso_url, selfie_url, firma_imagen_url")
      .eq("firma_token", token)
      .single();

    if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
    if (doc.estado === "firmado") return res.status(400).json({ error: "Este documento ya fue firmado" });
    if (doc.expires_at && new Date(doc.expires_at) < new Date()) {
      return res.status(410).json({ error: "El link de firma ha vencido" });
    }

    // Subir imagen de verificación
    if (action === "subir_imagen") {
      const { tipo, base64, mime } = req.body;
      const tiposValidos = ["dni_frente", "dni_dorso", "selfie", "firma"];
      if (!tiposValidos.includes(tipo)) return res.status(400).json({ error: "Tipo inválido" });

      const base64Data = (base64 as string).replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const ext = mime === "image/png" ? "png" : "jpg";
      const path = `${doc.id}/${tipo}.${ext}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("firma-docs")
        .upload(path, buffer, { contentType: mime || "image/jpeg", upsert: true });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        return res.status(500).json({ error: "Error al subir imagen" });
      }

      const { data: signedData } = await supabaseAdmin.storage
        .from("firma-docs")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);

      const url = signedData?.signedUrl || path;
      const colMap: Record<string, string> = {
        dni_frente: "dni_frente_url",
        dni_dorso: "dni_dorso_url",
        selfie: "selfie_url",
        firma: "firma_imagen_url",
      };

      await supabaseAdmin
        .from("firma_documentos")
        .update({ [colMap[tipo]]: url })
        .eq("id", doc.id);

      return res.json({ ok: true, url });
    }

    // Completar firma
    if (action === "firmar") {
      // Re-fetch para tener los campos más frescos
      const { data: fresh } = await supabaseAdmin
        .from("firma_documentos")
        .select("firma_imagen_url, dni_frente_url, selfie_url")
        .eq("id", doc.id)
        .single();

      if (!fresh?.firma_imagen_url) return res.status(400).json({ error: "Falta la firma" });
      if (!fresh?.dni_frente_url)  return res.status(400).json({ error: "Falta la foto del DNI" });
      if (!fresh?.selfie_url)      return res.status(400).json({ error: "Falta la selfie" });

      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress || "";
      const ua = req.headers["user-agent"] || "";

      await supabaseAdmin
        .from("firma_documentos")
        .update({
          estado: "firmado",
          signed_at: new Date().toISOString(),
          ip_firmante: ip,
          user_agent_firmante: ua,
        })
        .eq("id", doc.id);

      return res.json({ ok: true, mensaje: "Documento firmado correctamente" });
    }

    return res.status(400).json({ error: "Acción no reconocida" });
  }

  return res.status(405).json({ error: "Método no permitido" });
}
