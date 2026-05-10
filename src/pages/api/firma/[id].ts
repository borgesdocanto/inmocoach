// pages/api/firma/[id].ts — Operaciones sobre un documento específico

import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getEffectiveEmail } from "../../../lib/impersonation";
import { getSubmission, resendSubmitterEmail, isDocusealConfigured } from "../../../lib/docuseal";
import { Resend } from "resend";
import { emailWrapper, EMAIL_FROM } from "../../../lib/email";

const resend = new Resend(process.env.RESEND_API_KEY!);

function emailFirmaHtml(params: {
  firmante_nombre: string;
  inmobiliario_nombre: string;
  nombre_documento: string;
  mensaje_extra?: string;
}): string {
  return emailWrapper(`
    <h2 style="font-size:18px;font-weight:700;color:#111;margin:0 0 8px;">
      Tenés un documento para firmar
    </h2>
    <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">
      Hola <strong>${params.firmante_nombre}</strong>, ${params.inmobiliario_nombre} te envió 
      <strong>${params.nombre_documento}</strong> para que lo firmes digitalmente.
    </p>

    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="color:#374151;font-size:13px;margin:0 0 8px;font-weight:600;">¿Cómo firmar?</p>
      <ol style="color:#6b7280;font-size:13px;margin:0;padding-left:20px;line-height:1.8;">
        <li>Hacé clic en el botón de abajo</li>
        <li>Revisá el documento</li>
        <li>Firmá con el dedo o el mouse</li>
        <li>Listo — recibís una copia por email</li>
      </ol>
    </div>

    ${params.mensaje_extra ? `
    <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#92400e;">
      ${params.mensaje_extra}
    </div>` : ""}

    <div style="background:#aa0000;border-radius:10px;text-align:center;padding:14px;">
      <a href="https://www.inmocoach.com.ar/firma-digital" 
         style="color:#fff;font-size:15px;font-weight:700;text-decoration:none;">
        ✍ Firmar documento
      </a>
    </div>

    <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:20px;">
      Este documento tiene vigencia de 30 días. Si tenés dudas, contactá a ${params.inmobiliario_nombre}.
    </p>
  `);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const email = getEffectiveEmail(req, session);
  if (!email) return res.status(401).json({ error: "No autenticado" });
  const { id } = req.query as { id: string };

  // Verificar que el documento pertenece al usuario
  const { data: doc } = await supabaseAdmin
    .from("firma_documentos")
    .select("*")
    .eq("id", id)
    .eq("usuario_email", email)
    .single();

  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });

  // GET — detalle + sync DocuSeal
  if (req.method === "GET") {
    if (doc.docuseal_submission_id && isDocusealConfigured()) {
      try {
        const submission = await getSubmission(doc.docuseal_submission_id);
        if (submission.status === "completed" && doc.estado !== "firmado") {
          await supabaseAdmin
            .from("firma_documentos")
            .update({ estado: "firmado", signed_at: new Date().toISOString() })
            .eq("id", id);
          doc.estado = "firmado";
        }
      } catch { /* ignorar */ }
    }
    return res.json(doc);
  }

  // PATCH — editar datos del firmante (solo pendientes)
  if (req.method === "PATCH") {
    if (doc.estado !== "pendiente") {
      return res.status(400).json({ error: "Solo se pueden editar documentos pendientes" });
    }
    const { firmante_nombre, firmante_email, firmante_telefono } = req.body;
    if (!firmante_nombre || !firmante_email) {
      return res.status(400).json({ error: "Nombre y email son obligatorios" });
    }

    const { data: updated, error } = await supabaseAdmin
      .from("firma_documentos")
      .update({ firmante_nombre, firmante_email, firmante_telefono: firmante_telefono || null })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, doc: updated });
  }

  // POST — acciones: reenviar, cancelar
  if (req.method === "POST") {
    const { action } = req.body;

    if (action === "reenviar") {
      // Obtener nombre del inmobiliario
      const { data: sub } = await supabaseAdmin
        .from("subscriptions")
        .select("name")
        .eq("email", email)
        .single();
      const inmobiliarioNombre = sub?.name || "Tu inmobiliario";

      const nombreDoc =
        doc.datos_json?.nombre_documento ||
        doc.firma_plantillas?.nombre ||
        "Documento para firmar";

      // 1) Si DocuSeal está configurado y tiene submission → reenviar via DocuSeal
      if (isDocusealConfigured() && doc.docuseal_submission_id) {
        try {
          const submission = await getSubmission(doc.docuseal_submission_id);
          const submitter = submission.submitters?.[0];
          if (submitter?.id) await resendSubmitterEmail(submitter.id);
          return res.json({ ok: true, via: "docuseal", mensaje: "Email de firma reenviado" });
        } catch {
          // Si DocuSeal falla, caemos a Resend
        }
      }

      // 2) Fallback: enviar email via Resend con instrucciones
      if (!doc.firmante_email) {
        return res.status(400).json({ error: "El documento no tiene email del firmante" });
      }

      const { error: sendError } = await resend.emails.send({
        from: EMAIL_FROM,
        to: doc.firmante_email,
        subject: `Documento para firmar: ${nombreDoc}`,
        html: emailFirmaHtml({
          firmante_nombre: doc.firmante_nombre || "Cliente",
          inmobiliario_nombre: inmobiliarioNombre,
          nombre_documento: nombreDoc,
        }),
      });

      if (sendError) {
        console.error("Resend error:", sendError);
        return res.status(500).json({ error: "Error al enviar el email" });
      }

      return res.json({ ok: true, via: "resend", mensaje: `Email enviado a ${doc.firmante_email}` });
    }

    if (action === "cancelar") {
      await supabaseAdmin
        .from("firma_documentos")
        .update({ estado: "cancelado" })
        .eq("id", id);
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: "Acción no reconocida" });
  }

  return res.status(405).json({ error: "Método no permitido" });
}
