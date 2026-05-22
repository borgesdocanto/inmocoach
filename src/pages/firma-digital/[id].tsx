// pages/firma-digital/[id].tsx — Página de detalle de un documento de firma

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Head from "next/head";
import AppLayout from "../../components/AppLayout";
import {
  ArrowLeft, FileText, Download, Send, Trash2, Upload,
  CheckCircle2, Clock, XCircle, ZoomIn, X, RefreshCw,
  AlertCircle, Eye, FileSignature
} from "lucide-react";

const RED = "#aa0000";

interface Firmante {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  rol: string;
  orden: number;
  estado: "pendiente" | "firmado" | "rechazado";
  firma_token: string;
  signed_at: string | null;
  ip_firmante: string | null;
  user_agent_firmante: string | null;
  firma_imagen_url: string | null;
  dni_frente_url: string | null;
  dni_dorso_url: string | null;
  selfie_url: string | null;
  email_enviado_at: string | null;
  recordatorio_count: number;
}

interface DocDetalle {
  id: string;
  firma_token: string;
  estado: string;
  datos_json: Record<string, string>;
  created_at: string;
  signed_at: string | null;
  expires_at: string;
  url_documento_firmado: string | null;
  pdf_original_url: string | null;
  firma_firmantes: Firmante[];
  firma_plantillas: { nombre?: string; pdf_url?: string } | null;
  firmante_nombre: string | null;
  firmante_email: string | null;
}

// ─── Visor de imagen ampliada ──────────────────────────────────────────────────
function LightboxImagen({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.92)",
      zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center"
    }} onClick={onClose}>
      <button onClick={onClose} style={{
        position: "absolute", top: 20, right: 20,
        background: "rgba(255,255,255,.15)", border: "none", borderRadius: 50,
        width: 40, height: 40, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
      }}>
        <X size={20} color="#fff" />
      </button>
      <img
        src={url}
        alt="Imagen ampliada"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: "92vw", maxHeight: "88vh", objectFit: "contain", borderRadius: 8 }}
      />
    </div>
  );
}

// ─── Thumbnail de imagen con zoom ─────────────────────────────────────────────
function Thumbnail({ url, label }: { url: string | null; label: string }) {
  const [lightbox, setLightbox] = useState(false);
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: .5, marginBottom: 6 }}>
        {label}
      </div>
      {url ? (
        <>
          <div
            onClick={() => setLightbox(true)}
            style={{
              width: "100%", aspectRatio: "4/3", background: "#f3f4f6",
              borderRadius: 10, overflow: "hidden", cursor: "zoom-in",
              border: "1.5px solid #e5e7eb", position: "relative"
            }}
          >
            <img src={url} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{
              position: "absolute", inset: 0, background: "rgba(0,0,0,0)",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background .2s"
            }}
              onMouseOver={e => (e.currentTarget.style.background = "rgba(0,0,0,.3)")}
              onMouseOut={e => (e.currentTarget.style.background = "rgba(0,0,0,0)")}
            >
              <ZoomIn size={22} color="#fff" style={{ opacity: 0.9 }} />
            </div>
          </div>
          {lightbox && <LightboxImagen url={url} onClose={() => setLightbox(false)} />}
        </>
      ) : (
        <div style={{
          width: "100%", aspectRatio: "4/3", background: "#f8fafc",
          borderRadius: 10, border: "1.5px dashed #e5e7eb",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <span style={{ fontSize: 11, color: "#d1d5db" }}>Sin imagen</span>
        </div>
      )}
    </div>
  );
}

