// pages/api/cron/firma-cleanup.ts
// Elimina documentos de firma vencidos (pendientes o parcialmente firmados)
// Corre diariamente. Solo borra docs donde NINGÚN firmante firmó completamente.

import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const ahora = new Date().toISOString();

  // Buscar documentos vencidos que no están completamente firmados
  // Un documento está "completamente firmado" si estado = "firmado"
  const { data: vencidos, error } = await supabaseAdmin
    .from("firma_documentos")
    .select("id, datos_json, usuario_email, estado")
    .lt("expires_at", ahora)
    .in("estado", ["pendiente", "vencido"]); // nunca eliminar "firmado" o "cancelado"

  if (error) {
    console.error("firma-cleanup error:", error);
    return res.status(500).json({ error: error.message });
  }

  if (!vencidos || vencidos.length === 0) {
    return res.json({ eliminados: 0, mensaje: "Sin documentos vencidos" });
  }

  let eliminados = 0;
  const errores: string[] = [];

  for (const doc of vencidos) {
    try {
      // Verificar que realmente ningún firmante completó la firma
      const { count: firmadosCount } = await supabaseAdmin
        .from("firma_firmantes")
        .select("id", { count: "exact", head: true })
        .eq("documento_id", doc.id)
        .eq("estado", "firmado");

      if ((firmadosCount || 0) > 0) {
        // Hay firmantes que firmaron — marcar como vencido pero NO eliminar
        // (tienen evidencia legal de su firma)
        await supabaseAdmin
          .from("firma_documentos")
          .update({ estado: "vencido" })
          .eq("id", doc.id);
        continue;
      }

      // Ninguno firmó — eliminar todo
      const nombreDoc = (doc.datos_json as Record<string, string>)?.nombre_documento || doc.id;
      console.log(`Eliminando doc vencido: ${nombreDoc} (${doc.id}) de ${doc.usuario_email}`);

      // 1. Eliminar archivos del storage
      await supabaseAdmin.storage.from("firma-docs").remove([
        `${doc.id}/documento_original.pdf`,
        `${doc.id}/documento_firmado_final.pdf`,
      ]);

      // 2. Eliminar firmantes
      await supabaseAdmin.from("firma_firmantes").delete().eq("documento_id", doc.id);

      // 3. Eliminar documento
      await supabaseAdmin.from("firma_documentos").delete().eq("id", doc.id);

      eliminados++;
    } catch (err) {
      console.error(`Error eliminando doc ${doc.id}:`, err);
      errores.push(doc.id);
    }
  }

  console.log(`firma-cleanup: ${eliminados} eliminados, ${errores.length} errores`);
  return res.json({
    eliminados,
    errores: errores.length,
    total_vencidos: vencidos.length,
  });
}
