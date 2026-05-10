// pages/api/firma/[id].ts — Operaciones sobre un documento específico

import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getEffectiveEmail } from "../../../lib/impersonation";
import { getSubmission, resendSubmitterEmail, isDocusealConfigured } from "../../../lib/docuseal";
import { enviarEmailFirma, getAgencyName } from "../../../lib/firmaEmail";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const email = getEffectiveEmail(req, session);
  if (!email) return res.status(401).json({ error: "No autenticado" });
  const { id } = req.query as { id: string };

  const { data: doc } = await supabaseAdmin
    .from("firma_documentos")
    .select("*, firma_plantillas(nombre)")
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
      // 1) DocuSeal si está configurado
      if (isDocusealConfigured() && doc.docuseal_submission_id) {
        try {
          const submission = await getSubmission(doc.docuseal_submission_id);
          const submitter = submission.submitters?.[0];
          if (submitter?.id) await resendSubmitterEmail(submitter.id);
          return res.json({ ok: true, via: "docuseal" });
        } catch { /* caer a Resend */ }
      }

      // 2) Siempre enviar nuestro email con el link del portal
      if (!doc.firmante_email) {
        return res.status(400).json({ error: "El documento no tiene email del firmante" });
      }
      const agencyName = await getAgencyName(email);
      const nombreDoc = (doc.datos_json as Record<string, string>)?.nombre_documento
        || (doc.firma_plantillas as unknown as { nombre?: string } | null)?.nombre
        || "Documento para firmar";

      const result = await enviarEmailFirma({
        firmante_nombre: doc.firmante_nombre || "Cliente",
        firmante_email: doc.firmante_email,
        firma_token: doc.firma_token,
        nombre_documento: nombreDoc,
        agency_name: agencyName,
      });

      if (!result.ok) return res.status(500).json({ error: "Error al enviar el email" });
      return res.json({ ok: true, via: "resend", mensaje: `Email enviado a ${doc.firmante_email}` });
    }

    if (action === "cancelar") {
      await supabaseAdmin.from("firma_documentos").update({ estado: "cancelado" }).eq("id", id);
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: "Acción no reconocida" });
  }

  return res.status(405).json({ error: "Método no permitido" });
}