// ─── Card de firmante ──────────────────────────────────────────────────────────
function CardFirmante({
  firmante, docId, nombreDoc, agencyName, onReenviar
}: {
  firmante: Firmante;
  docId: string;
  nombreDoc: string;
  agencyName: string;
  onReenviar: () => void;
}) {
  const [reenviando, setReenviando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [editando, setEditando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState(firmante.nombre);
  const [nuevoEmail, setNuevoEmail] = useState(firmante.email);
  const [guardando, setGuardando] = useState(false);
  const [msgLocal, setMsgLocal] = useState("");

  const handleReenviar = async () => {
    setReenviando(true);
    await fetch("/api/firma/reenviar-firmante", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firmante_id: firmante.id, documento_id: docId }),
    });
    setReenviando(false);
    setMsgLocal("✅ Email reenviado");
    setTimeout(() => setMsgLocal(""), 3000);
    onReenviar();
  };

  const handleGuardarYReenviar = async () => {
    if (!nuevoNombre.trim() || !nuevoEmail.trim()) { alert("Nombre y email son obligatorios"); return; }
    setGuardando(true);

    // 1. Actualizar en Supabase
    const res = await fetch(`/api/firma/editar-firmante`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firmante_id: firmante.id,
        documento_id: docId,
        nombre: nuevoNombre.trim(),
        email: nuevoEmail.trim(),
      }),
    });

    if (!res.ok) {
      const j = await res.json();
      alert(j.error || "Error al guardar");
      setGuardando(false);
      return;
    }

    // 2. Reenviar email al nuevo email
    await fetch("/api/firma/reenviar-firmante", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firmante_id: firmante.id, documento_id: docId }),
    });

    setEditando(false);
    setGuardando(false);
    setMsgLocal("✅ Datos actualizados y email reenviado");
    setTimeout(() => setMsgLocal(""), 4000);
    onReenviar(); // recargar
  };

  const copiarLink = () => {
    const url = `https://www.inmocoach.com.ar/firmar/${firmante.firma_token}`;
    navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const firmado = firmante.estado === "firmado";
  const inputStyle: React.CSSProperties = {
    border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "7px 11px",
    fontSize: 13, outline: "none", fontFamily: "inherit", color: "#111",
    background: "#fff", width: "100%", boxSizing: "border-box"
  };

  return (
    <div style={{
      border: `2px solid ${firmado ? "#6ee7b7" : "#fdba74"}`,
      borderRadius: 14, overflow: "hidden",
      background: firmado ? "#f0fdf4" : "#fffbeb"
    }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            {firmado
              ? <CheckCircle2 size={18} color="#10b981" />
              : <Clock size={18} color="#f59e0b" />}
            <span style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>{firmante.nombre}</span>
            {firmante.rol !== "Firmante" && (
              <span style={{ fontSize: 10, background: firmado ? "#d1fae5" : "#fef3c7", color: firmado ? "#065f46" : "#92400e", padding: "2px 8px", borderRadius: 999, fontWeight: 700 }}>
                {firmante.rol}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>{firmante.email}</div>
          {firmante.telefono && <div style={{ fontSize: 11, color: "#9ca3af" }}>{firmante.telefono}</div>}

          {firmado && firmante.signed_at && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#065f46", fontWeight: 600 }}>
              ✅ Firmó el {new Date(firmante.signed_at).toLocaleString("es-AR", {
                day: "2-digit", month: "2-digit", year: "numeric",
                hour: "2-digit", minute: "2-digit"
              })}
            </div>
          )}
          {!firmado && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#92400e" }}>
              ⏳ Pendiente de firma
              {firmante.email_enviado_at && (
                <span style={{ color: "#9ca3af", marginLeft: 8 }}>
                  · Email enviado {new Date(firmante.email_enviado_at).toLocaleDateString("es-AR")}
                  {firmante.recordatorio_count > 0 && ` (${firmante.recordatorio_count} recordatorio${firmante.recordatorio_count > 1 ? "s" : ""})`}
                </span>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {!firmado && (
            <button onClick={() => setEditando(e => !e)} style={{
              background: editando ? "#f3f4f6" : "none",
              border: "1.5px solid #e5e7eb", color: "#374151",
              borderRadius: 8, padding: "7px 10px",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4
            }}>
              ✏️
            </button>
          )}
          {!firmado && (
            <button onClick={handleReenviar} disabled={reenviando} style={{
              background: reenviando ? "#9ca3af" : RED, color: "#fff",
              border: "none", borderRadius: 8, padding: "7px 12px",
              fontSize: 12, fontWeight: 700, cursor: reenviando ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 5
            }}>
              <Send size={12} /> {reenviando ? "..." : "Reenviar"}
            </button>
          )}
          <button onClick={copiarLink} style={{
            background: copiado ? "#065f46" : "#f3f4f6", color: copiado ? "#fff" : "#374151",
            border: "none", borderRadius: 8, padding: "7px 12px",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5, transition: "all .2s"
          }}>
            🔗 {copiado ? "Copiado" : "Link"}
          </button>
        </div>
      </div>

      {/* Mensaje local */}
      {msgLocal && (
        <div style={{ padding: "8px 20px", background: "#d1fae5", color: "#065f46", fontSize: 12, fontWeight: 600 }}>
          {msgLocal}
        </div>
      )}

      {/* Formulario de edición inline — solo para pendientes */}
      {!firmado && editando && (
        <div style={{ padding: "14px 20px", borderTop: "1px solid #fde68a", background: "#fffbeb" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 12 }}>
            ✏️ Corregir datos del firmante
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 3 }}>Nombre y apellido</label>
              <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 3 }}>Email</label>
              <input type="email" value={nuevoEmail} onChange={e => setNuevoEmail(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setEditando(false)} style={{
              background: "#f3f4f6", border: "none", borderRadius: 8,
              padding: "8px 14px", fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer"
            }}>
              Cancelar
            </button>
            <button onClick={handleGuardarYReenviar} disabled={guardando} style={{
              background: guardando ? "#9ca3af" : RED, color: "#fff",
              border: "none", borderRadius: 8, padding: "8px 16px",
              fontSize: 12, fontWeight: 700, cursor: guardando ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 5
            }}>
              <Send size={12} /> {guardando ? "Guardando..." : "Guardar y reenviar email"}
            </button>
          </div>
        </div>
      )}

      {/* Tracking info */}
      {firmado && (firmante.ip_firmante || firmante.user_agent_firmante) && (
        <div style={{ padding: "8px 20px", background: "rgba(0,0,0,.03)", borderTop: "1px solid rgba(0,0,0,.06)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {firmante.ip_firmante && (
              <div style={{ fontSize: 11, color: "#6b7280" }}>
                <span style={{ color: "#9ca3af" }}>IP: </span>{firmante.ip_firmante}
              </div>
            )}
            {firmante.user_agent_firmante && (
              <div style={{ fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }}>
                <span style={{ color: "#9ca3af" }}>Dispositivo: </span>
                {firmante.user_agent_firmante.replace(/\(.*?\)/g, "").trim().slice(0, 60)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hash */}
      <div style={{ padding: "8px 20px", background: "rgba(0,0,0,.02)", borderTop: "1px solid rgba(0,0,0,.05)" }}>
        <div style={{ fontSize: 9, color: "#9ca3af", textTransform: "uppercase", letterSpacing: .5, marginBottom: 3 }}>Hash de firma</div>
        <div style={{ fontSize: 10, fontFamily: "monospace", color: "#374151", wordBreak: "break-all" }}>
          {firmante.firma_token}
        </div>
      </div>

      {/* Imágenes — solo si firmó */}
      {firmado && (firmante.firma_imagen_url || firmante.dni_frente_url || firmante.selfie_url) && (
        <div style={{ padding: "16px 20px", borderTop: "1px solid #d1fae5" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#065f46", marginBottom: 12, textTransform: "uppercase", letterSpacing: .5 }}>
            Verificación de identidad
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
            <Thumbnail url={firmante.firma_imagen_url} label="Firma" />
            <Thumbnail url={firmante.dni_frente_url} label="DNI frente" />
            <Thumbnail url={firmante.dni_dorso_url} label="DNI dorso" />
            <Thumbnail url={firmante.selfie_url} label="Selfie" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────
export default function DetalleDocumento() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = router.query as { id: string };

  const [doc, setDoc] = useState<DocDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [eliminando, setEliminando] = useState(false);
  const [reemplazando, setReemplazando] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [agregandoFirmante, setAgregandoFirmante] = useState(false);
  const [nuevoFirmante, setNuevoFirmante] = useState({ nombre: "", email: "", telefono: "", rol: "Firmante" });
  const [guardandoFirmante, setGuardandoFirmante] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const mostrarMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 4000); };

  const cargar = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/firma/${id}`);
    if (!res.ok) { setError("Documento no encontrado"); setLoading(false); return; }
    setDoc(await res.json());
    setLoading(false);
  }, [id]);

  useEffect(() => { if (status === "authenticated" && id) cargar(); }, [status, id, cargar]);

  const nombreDoc = doc?.datos_json?.nombre_documento || doc?.firma_plantillas?.nombre || "Documento";
  const firmantes = doc?.firma_firmantes || [];
  const firmados = firmantes.filter(f => f.estado === "firmado").length;
  const pendientes = firmantes.filter(f => f.estado !== "firmado");
  const todos_firmaron = firmantes.length > 0 && firmados === firmantes.length;

  const handleAgregarFirmante = async () => {
    if (!nuevoFirmante.nombre.trim() || !nuevoFirmante.email.trim()) {
      alert("Nombre y email son obligatorios"); return;
    }
    setGuardandoFirmante(true);
    const res = await fetch("/api/firma/agregar-firmante", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documento_id: id,
        nombre: nuevoFirmante.nombre.trim(),
        email: nuevoFirmante.email.trim(),
        telefono: nuevoFirmante.telefono.trim() || null,
        rol: nuevoFirmante.rol,
      }),
    });
    if (res.ok) {
      setAgregandoFirmante(false);
      setNuevoFirmante({ nombre: "", email: "", telefono: "", rol: "Firmante" });
      await cargar();
      mostrarMsg(`✅ ${nuevoFirmante.nombre} agregado y email enviado`);
    } else {
      const j = await res.json();
      alert(j.error || "Error al agregar firmante");
    }
    setGuardandoFirmante(false);
  };

  const handleEliminar = async () => {
    if (!doc) return;
    if (!confirm(`¿Eliminar el documento "${nombreDoc}"? Esta acción no se puede deshacer.`)) return;
    setEliminando(true);
    const res = await fetch(`/api/firma/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/firma-digital");
    } else {
      const j = await res.json();
      alert(j.error || "Error al eliminar");
    }
    setEliminando(false);
  };

  const handleReemplazarPdf = async (file: File) => {
    if (file.type !== "application/pdf") { alert("Solo se aceptan PDFs"); return; }
    if (file.size > 10 * 1024 * 1024) { alert("El PDF no puede superar 10 MB"); return; }
    setReemplazando(true);
    const reader = new FileReader();
    reader.onload = async e => {
      const base64 = e.target?.result as string;
      const res = await fetch(`/api/firma/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf_base64: base64 }),
      });
      if (res.ok) {
        mostrarMsg("✅ PDF reemplazado. Reenviá el link a los firmantes.");
        await cargar();
      } else {
        const j = await res.json();
        alert(j.error || "Error");
      }
      setReemplazando(false);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerarPdf = async () => {
    setGenerando(true);
    const res = await fetch("/api/firma/generar-pdf-final", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documento_id: id }),
    });
    const j = await res.json();
    if (res.ok && j.pdf_url) {
      await cargar();
      mostrarMsg("✅ PDF generado");
    } else {
      alert(j.error || "Error al generar PDF");
    }
    setGenerando(false);
  };

  const estadoColor = {
    pendiente: { bg: "#ffedd5", color: "#9a3412", border: "#fdba74", label: "Pendiente" },
    firmado:   { bg: "#d1fae5", color: "#065f46", border: "#6ee7b7", label: "Completado" },
    cancelado: { bg: "#f3f4f6", color: "#374151", border: "#e5e7eb", label: "Cancelado" },
    vencido:   { bg: "#fee2e2", color: "#991b1b", border: "#fca5a5", label: "Vencido" },
  }[doc?.estado || "pendiente"] || { bg: "#f3f4f6", color: "#374151", border: "#e5e7eb", label: doc?.estado || "" };

  if (status === "loading" || loading) {
    return (
      <AppLayout>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
          <div style={{ fontSize: 13, color: "#9ca3af" }}>Cargando documento...</div>
        </div>
      </AppLayout>
    );
  }

  if (error || !doc) {
    return (
      <AppLayout>
        <div style={{ maxWidth: 500, margin: "60px auto", textAlign: "center", padding: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>Documento no encontrado</div>
          <button onClick={() => router.push("/firma-digital")} style={{
            marginTop: 20, background: RED, color: "#fff", border: "none",
            borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer"
          }}>← Volver</button>
        </div>
      </AppLayout>
    );
  }

  return (
    <>
      <Head><title>{nombreDoc} · Firma Digital</title></Head>
      <AppLayout>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px 48px" }}>

          {/* Breadcrumb */}
          <button onClick={() => router.push("/firma-digital")} style={{
            background: "none", border: "none", color: "#6b7280", fontSize: 13,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            padding: 0, marginBottom: 20, fontWeight: 500
          }}>
            <ArrowLeft size={15} /> Firma Digital
          </button>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ width: 36, height: 36, background: RED, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <FileSignature size={18} color="#fff" />
                </div>
                <h1 style={{ fontSize: 18, fontWeight: 800, color: "#111", margin: 0, lineHeight: 1.3 }}>{nombreDoc}</h1>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 46 }}>
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
                  background: estadoColor.bg, color: estadoColor.color, border: `1px solid ${estadoColor.border}`
                }}>
                  {todos_firmaron ? `Completado · ${firmados}/${firmantes.length} firmaron` : estadoColor.label}
                  {firmantes.length > 0 && !todos_firmaron && ` · ${firmados}/${firmantes.length} firmaron`}
                </span>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>
                  Enviado {new Date(doc.created_at).toLocaleDateString("es-AR")} · Vence {new Date(doc.expires_at).toLocaleDateString("es-AR")}
                </span>
              </div>
            </div>

            {/* Acciones rápidas */}
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              {doc.estado !== "firmado" && doc.estado !== "cancelado" && (
                <button onClick={handleEliminar} disabled={eliminando} style={{
                  background: "none", border: "1.5px solid #fca5a5", color: "#ef4444",
                  borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 700,
                  cursor: eliminando ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: 5
                }}>
                  <Trash2 size={13} /> {eliminando ? "Eliminando..." : "Eliminar"}
                </button>
              )}
            </div>
          </div>

          {/* Mensaje de estado */}
          {msg && (
            <div style={{ background: "#d1fae5", color: "#065f46", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
              {msg}
            </div>
          )}

          {/* ── Documento PDF ───────────────────────────────────────────────── */}
          <div style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: .5 }}>
                Documento
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {doc.pdf_original_url && (
                  <a href={doc.pdf_original_url} target="_blank" rel="noopener noreferrer" style={{
                    display: "flex", alignItems: "center", gap: 5,
                    background: "#f3f4f6", color: "#374151", borderRadius: 8,
                    padding: "6px 12px", fontSize: 12, fontWeight: 600, textDecoration: "none"
                  }}>
                    <Eye size={13} /> Ver PDF
                  </a>
                )}
                {doc.url_documento_firmado ? (
                  <a href={doc.url_documento_firmado} target="_blank" rel="noopener noreferrer" style={{
                    display: "flex", alignItems: "center", gap: 5,
                    background: "#065f46", color: "#fff", borderRadius: 8,
                    padding: "6px 12px", fontSize: 12, fontWeight: 700, textDecoration: "none"
                  }}>
                    <Download size={13} /> Descargar firmado
                  </a>
                ) : todos_firmaron ? (
                  <button onClick={handleGenerarPdf} disabled={generando} style={{
                    background: generando ? "#9ca3af" : RED, color: "#fff",
                    border: "none", borderRadius: 8, padding: "6px 12px",
                    fontSize: 12, fontWeight: 700, cursor: generando ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", gap: 5
                  }}>
                    <Download size={13} /> {generando ? "Generando..." : "Generar PDF firmado"}
                  </button>
                ) : null}
              </div>
            </div>

            {/* Visor PDF embebido */}
            {doc.pdf_original_url ? (
              <div>
                <div style={{ background: "#1e293b", padding: "6px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>📄 {nombreDoc}</span>
                  <a href={doc.pdf_original_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#60a5fa", textDecoration: "none" }}>
                    Abrir en nueva pestaña ↗
                  </a>
                </div>
                <iframe
                  src={`${doc.pdf_original_url}#toolbar=0&navpanes=0`}
                  style={{ width: "100%", height: 500, border: "none", display: "block" }}
                  title="Documento"
                />
              </div>
            ) : (
              <div style={{ padding: 24, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                <FileText size={28} color="#d1d5db" style={{ marginBottom: 8 }} />
                <div>Sin PDF adjunto</div>
              </div>
            )}

            {/* Reemplazar PDF (solo si ninguno firmó todavía) */}
            {doc.estado === "pendiente" && firmados === 0 && (
              <div style={{ padding: "14px 20px", borderTop: "1px solid #f3f4f6", background: "#fafafa" }}>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10 }}>
                  ⚠ ¿Necesitás corregir el documento? Subí el PDF actualizado. Los firmantes recibirán la nueva versión la próxima vez que abran su link.
                </div>
                <input ref={fileRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={e => e.target.files?.[0] && handleReemplazarPdf(e.target.files[0])} />
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={e => { e.preventDefault(); setDragging(false); e.dataTransfer.files?.[0] && handleReemplazarPdf(e.dataTransfer.files[0]); }}
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragging ? RED : "#d1d5db"}`,
                    borderRadius: 10, padding: "12px 16px", textAlign: "center",
                    cursor: "pointer", background: dragging ? "#fff8f8" : "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all .2s"
                  }}
                >
                  <Upload size={16} color={dragging ? RED : "#9ca3af"} />
                  <span style={{ fontSize: 12, color: dragging ? RED : "#6b7280", fontWeight: 600 }}>
                    {reemplazando ? "Subiendo..." : "Reemplazar PDF · Arrastrá o hacé clic"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Firmantes ───────────────────────────────────────────────────── */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: .5 }}>
                Firmantes ({firmados}/{firmantes.length || 1} firmaron)
              </div>
              {doc.estado === "pendiente" && !todos_firmaron && (
                <button onClick={() => setAgregandoFirmante(v => !v)} style={{
                  background: agregandoFirmante ? "#f3f4f6" : "none",
                  border: `1.5px solid ${agregandoFirmante ? "#e5e7eb" : RED}`,
                  color: agregandoFirmante ? "#374151" : RED,
                  borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 5
                }}>
                  {agregandoFirmante ? "✕ Cancelar" : "+ Agregar firmante"}
                </button>
              )}
            </div>

            {agregandoFirmante && (
              <div style={{ background: "#fff8f8", border: "1.5px solid #fecdd3", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: RED, marginBottom: 12 }}>Nuevo firmante</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 3 }}>Nombre y apellido *</label>
                    <input value={nuevoFirmante.nombre} onChange={e => setNuevoFirmante(f => ({ ...f, nombre: e.target.value }))}
                      placeholder="Juan García"
                      style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "8px 11px", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 3 }}>Rol</label>
                    <select value={nuevoFirmante.rol} onChange={e => setNuevoFirmante(f => ({ ...f, rol: e.target.value }))}
                      style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "8px 11px", fontSize: 13, outline: "none", fontFamily: "inherit", background: "#fff", boxSizing: "border-box" }}>
                      {["Firmante","Vendedor","Comprador","Locador","Locatario","Garante","Testigo"].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 3 }}>Email *</label>
                    <input type="email" value={nuevoFirmante.email} onChange={e => setNuevoFirmante(f => ({ ...f, email: e.target.value }))}
                      placeholder="juan@gmail.com"
                      style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "8px 11px", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 3 }}>Teléfono</label>
                    <input value={nuevoFirmante.telefono} onChange={e => setNuevoFirmante(f => ({ ...f, telefono: e.target.value }))}
                      placeholder="+54 11..."
                      style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "8px 11px", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                  </div>
                </div>
                <button onClick={handleAgregarFirmante} disabled={guardandoFirmante} style={{
                  background: guardandoFirmante ? "#9ca3af" : RED, color: "#fff",
                  border: "none", borderRadius: 8, padding: "9px 18px",
                  fontSize: 13, fontWeight: 700, cursor: guardandoFirmante ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: 6
                }}>
                  <Send size={13} /> {guardandoFirmante ? "Agregando..." : "Agregar y enviar email"}
                </button>
              </div>
            )}

            {firmantes.length > 0 ? (
              <div style={{ display: "grid", gap: 16 }}>
                {firmantes.map(f => (
                  <CardFirmante
                    key={f.id}
                    firmante={f}
                    docId={id}
                    nombreDoc={nombreDoc}
                    agencyName=""
                    onReenviar={() => { mostrarMsg(`✅ Email reenviado a ${f.nombre}`); cargar(); }}
                  />
                ))}
              </div>
            ) : (
              // Legacy: firmante único
              <div style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 12, padding: "16px 20px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{doc.firmante_nombre}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{doc.firmante_email}</div>
                {doc.estado === "pendiente" && (
                  <button onClick={async () => {
                    await fetch(`/api/firma/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reenviar" }) });
                    mostrarMsg("✅ Email reenviado");
                  }} style={{
                    marginTop: 10, background: RED, color: "#fff", border: "none",
                    borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 5
                  }}>
                    <Send size={12} /> Reenviar email
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Datos del formulario ─────────────────────────────────────────── */}
          {Object.keys(doc.datos_json || {}).filter(k => k !== "nombre_documento").length > 0 && (
            <div style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: .5 }}>
                  Datos del documento
                </div>
              </div>
              <div style={{ padding: "4px 0" }}>
                {Object.entries(doc.datos_json).filter(([k]) => k !== "nombre_documento").map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "10px 20px", borderBottom: "1px solid #f9fafb" }}>
                    <span style={{ fontSize: 12, color: "#6b7280", textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#111", textAlign: "right" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Zona de peligro ──────────────────────────────────────────────── */}
          {doc.estado !== "firmado" && (
            <div style={{ border: "1.5px solid #fca5a5", borderRadius: 14, padding: "16px 20px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>
                Zona de peligro
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
                  Eliminar este documento es permanente. Los firmantes no podrán acceder al link.
                  {doc.estado === "pendiente" && " Podés subir un documento corregido después de eliminar este."}
                </div>
                <button onClick={handleEliminar} disabled={eliminando} style={{
                  background: eliminando ? "#9ca3af" : "#fee2e2", color: "#ef4444",
                  border: "1.5px solid #fca5a5", borderRadius: 10, padding: "10px 16px",
                  fontSize: 12, fontWeight: 700, cursor: eliminando ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
                  whiteSpace: "nowrap"
                }}>
                  <Trash2 size={13} /> {eliminando ? "Eliminando..." : "Eliminar documento"}
                </button>
              </div>
            </div>
          )}

        </div>
      </AppLayout>
    </>
  );
}
