// pages/api/firma/generar-pdf-final.ts
// Se llama cuando el cliente termina de firmar en el portal propio
// Descarga el PDF original, agrega la página de auditoría y sube a DocuSeal

import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { generarPdfConAuditoria } from "../../../lib/firmaAuditPdf";
import { getAgencyName } from "../../../lib/firmaEmail";
import { Resend } from "resend";
import { emailWrapperFirma, EMAIL_FROM } from "../../../lib/email";

export const config = { api: { bodyParser: { sizeLimit: "25mb" } } };

const resend = new Resend(process.env.RESEND_API_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { firma_token } = req.body;
  if (!firma_token) return res.status(400).json({ error: "Token requerido" });

  // Obtener documento con todos los datos
  const { data: doc } = await supabaseAdmin
    .from("firma_documentos")
    .select(`
      *, firma_plantillas ( nombre, pdf_url )
    `)
    .eq("firma_token", firma_token)
    .eq("estado", "firmado")
    .single();

  if (!doc) return res.status(404).json({ error: "Documento no encontrado o no firmado" });

  const agencyName = await getAgencyName(doc.usuario_email);
  const plantilla = doc.firma_plantillas as { nombre?: string; pdf_url?: string } | null;
  const nombreDoc = (doc.datos_json as Record<string, string>)?.nombre_documento
    || plantilla?.nombre
    || "Documento firmado";

  // Obtener el PDF original desde Supabase Storage
  let pdfOriginalBytes: Uint8Array | null = null;

  // 1. Intentar desde Storage (si fue subido como PDF libre)
  const storagePath = `${doc.id}/documento_original.pdf`;
  const { data: storageFile } = await supabaseAdmin.storage
    .from("firma-docs")
    .download(storagePath);

  if (storageFile) {
    pdfOriginalBytes = new Uint8Array(await storageFile.arrayBuffer());
  }

  // 2. Si es de plantilla con pdf_url, descargar desde ahí
  if (!pdfOriginalBytes && plantilla?.pdf_url) {
    try {
      const r = await fetch(plantilla.pdf_url);
      if (r.ok) pdfOriginalBytes = new Uint8Array(await r.arrayBuffer());
    } catch { /* ignorar */ }
  }

  // Si no hay PDF original, crear uno vacío como base para la auditoría
  if (!pdfOriginalBytes) {
    const { PDFDocument } = await import("pdf-lib");
    const blankDoc = await PDFDocument.create();
    pdfOriginalBytes = await blankDoc.save();
  }

  try {
    // Generar PDF con página de auditoría
    const pdfFinal = await generarPdfConAuditoria(pdfOriginalBytes, {
      nombre_documento: nombreDoc,
      agency_name: agencyName,
      firmante_nombre: doc.firmante_nombre || "",
      firmante_email: doc.firmante_email || "",
      firmante_telefono: doc.firmante_telefono,
      signed_at: doc.signed_at || new Date().toISOString(),
      ip_firmante: doc.ip_firmante,
      user_agent: doc.user_agent_firmante,
      firma_token: doc.firma_token,
      submission_id: doc.docuseal_submission_id,
      firma_imagen_url: doc.firma_imagen_url,
      dni_frente_url: doc.dni_frente_url,
      dni_dorso_url: doc.dni_dorso_url,
      selfie_url: doc.selfie_url,
    });

    // Subir PDF final a Supabase Storage
    const finalPath = `${doc.id}/documento_firmado_final.pdf`;
    await supabaseAdmin.storage
      .from("firma-docs")
      .upload(finalPath, pdfFinal, {
        contentType: "application/pdf",
        upsert: true,
      });

    // Obtener URL firmada con vigencia larga
    const { data: signedData } = await supabaseAdmin.storage
      .from("firma-docs")
      .createSignedUrl(finalPath, 60 * 60 * 24 * 365 * 5); // 5 años

    const pdfUrl = signedData?.signedUrl || null;

    // Actualizar URL en Supabase
    await supabaseAdmin
      .from("firma_documentos")
      .update({ url_documento_firmado: pdfUrl })
      .eq("firma_token", firma_token);

    // Convertir PDF a base64 para adjuntar en emails
    const pdfBase64 = Buffer.from(pdfFinal).toString("base64");

    // Email al FIRMANTE — copia con PDF adjunto
    if (doc.firmante_email) {
      await resend.emails.send({
        from: EMAIL_FROM,
        to: doc.firmante_email,
        subject: `Tu copia firmada: ${nombreDoc}`,
        html: emailWrapperFirma(`
          <h2 style="font-size:18px;font-weight:800;color:#111;margin:0 0 8px;">
            ✅ Firmaste el documento correctamente
          </h2>
          <p style="color:#6b7280;font-size:14px;margin:0 0 20px;line-height:1.6;">
            Hola <strong>${doc.firmante_nombre}</strong>, te enviamos tu copia del documento 
            <strong>"${nombreDoc}"</strong> firmado con <strong>${agencyName}</strong>.<br/>
            Lo encontrás adjunto a este email.
          </p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin-bottom:20px;">
            <div style="font-size:13px;font-weight:700;color:#065f46;">📄 ${nombreDoc}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">
              Firmado el ${new Date(doc.signed_at).toLocaleDateString("es-AR")}
            </div>
          </div>
          <p style="color:#9ca3af;font-size:11px;text-align:center;margin:0;">
            ${agencyName}
          </p>
        `, agencyName),
        attachments: [
          {
            filename: `${nombreDoc.replace(/[^a-zA-Z0-9]/g, "_")}_firmado.pdf`,
            content: pdfBase64,
          },
        ],
      }).catch(e => console.error("Email firmante error:", e));
    }

    // Email al INMOBILIARIO — aviso con PDF adjunto
    await resend.emails.send({
      from: EMAIL_FROM,
      to: doc.usuario_email,
      subject: `✅ ${doc.firmante_nombre} firmó: ${nombreDoc}`,
      html: emailWrapperFirma(`
        <h2 style="font-size:18px;font-weight:800;color:#111;margin:0 0 8px;">
          ✅ Documento firmado
        </h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 20px;line-height:1.6;">
          <strong>${doc.firmante_nombre}</strong> firmó el documento 
          <strong>"${nombreDoc}"</strong>. Lo encontrás adjunto con la página de auditoría completa.
        </p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin-bottom:16px;font-size:13px;">
          <div style="margin-bottom:6px;"><strong>Firmante:</strong> ${doc.firmante_nombre}</div>
          <div style="margin-bottom:6px;"><strong>Email:</strong> ${doc.firmante_email}</div>
          <div style="margin-bottom:6px;"><strong>IP:</strong> ${doc.ip_firmante || "No registrada"}</div>
          <div><strong>Fecha:</strong> ${new Date(doc.signed_at).toLocaleString("es-AR")}</div>
        </div>
        ${pdfUrl ? `<a href="${pdfUrl}" style="display:block;background:#aa0000;color:#fff;text-align:center;padding:12px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;margin-bottom:16px;">
          📄 Ver documento firmado
        </a>` : ""}
        <p style="color:#9ca3af;font-size:11px;text-align:center;margin:0;">
          ${agencyName}
        </p>
      `, agencyName),
      attachments: [
        {
          filename: `${nombreDoc.replace(/[^a-zA-Z0-9]/g, "_")}_firmado.pdf`,
          content: pdfBase64,
        },
      ],
    }).catch(e => console.error("Email inmobiliario error:", e));

    return res.json({ ok: true, pdf_url: pdfUrl });

  } catch (err) {
    console.error("Error generando PDF final:", err);
    return res.status(500).json({ error: "Error al generar el PDF final" });
  }
}
