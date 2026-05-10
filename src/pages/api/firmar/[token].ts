// pages/api/firmar/[token].ts — Portal público de firma
// Acepta tanto firma_firmantes.firma_token como firma_documentos.firma_token

import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";

export const config = { api: { bodyParser: { sizeLimit: "15mb" } } };

async function getDocAgencyName(usuarioEmail: string): Promise<string> {
  const { data: sub } = await supabaseAdmin
    .from("subscriptions").select("name, team_id").eq("email", usuarioEmail).single();
  if (sub?.team_id) {
    const { data: team } = await supabaseAdmin
      .from("teams").select("agency_name, name").eq("id", sub.team_id).single();
    if (team?.agency_name) return team.agency_name;
    if (team?.name) return team.name;
  }
  return sub?.name || "Inmobiliaria";
}

// Resolver token → { doc, firmante }
// Primero busca en firma_firmantes (token del firmante individual)
// Si no, busca en firma_documentos (token legacy / documento completo)
async function resolverToken(token: string) {
  // 1. Buscar en firma_firmantes
  const { data: firmante } = await supabaseAdmin
    .from("firma_firmantes")
    .select(`
      id, nombre, email, rol, estado, firma_token,
      signed_at, dni_frente_url, dni_dorso_url, selfie_url, firma_imagen_url,
      documento_id,
      firma_documentos (
        id, estado, datos_json, expires_at, usuario_email,
        firma_token, firma_plantillas ( nombre )
      )
    `)
    .eq("firma_token", token)
    .single();

  if (firmante?.firma_documentos) {
    const doc = firmante.firma_documentos as unknown as {
      id: string;
      estado: string;
      datos_json: Record<string, string>;
      expires_at: string;
      usuario_email: string;
      firma_token: string;
      firma_plantillas: { nombre?: string } | null;
    };
    return {
      tipo: "firmante" as const,
      firmante,
      doc,
      usuarioEmail: doc.usuario_email,
    };
  }

  // 2. Fallback: buscar en firma_documentos (compatibilidad con docs anteriores)
  const { data: doc } = await supabaseAdmin
    .from("firma_documentos")
    .select(`
      id, estado, firmante_nombre, firmante_email, datos_json,
      firma_token, expires_at, signed_at, usuario_email,
      dni_frente_url, dni_dorso_url, selfie_url, firma_imagen_url,
      plantilla_id, firma_plantillas ( nombre )
    `)
    .eq("firma_token", token)
    .single();

  if (doc) {
    return { tipo: "documento" as const, firmante: null, doc, usuarioEmail: doc.usuario_email };
  }

  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { token } = req.query as { token: string };
  if (!token) return res.status(400).json({ error: "Token requerido" });

  // ── GET ─────────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const resolved = await resolverToken(token);

    if (!resolved) {
      console.error("Token not found:", token);
      return res.status(404).json({ error: "Documento no encontrado" });
    }

    const { tipo, firmante, doc } = resolved;

    // Verificar vencimiento
    if (doc.expires_at && new Date(doc.expires_at) < new Date()) {
      await supabaseAdmin.from("firma_documentos").update({ estado: "vencido" }).eq("id", doc.id);
      return res.status(410).json({ error: "El link de firma ha vencido" });
    }

    // Si el firmante individual ya firmó
    if (tipo === "firmante" && firmante!.estado === "firmado") {
      return res.json({
        id: doc.id,
        estado: "firmado",
        firmante_nombre: firmante!.nombre,
        firmante_email: firmante!.email,
        nombre_documento: (doc.datos_json as Record<string, string>)?.nombre_documento
          || (doc.firma_plantillas as { nombre?: string } | null)?.nombre || "Documento",
        agency_name: await getDocAgencyName(resolved.usuarioEmail),
        expires_at: doc.expires_at,
        signed_at: firmante!.signed_at,
        tiene_dni: !!(firmante!.dni_frente_url && firmante!.dni_dorso_url),
        tiene_selfie: !!firmante!.selfie_url,
        tiene_firma: !!firmante!.firma_imagen_url,
        datos_formulario: doc.datos_json || {},
      });
    }

    const agencyName = await getDocAgencyName(resolved.usuarioEmail);
    const nombreDocumento = (doc.datos_json as Record<string, string>)?.nombre_documento
      || (doc.firma_plantillas as { nombre?: string } | null)?.nombre
      || "Documento";

    // Usar datos del firmante individual si existe, sino del doc
    const dniFrente = tipo === "firmante" ? firmante!.dni_frente_url : (doc as unknown as Record<string, string>).dni_frente_url;
    const dniDorso  = tipo === "firmante" ? firmante!.dni_dorso_url  : (doc as unknown as Record<string, string>).dni_dorso_url;
    const selfie    = tipo === "firmante" ? firmante!.selfie_url      : (doc as unknown as Record<string, string>).selfie_url;
    const firmaImg  = tipo === "firmante" ? firmante!.firma_imagen_url: (doc as unknown as Record<string, string>).firma_imagen_url;

    return res.json({
      id: doc.id,
      firmante_id: firmante?.id || null,
      estado: tipo === "firmante" ? firmante!.estado : doc.estado,
      firmante_nombre: tipo === "firmante" ? firmante!.nombre : (doc as unknown as Record<string, string>).firmante_nombre,
      firmante_email:  tipo === "firmante" ? firmante!.email  : (doc as unknown as Record<string, string>).firmante_email,
      nombre_documento: nombreDocumento,
      agency_name: agencyName,
      expires_at: doc.expires_at,
      signed_at: tipo === "firmante" ? firmante!.signed_at : (doc as unknown as Record<string, string | null>).signed_at,
      tiene_dni:    !!(dniFrente && dniDorso),
      tiene_selfie: !!selfie,
      tiene_firma:  !!firmaImg,
      datos_formulario: doc.datos_json || {},
    });
  }

  // ── POST — subir imagen ─────────────────────────────────────────────────────
  if (req.method === "POST") {
    const { action } = req.body;

    const resolved = await resolverToken(token);
    if (!resolved) return res.status(404).json({ error: "Documento no encontrado" });

    const { tipo, firmante, doc } = resolved;

    // Verificar que no esté vencido
    if (doc.expires_at && new Date(doc.expires_at) < new Date()) {
      return res.status(410).json({ error: "El link de firma ha vencido" });
    }

    // Verificar que no esté ya firmado
    const yaFirmado = tipo === "firmante" ? firmante!.estado === "firmado" : doc.estado === "firmado";
    if (yaFirmado) return res.status(400).json({ error: "Este documento ya fue firmado" });

    if (action === "subir_imagen") {
      const { tipo: tipoImg, base64, mime } = req.body;
      const tiposValidos = ["dni_frente", "dni_dorso", "selfie", "firma"];
      if (!tiposValidos.includes(tipoImg)) return res.status(400).json({ error: "Tipo inválido" });

      const base64Data = (base64 as string).replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const ext = mime === "image/png" ? "png" : "jpg";

      // Guardar con ID del firmante si existe, sino del documento
      const storageId = tipo === "firmante" ? `${doc.id}/firmante_${firmante!.id}` : doc.id;
      const path = `${storageId}/${tipoImg}.${ext}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("firma-docs")
        .upload(path, buffer, { contentType: mime || "image/jpeg", upsert: true });

      if (uploadError) return res.status(500).json({ error: "Error al subir imagen" });

      const { data: signedData } = await supabaseAdmin.storage
        .from("firma-docs")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);

      const url = signedData?.signedUrl || path;
      const colMap: Record<string, string> = {
        dni_frente: "dni_frente_url",
        dni_dorso:  "dni_dorso_url",
        selfie:     "selfie_url",
        firma:      "firma_imagen_url",
      };

      // Guardar en el firmante individual o en el documento
      if (tipo === "firmante" && firmante) {
        await supabaseAdmin.from("firma_firmantes").update({ [colMap[tipoImg]]: url }).eq("id", firmante.id);
      } else {
        await supabaseAdmin.from("firma_documentos").update({ [colMap[tipoImg]]: url }).eq("id", doc.id);
      }

      return res.json({ ok: true, url });
    }

    // action === "firmar" → redirigir al endpoint específico del firmante
    if (action === "firmar") {
      if (tipo === "firmante") {
        // Verificar imágenes del firmante individual
        const { data: fresh } = await supabaseAdmin
          .from("firma_firmantes")
          .select("firma_imagen_url, dni_frente_url, selfie_url")
          .eq("id", firmante!.id)
          .single();

        if (!fresh?.firma_imagen_url) return res.status(400).json({ error: "Falta la firma" });
        if (!fresh?.dni_frente_url)  return res.status(400).json({ error: "Falta la foto del DNI" });
        if (!fresh?.selfie_url)      return res.status(400).json({ error: "Falta la selfie" });

        // Delegar al endpoint de firmante
        const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || "";
        const ua = req.headers["user-agent"] || "";

        await supabaseAdmin.from("firma_firmantes").update({
          estado: "firmado",
          signed_at: new Date().toISOString(),
          ip_firmante: ip,
          user_agent_firmante: ua,
        }).eq("id", firmante!.id);

        // Verificar si todos firmaron
        const { data: todos } = await supabaseAdmin
          .from("firma_firmantes")
          .select("id, estado")
          .eq("documento_id", doc.id);

        const pendientes = (todos || []).filter(f => f.id !== firmante!.id && f.estado !== "firmado");
        if (pendientes.length === 0) {
          await supabaseAdmin.from("firma_documentos")
            .update({ estado: "firmado", signed_at: new Date().toISOString() })
            .eq("id", doc.id);
        }

        return res.json({ ok: true, todos_firmaron: pendientes.length === 0 });
      } else {
        // Documento sin firmantes individuales (legacy)
        const { data: fresh } = await supabaseAdmin
          .from("firma_documentos")
          .select("firma_imagen_url, dni_frente_url, selfie_url")
          .eq("id", doc.id).single();

        if (!fresh?.firma_imagen_url) return res.status(400).json({ error: "Falta la firma" });
        if (!fresh?.dni_frente_url)  return res.status(400).json({ error: "Falta la foto del DNI" });
        if (!fresh?.selfie_url)      return res.status(400).json({ error: "Falta la selfie" });

        const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || "";
        const ua = req.headers["user-agent"] || "";

        await supabaseAdmin.from("firma_documentos").update({
          estado: "firmado",
          signed_at: new Date().toISOString(),
          ip_firmante: ip,
          user_agent_firmante: ua,
        }).eq("id", doc.id);

        return res.json({ ok: true, todos_firmaron: true });
      }
    }

    return res.status(400).json({ error: "Acción no reconocida" });
  }

  return res.status(405).json({ error: "Método no permitido" });
}
