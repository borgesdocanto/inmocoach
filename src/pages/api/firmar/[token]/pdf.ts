// pages/api/firmar/[token]/pdf.ts — PDF original por token de firmante O de documento

import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../../lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const { token } = req.query as { token: string };

  // 1. Buscar por token de FIRMANTE individual (caso nuevo)
  const { data: firmante } = await supabaseAdmin
    .from("firma_firmantes")
    .select("documento_id")
    .eq("firma_token", token)
    .single();

  let docId: string | null = null;

  if (firmante?.documento_id) {
    docId = firmante.documento_id;
  } else {
    // 2. Fallback: buscar por token de DOCUMENTO (legacy)
    const { data: doc } = await supabaseAdmin
      .from("firma_documentos")
      .select("id, estado, expires_at, plantilla_id, firma_plantillas(pdf_url)")
      .eq("firma_token", token)
      .single();

    if (doc) docId = doc.id;
  }

  if (!docId) return res.json({ pdf_url: null });

  // Obtener datos del documento
  const { data: doc } = await supabaseAdmin
    .from("firma_documentos")
    .select("id, estado, expires_at, plantilla_id, firma_plantillas(pdf_url)")
    .eq("id", docId)
    .single();

  if (!doc || doc.estado === "vencido") return res.json({ pdf_url: null });

  // Buscar PDF en Storage (documentos subidos libremente)
  const storagePath = `${docId}/documento_original.pdf`;
  const { data: signed } = await supabaseAdmin.storage
    .from("firma-docs")
    .createSignedUrl(storagePath, 60 * 60 * 2);

  if (signed?.signedUrl) return res.json({ pdf_url: signed.signedUrl });

  // Fallback: PDF de la plantilla
  const plantilla = doc.firma_plantillas as unknown as { pdf_url?: string } | null;
  if (plantilla?.pdf_url) return res.json({ pdf_url: plantilla.pdf_url });

  return res.json({ pdf_url: null });
}
