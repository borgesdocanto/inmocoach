// pages/api/firmar/[token]/pdf.ts — Devuelve URL firmada del PDF original (público, por token)

import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../../lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const { token } = req.query as { token: string };

  // Verificar que el token existe y el doc no está vencido
  const { data: doc } = await supabaseAdmin
    .from("firma_documentos")
    .select("id, estado, expires_at, plantilla_id, firma_plantillas(pdf_url)")
    .eq("firma_token", token)
    .single();

  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
  if (doc.estado === "vencido") return res.status(410).json({ error: "Link vencido" });

  // 1. Buscar PDF en Storage (documentos subidos libremente)
  const storagePath = `${doc.id}/documento_original.pdf`;
  const { data: signed } = await supabaseAdmin.storage
    .from("firma-docs")
    .createSignedUrl(storagePath, 60 * 60 * 2); // 2 horas

  if (signed?.signedUrl) {
    return res.json({ pdf_url: signed.signedUrl });
  }

  // 2. Buscar PDF en plantilla
  const plantilla = doc.firma_plantillas as unknown as { pdf_url?: string } | null;
  if (plantilla?.pdf_url) {
    return res.json({ pdf_url: plantilla.pdf_url });
  }

  return res.json({ pdf_url: null });
}
