// pages/api/firma/generar-pdf-final.ts — Genera PDF con página de auditoría multi-firmante

import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { generarPdfConAuditoria, FirmanteDatos } from "../../../lib/firmaAuditPdf";
import { getAgencyName } from "../../../lib/firmaEmail";
import { Resend } from "resend";
import { emailWrapperFirma, EMAIL_FROM } from "../../../lib/email";

export const config = { api: { bodyParser: { sizeLimit: "25mb" } } };

const resend = new Resend(process.env.RESEND_API_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  // Acepta firma_token (de firmante o de documento) o documento_id directo
  const { firma_token, documento_id } = req.body;

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

    // Subir a Storage
    const finalPath = `${docId}/documento_firmado_final.pdf`;
    await supabaseAdmin.storage.from("firma-docs")
      .upload(finalPath, pdfFinal, { contentType: "application/pdf", upsert: true });

    const { data: signedData } = await supabaseAdmin.storage.from("firma-docs")
      .createSignedUrl(finalPath, 60 * 60 * 24 * 365 * 5);
    const pdfUrl = signedData?.signedUrl || null;

    await supabaseAdmin.from("firma_documentos")
      .update({ url_documento_firmado: pdfUrl })
      .eq("id", docId);

    const pdfBase64 = Buffer.from(pdfFinal).toString("base64");
    const fileName = `${nombreDoc.replace(/[^a-zA-Z0-9]/g, "_")}_firmado.pdf`;

    // Email a CADA firmante con su copia
    for (const f of firmantes) {
      if (!f.email) continue;
      await resend.emails.send({
        from: EMAIL_FROM,
        to: f.email,
        subject: `Tu copia firmada: ${nombreDoc}`,
        html: emailWrapperFirma(`
          <h2 style="font-size:18px;font-weight:800;color:#111;margin:0 0 8px;">
            Tu documento firmado
          </h2>
          <p style="color:#6b7280;font-size:14px;margin:0 0 20px;line-height:1.6;">
            Hola <strong>${f.nombre}</strong>, te enviamos tu copia del documento 
            <strong>"${nombreDoc}"</strong>. Lo encontras adjunto a este email.
          </p>
          <p style="color:#9ca3af;font-size:11px;text-align:center;margin:0;">${agencyName}</p>
        `, agencyName),
        attachments: [{ filename: fileName, content: pdfBase64 }],
      }).catch(e => console.error("Email firmante error:", e));
    }

    // Email al INMOBILIARIO
    const resumenFirmantes = firmantes.map(f =>
      `${f.nombre} (${f.rol || "Firmante"}) — ${f.signed_at ? "Firmo el " + new Date(f.signed_at).toLocaleDateString("es-AR") : "Pendiente"}`
    ).join("<br/>");

    await resend.emails.send({
      from: EMAIL_FROM,
      to: doc.usuario_email,
      subject: `PDF firmado listo: ${nombreDoc}`,
      html: emailWrapperFirma(`
        <h2 style="font-size:18px;font-weight:800;color:#111;margin:0 0 8px;">
          Documento firmado completo
        </h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 16px;line-height:1.6;">
          El PDF de <strong>"${nombreDoc}"</strong> con la pagina de auditoria esta listo. 
          Lo encontras adjunto con las fotos de DNI, selfie y firma de todos los firmantes.
        </p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;margin-bottom:16px;font-size:13px;line-height:1.7;">
          ${resumenFirmantes}
        </div>
        ${pdfUrl ? `<a href="${pdfUrl}" style="display:block;background:#aa0000;color:#fff;text-align:center;padding:12px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;">
          Ver documento firmado
        </a>` : ""}
      `, agencyName),
      attachments: [{ filename: fileName, content: pdfBase64 }],
    }).catch(e => console.error("Email inmobiliario error:", e));

    return res.json({ ok: true, pdf_url: pdfUrl });

  } catch (err) {
    console.error("Error generando PDF final:", err);
    return res.status(500).json({ error: "Error al generar el PDF final" });
  }
}
