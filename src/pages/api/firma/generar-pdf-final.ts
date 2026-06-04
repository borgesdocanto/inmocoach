// pages/api/firma/generar-pdf-final.ts — Genera PDF con página de auditoría multi-firmante

import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getEffectiveEmail } from "../../../lib/impersonation";
import { generarPdfConAuditoria, FirmanteDatos } from "../../../lib/firmaAuditPdf";
import { getAgencyName } from "../../../lib/firmaEmail";

export const config = { api: { bodyParser: { sizeLimit: "25mb" } }, maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { firma_token, documento_id, enviar_email_inmobiliario } = req.body;

  // Si viene firma_token es llamado desde el portal público (firmante acaba de firmar)
  // Si viene documento_id es llamado desde el panel del inmobiliario (requiere sesión)
  const esLlamadaPublica = !!firma_token && !documento_id;

  let emailUsuario: string | null = null;

  if (!esLlamadaPublica) {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });
    emailUsuario = getEffectiveEmail(req, session);
    if (!emailUsuario) return res.status(401).json({ error: "No autenticado" });
  }

  let docId: string | null = documento_id || null;

  // Resolver docId desde token de firmante
  if (!docId && firma_token) {
    // Intentar como token de firmante
    const { data: firmante } = await supabaseAdmin
      .from("firma_firmantes")
      .select("documento_id")
      .eq("firma_token", firma_token)
      .single();
    if (firmante?.documento_id) {
      docId = firmante.documento_id;
    } else {
      // Intentar como token de documento
      const { data: doc } = await supabaseAdmin
        .from("firma_documentos")
        .select("id")
        .eq("firma_token", firma_token)
        .single();
      if (doc) docId = doc.id;
    }
  }

  if (!docId) return res.status(400).json({ error: "Token o ID de documento requerido" });

  // Obtener documento completo
  const { data: doc } = await supabaseAdmin
    .from("firma_documentos")
    .select("*, firma_plantillas(nombre, pdf_url)")
    .eq("id", docId)
    .single();

  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });

  // Si es llamada autenticada, verificar que el documento pertenece al usuario
  if (!esLlamadaPublica && emailUsuario && doc.usuario_email !== emailUsuario) {
    // Verificar si el usuario es broker/owner del mismo equipo
    const { data: subCaller } = await supabaseAdmin
      .from("subscriptions")
      .select("team_id, team_role")
      .eq("email", emailUsuario)
      .single();

    const { data: subOwner } = await supabaseAdmin
      .from("subscriptions")
      .select("team_id")
      .eq("email", doc.usuario_email)
      .single();

    const mismEquipo = subCaller?.team_id && subCaller.team_id === subOwner?.team_id;
    const esBroker = subCaller?.team_role === "owner" || subCaller?.team_role === "team_leader";

    if (!mismEquipo || !esBroker) {
      return res.status(403).json({ error: "Sin permisos sobre este documento" });
    }
  }

  // Obtener TODOS los firmantes individuales con sus imágenes
  const { data: firmantesDb } = await supabaseAdmin
    .from("firma_firmantes")
    .select("*")
    .eq("documento_id", docId)
    .order("orden");

  const agencyName = await getAgencyName(doc.usuario_email);
  const plantilla = doc.firma_plantillas as { nombre?: string; pdf_url?: string } | null;
  const nombreDoc = (doc.datos_json as Record<string, string>)?.nombre_documento
    || plantilla?.nombre || "Documento firmado";

  // Construir array de firmantes para la auditoría
  let firmantes: FirmanteDatos[] = [];

  if (firmantesDb && firmantesDb.length > 0) {
    // Multi-firmante: usar datos de firma_firmantes
    firmantes = firmantesDb.map(f => ({
      nombre: f.nombre || "",
      email: f.email || "",
      telefono: f.telefono,
      rol: f.rol || "Firmante",
      signed_at: f.signed_at,
      ip_firmante: f.ip_firmante,
      user_agent: f.user_agent_firmante,
      firma_token: f.firma_token,
      firma_imagen_url: f.firma_imagen_url,
      dni_frente_url: f.dni_frente_url,
      dni_dorso_url: f.dni_dorso_url,
      selfie_url: f.selfie_url,
    }));
  } else {
    // Firmante único legacy: usar datos del documento
    firmantes = [{
      nombre: doc.firmante_nombre || "",
      email: doc.firmante_email || "",
      telefono: doc.firmante_telefono,
      rol: "Firmante",
      signed_at: doc.signed_at,
      ip_firmante: doc.ip_firmante,
      user_agent: doc.user_agent_firmante,
      firma_token: doc.firma_token,
      firma_imagen_url: doc.firma_imagen_url,
      dni_frente_url: doc.dni_frente_url,
      dni_dorso_url: doc.dni_dorso_url,
      selfie_url: doc.selfie_url,
    }];
  }

  // Obtener PDF original
  let pdfOriginalBytes: Uint8Array | null = null;

  const { data: storageFile } = await supabaseAdmin.storage
    .from("firma-docs")
    .download(`${docId}/documento_original.pdf`);
  if (storageFile) pdfOriginalBytes = new Uint8Array(await storageFile.arrayBuffer());

  if (!pdfOriginalBytes && plantilla?.pdf_url) {
    try {
      const r = await fetch(plantilla.pdf_url);
      if (r.ok) pdfOriginalBytes = new Uint8Array(await r.arrayBuffer());
    } catch { /* ignorar */ }
  }

  if (!pdfOriginalBytes) {
    const { PDFDocument } = await import("pdf-lib");
    pdfOriginalBytes = await (await PDFDocument.create()).save();
  }

  try {
    const pdfFinal = await generarPdfConAuditoria(pdfOriginalBytes, {
      nombre_documento: nombreDoc,
      agency_name: agencyName,
      signed_at: doc.signed_at || new Date().toISOString(),
      firma_token: doc.firma_token,
      submission_id: doc.docuseal_submission_id,
      firmantes,
    });

    // Subir a Storage con timestamp para romper caché
    const timestamp = Date.now();
    const finalPath = `${docId}/documento_firmado_final_${timestamp}.pdf`;

    const { error: uploadError } = await supabaseAdmin.storage.from("firma-docs")
      .upload(finalPath, pdfFinal, { contentType: "application/pdf", upsert: true });

    if (uploadError) {
      console.error("Error subiendo PDF:", uploadError);
      return res.status(500).json({ error: "Error al subir el PDF al storage" });
    }

    // Limpiar versiones anteriores (ignorar errores — no es crítico)
    try {
      const { data: archivos } = await supabaseAdmin.storage.from("firma-docs").list(docId);
      const anteriores = (archivos || []).filter(f =>
        (f.name.startsWith("documento_firmado_final_") || f.name === "documento_firmado_final.pdf")
        && f.name !== `documento_firmado_final_${timestamp}.pdf`
      );
      if (anteriores.length > 0) {
        await supabaseAdmin.storage.from("firma-docs")
          .remove(anteriores.map(f => `${docId}/${f.name}`));
      }
    } catch { /* no crítico */ }

    const { data: signedData, error: signError } = await supabaseAdmin.storage.from("firma-docs")
      .createSignedUrl(finalPath, 60 * 60 * 24 * 365 * 5);

    if (signError || !signedData?.signedUrl) {
      console.error("Error generando URL firmada:", signError);
      return res.status(500).json({ error: "Error al generar la URL del PDF" });
    }

    const pdfUrl = signedData.signedUrl;

    const { error: updateError } = await supabaseAdmin.from("firma_documentos")
      .update({ url_documento_firmado: pdfUrl })
      .eq("id", docId);

    if (updateError) {
      console.error("Error actualizando URL en BD:", updateError);
      return res.status(500).json({ error: "Error al guardar la URL del PDF" });
    }

    return res.json({ ok: true, pdf_url: pdfUrl });

  } catch (err) {
    console.error("Error generando PDF final:", err);
    return res.status(500).json({ error: "Error al generar el PDF final" });
  }
}
