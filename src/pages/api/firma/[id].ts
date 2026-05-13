// pages/api/firma/[id].ts — Detalle completo de un documento

import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getEffectiveEmail } from "../../../lib/impersonation";
import { enviarEmailFirma, getAgencyName } from "../../../lib/firmaEmail";

export const config = { api: { bodyParser: { sizeLimit: "12mb" } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const email = getEffectiveEmail(req, session);
  if (!email) return res.status(401).json({ error: "No autenticado" });
  const { id } = req.query as { id: string };

  // Buscar el documento — puede ser propio o de un miembro del equipo (para brokers)
  let doc = null;
  
  // Primero intentar como propio
  const { data: docPropio } = await supabaseAdmin
    .from("firma_documentos")
    .select(`*, firma_plantillas(nombre, pdf_url)`)
    .eq("id", id)
    .eq("usuario_email", email)
    .single();

  if (docPropio) {
    doc = docPropio;
  } else {
    // Verificar si el usuario es broker/team_leader y el doc es de su equipo
    const { data: callerSub } = await supabaseAdmin
      .from("subscriptions")
      .select("team_id, team_role")
      .eq("email", email)
      .single();

    const esBroker = callerSub?.team_role === "owner" || callerSub?.team_role === "team_leader";

    if (esBroker && callerSub?.team_id) {
      // Buscar el documento sin filtro de email
      const { data: docEquipo } = await supabaseAdmin
        .from("firma_documentos")
        .select(`*, firma_plantillas(nombre, pdf_url)`)
        .eq("id", id)
        .single();

      if (docEquipo) {
        // Verificar que el dueño del doc pertenece al mismo equipo
        const { data: ownerSub } = await supabaseAdmin
          .from("subscriptions")
          .select("team_id")
          .eq("email", docEquipo.usuario_email)
          .single();

        if (ownerSub?.team_id === callerSub.team_id) {
          doc = docEquipo;
        }
      }
    }
  }

  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });

  // GET — detalle completo con firmantes
  if (req.method === "GET") {
    const { data: firmantes } = await supabaseAdmin
      .from("firma_firmantes")
      .select("*")
      .eq("documento_id", id)
      .order("orden");

    // URL del PDF original
    const { data: pdfSigned } = await supabaseAdmin.storage
      .from("firma-docs")
      .createSignedUrl(`${id}/documento_original.pdf`, 60 * 60 * 2);

    // URLs de imágenes de cada firmante (signed URLs)
    const firmantesConUrls = await Promise.all((firmantes || []).map(async (f) => {
      const getUrl = async (path: string | null) => {
        if (!path) return null;
        // Si ya es una URL firmada, devolverla tal cual
        if (path.startsWith("http")) return path;
        const { data } = await supabaseAdmin.storage.from("firma-docs").createSignedUrl(path, 60 * 60 * 2);
        return data?.signedUrl || null;
      };
      return {
        ...f,
        firma_imagen_url: f.firma_imagen_url,
        dni_frente_url: f.dni_frente_url,
        dni_dorso_url: f.dni_dorso_url,
        selfie_url: f.selfie_url,
      };
    }));

    return res.json({
      ...doc,
      firma_firmantes: firmantesConUrls,
      pdf_original_url: pdfSigned?.signedUrl || (doc.firma_plantillas as { pdf_url?: string } | null)?.pdf_url || null,
    });
  }

  // PATCH — editar firmante o reemplazar PDF
  if (req.method === "PATCH") {
    const { firmante_nombre, firmante_email, firmante_telefono, pdf_base64 } = req.body;

    // Reemplazar PDF
    if (pdf_base64) {
      if (doc.estado === "firmado") return res.status(400).json({ error: "No se puede reemplazar el PDF de un documento ya firmado" });

      // Verificar que ningún firmante haya firmado aún
      const { count } = await supabaseAdmin
        .from("firma_firmantes")
        .select("id", { count: "exact", head: true })
        .eq("documento_id", id)
        .eq("estado", "firmado");

      if ((count || 0) > 0) {
        return res.status(400).json({ error: "No se puede reemplazar el PDF: al menos un firmante ya firmó el documento" });
      }
      const base64Clean = pdf_base64.replace(/^data:application\/pdf;base64,/, "");
      if (!base64Clean.startsWith("JVBER")) return res.status(400).json({ error: "Archivo inválido" });
      const buffer = Buffer.from(base64Clean, "base64");
      await supabaseAdmin.storage.from("firma-docs")
        .upload(`${id}/documento_original.pdf`, buffer, { contentType: "application/pdf", upsert: true });
      return res.json({ ok: true, mensaje: "PDF reemplazado" });
    }

    // Editar firmante individual
    if (firmante_nombre || firmante_email) {
      if (doc.estado !== "pendiente") return res.status(400).json({ error: "Solo se pueden editar documentos pendientes" });
      if (!firmante_nombre || !firmante_email) return res.status(400).json({ error: "Nombre y email son obligatorios" });
      const { data: updated, error } = await supabaseAdmin
        .from("firma_documentos")
        .update({ firmante_nombre, firmante_email, firmante_telefono: firmante_telefono || null })
        .eq("id", id).select("*").single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true, doc: updated });
    }

    return res.status(400).json({ error: "Nada que actualizar" });
  }

  // DELETE — eliminar documento (solo pendientes o cancelados)
  if (req.method === "DELETE") {
    if (doc.estado === "firmado") {
      return res.status(400).json({ error: "No se puede eliminar un documento firmado. Tiene validez legal." });
    }
    // Eliminar archivos del storage
    const paths = [
      `${id}/documento_original.pdf`,
      `${id}/documento_firmado_final.pdf`,
    ];
    await supabaseAdmin.storage.from("firma-docs").remove(paths);

    // Eliminar firmantes
    await supabaseAdmin.from("firma_firmantes").delete().eq("documento_id", id);

    // Eliminar documento
    await supabaseAdmin.from("firma_documentos").delete().eq("id", id);

    return res.json({ ok: true });
  }

  // POST — acciones
  if (req.method === "POST") {
    const { action } = req.body;

    if (action === "reenviar") {
      const agencyName = await getAgencyName(email);
      const nombreDoc = (doc.datos_json as Record<string, string>)?.nombre_documento
        || (doc.firma_plantillas as { nombre?: string } | null)?.nombre || "Documento";

      const { data: firmantes } = await supabaseAdmin
        .from("firma_firmantes").select("*").eq("documento_id", id).eq("estado", "pendiente");

      if (firmantes && firmantes.length > 0) {
        // Reenviar a todos los pendientes
        const total = await supabaseAdmin.from("firma_firmantes").select("id", { count: "exact", head: true }).eq("documento_id", id);
        for (const f of firmantes) {
          await enviarEmailFirma({
            firmante_nombre: f.nombre,
            firmante_email: f.email,
            firma_token: f.firma_token,
            nombre_documento: nombreDoc,
            agency_name: agencyName,
            rol_firmante: f.rol,
            total_firmantes: total.count || 1,
          }).catch(console.error);
          await supabaseAdmin.from("firma_firmantes")
            .update({ email_enviado_at: new Date().toISOString(), recordatorio_count: (f.recordatorio_count || 0) + 1 })
            .eq("id", f.id);
        }
        return res.json({ ok: true, reenviados: firmantes.length });
      }

      // Legacy: firmante único
      if (doc.firmante_email) {
        await enviarEmailFirma({
          firmante_nombre: doc.firmante_nombre || "Cliente",
          firmante_email: doc.firmante_email,
          firma_token: doc.firma_token,
          nombre_documento: nombreDoc,
          agency_name: agencyName,
        });
        return res.json({ ok: true, reenviados: 1 });
      }
      return res.status(400).json({ error: "Sin firmantes pendientes" });
    }

    if (action === "cancelar") {
      await supabaseAdmin.from("firma_documentos").update({ estado: "cancelado" }).eq("id", id);
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: "Acción no reconocida" });
  }

  return res.status(405).json({ error: "Método no permitido" });
}
