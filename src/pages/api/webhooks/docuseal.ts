// pages/api/webhooks/docuseal.ts — Webhook de DocuSeal para documentos firmados

import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import webpush from "web-push";

export const config = { api: { bodyParser: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  // DocuSeal envía un header de verificación opcional
  const secret = process.env.DOCUSEAL_WEBHOOK_SECRET;
  if (secret) {
    const sig = req.headers["x-docuseal-signature"] || req.headers["authorization"];
    if (sig !== secret) {
      console.warn("DocuSeal webhook: firma inválida");
      return res.status(401).json({ error: "Firma inválida" });
    }
  }

  const event = req.body;
  console.log("DocuSeal webhook event:", JSON.stringify(event).slice(0, 200));

  // Eventos que nos interesan:
  // submission.completed — todos los firmantes completaron
  // submitter.completed — un firmante individual completó
  if (event?.event_type === "submission.completed" || event?.data?.status === "completed") {
    const submissionId = event?.data?.id || event?.submission_id;
    if (!submissionId) return res.json({ ok: true });

    // Buscar el documento en Supabase
    const { data: doc } = await supabaseAdmin
      .from("firma_documentos")
      .select("id, usuario_email, firma_plantillas(nombre)")
      .eq("docuseal_submission_id", submissionId)
      .single();

    if (!doc) {
      console.log("DocuSeal webhook: submission no encontrada:", submissionId);
      return res.json({ ok: true });
    }

    // Obtener URL del documento firmado si viene en el webhook
    const documentUrl =
      event?.data?.documents?.[0]?.url ||
      event?.data?.submitters?.[0]?.completed_documents?.[0]?.url ||
      null;

    // Actualizar estado en Supabase
    await supabaseAdmin
      .from("firma_documentos")
      .update({
        estado: "firmado",
        signed_at: new Date().toISOString(),
        url_documento_firmado: documentUrl,
      })
      .eq("docuseal_submission_id", submissionId);

    // Enviar push notification al inmobiliario
    try {
      const plantillaNombre =
        (doc.firma_plantillas as unknown as { nombre: string } | null)?.nombre || "Documento";

      const { data: pushSubs } = await supabaseAdmin
        .from("push_subscriptions")
        .select("subscription_json")
        .eq("user_email", doc.usuario_email);

      if (pushSubs?.length) {
        const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
        const vapidPrivate = process.env.VAPID_PRIVATE_KEY || "";
        const vapidEmail = process.env.VAPID_EMAIL || "mailto:coach@inmocoach.com.ar";

        if (vapidPublic && vapidPrivate) {
          webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);

          const payload = JSON.stringify({
            title: "✅ Documento firmado",
            body: `${plantillaNombre} fue firmado exitosamente`,
            url: "/firma-digital",
          });

          for (const sub of pushSubs) {
            try {
              await webpush.sendNotification(
                JSON.parse(sub.subscription_json),
                payload
              );
            } catch {
              // Push expirada, ignorar
            }
          }
        }
      }
    } catch (err) {
      console.error("Push notification error:", err);
    }
  }

  return res.json({ ok: true });
}
