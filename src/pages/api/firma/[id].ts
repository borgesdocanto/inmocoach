// pages/api/firma/[id].ts — Operaciones sobre un documento específico

import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getEffectiveEmail } from "../../../lib/impersonation";
import { getSubmission, resendSubmitterEmail } from "../../../lib/docuseal";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const email = getEffectiveEmail(req, session);
  const { id } = req.query as { id: string };

  // Verificar que el documento pertenece al usuario
  const { data: doc } = await supabaseAdmin
    .from("firma_documentos")
    .select("*")
    .eq("id", id)
    .eq("usuario_email", email)
    .single();

  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });

  if (req.method === "GET") {
    // Sincronizar estado con DocuSeal si hay submission_id
    if (doc.docuseal_submission_id) {
      try {
        const submission = await getSubmission(doc.docuseal_submission_id);
        if (submission.status === "completed" && doc.estado !== "firmado") {
          await supabaseAdmin
            .from("firma_documentos")
            .update({ estado: "firmado", signed_at: new Date().toISOString() })
            .eq("id", id);
          doc.estado = "firmado";
        }
      } catch {
        // Ignorar errores de sync
      }
    }
    return res.json(doc);
  }

  if (req.method === "POST") {
    const { action } = req.body;

    if (action === "reenviar") {
      // Reenviar email de firma
      if (!doc.docuseal_submission_id) {
        return res.status(400).json({ error: "Este documento no tiene integración DocuSeal activa" });
      }
      try {
        const submission = await getSubmission(doc.docuseal_submission_id);
        const submitter = submission.submitters?.[0];
        if (submitter?.id) {
          await resendSubmitterEmail(submitter.id);
        }
        return res.json({ ok: true, mensaje: "Email de firma reenviado" });
      } catch (err) {
        return res.status(500).json({ error: "Error al reenviar email" });
      }
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
