import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Head from "next/head";
import AppLayout from "../components/AppLayout";
import {
  FileSignature, Plus, Clock, CheckCircle2, XCircle, RefreshCw,
  ChevronRight, Send, X, AlertCircle, FileText, Phone, Mail,
  Settings, Globe, Building2, Pencil, Trash2, ExternalLink
} from "lucide-react";

const RED = "#aa0000";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface CampoPlantilla {
  nombre: string;
  etiqueta: string;
  tipo: "text" | "number" | "date" | "textarea" | "select";
  opciones?: string[];
  requerido: boolean;
}

interface Plantilla {
  id: string;
  nombre: string;
  descripcion: string;
  campos: CampoPlantilla[];
  docuseal_template_id: number | null;
  es_global: boolean;
  team_id: string | null;
}

interface Documento {
  id: string;
  plantilla_id: string;
  estado: "pendiente" | "firmado" | "vencido" | "cancelado";
  datos_json: Record<string, string>;
  firmante_nombre: string;
  firmante_email: string;
  firmante_telefono: string | null;
  created_at: string;
  signed_at: string | null;
  expires_at: string;
  firma_plantillas: { nombre: string; descripcion: string } | null;
  docuseal_submission_id: number | null;
  url_documento_firmado: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function estadoBadge(estado: Documento["estado"]) {
  const cfg: Record<string, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
    pendiente: { label: "Pendiente", color: "#92400e", bg: "#fef3c7", Icon: Clock },
    firmado:   { label: "Firmado",   color: "#065f46", bg: "#d1fae5", Icon: CheckCircle2 },
    vencido:   { label: "Vencido",   color: "#991b1b", bg: "#fee2e2", Icon: XCircle },
    cancelado: { label: "Cancelado", color: "#374151", bg: "#f3f4f6", Icon: XCircle },
  };
  const c = cfg[estado] || cfg.pendiente;
  const { Icon } = c;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: c.bg, color: c.color,
      fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 999
    }}>
      <Icon size={11} /> {c.label}
    </span>
  );
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function esPendienteMasDe48h(doc: Documento) {
  if (doc.estado !== "pendiente") return false;
  return Date.now() - new Date(doc.created_at).getTime() > 48 * 60 * 60 * 1000;
}

// ─── Modal genérico centrado ───────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.55)",
      zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
      padding: "16px"
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 16, padding: 24,
        width: "100%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,.25)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>{title}</div>
          <button onClick={onClose} style={{
            background: "#f3f4f6", border: "none", borderRadius: 8,
            width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <X size={16} color="#6b7280" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Selector de plantilla ─────────────────────────────────────────────────────

function SelectorPlantilla({ plantillas, onSelect }: { plantillas: Plantilla[]; onSelect: (p: Plantilla) => void }) {
  const globales = plantillas.filter(p => p.es_global);
  const propias = plantillas.filter(p => !p.es_global);

  const GrupoPlantillas = ({ lista, label }: { lista: Plantilla[]; label: string }) => (
    lista.length > 0 ? (
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
          {label}
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {lista.map(p => (
            <button key={p.id} onClick={() => onSelect(p)} style={{
              width: "100%", background: "#fff", border: "1.5px solid #e5e7eb",
              borderRadius: 12, padding: "13px 15px", textAlign: "left",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
              transition: "all .15s"
            }}
              onMouseOver={e => { e.currentTarget.style.borderColor = RED; e.currentTarget.style.background = "#fff8f8"; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.background = "#fff"; }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111", display: "flex", alignItems: "center", gap: 6 }}>
                  {p.nombre}
                  {p.es_global
                    ? <Globe size={11} color="#9ca3af" />
                    : <Building2 size={11} color="#0ea5e9" />}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{p.descripcion}</div>
              </div>
              <ChevronRight size={15} color="#9ca3af" />
            </button>
          ))}
        </div>
      </div>
    ) : null
  );

  if (plantillas.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "20px 0", color: "#6b7280", fontSize: 13 }}>
        No hay plantillas disponibles.<br />
        <span style={{ fontSize: 12 }}>Andá a "Plantillas" para agregar la tuya.</span>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#111", marginBottom: 16 }}>
        Elegí el tipo de documento
      </div>
      <GrupoPlantillas lista={propias} label="Mis plantillas" />
      <GrupoPlantillas lista={globales} label="Plantillas del sistema" />
    </div>
  );
}

// ─── Formulario de datos del documento ────────────────────────────────────────

function FormularioDatos({
  plantilla, onBack, onSubmit, loading
}: {
  plantilla: Plantilla;
  onBack: () => void;
  onSubmit: (datos: Record<string, string>, firmante: { nombre: string; email: string; telefono: string }) => void;
  loading: boolean;
}) {
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [firmante, setFirmante] = useState({ nombre: "", email: "", telefono: "" });

  const inputStyle: React.CSSProperties = {
    width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8,
    padding: "8px 12px", fontSize: 13, outline: "none", boxSizing: "border-box",
    fontFamily: "inherit", background: "#fff", color: "#111"
  };

  const handleSubmit = () => {
    for (const c of plantilla.campos) {
      if (c.requerido && !campos[c.nombre]) {
        alert(`El campo "${c.etiqueta}" es obligatorio`);
        return;
      }
    }
    if (!firmante.nombre || !firmante.email) {
      alert("Nombre y email del firmante son obligatorios");
      return;
    }
    onSubmit(campos, firmante);
  };

  return (
    <div>
      <button onClick={onBack} style={{
        background: "none", border: "none", color: RED, fontSize: 12,
        fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 16,
        display: "flex", alignItems: "center", gap: 4
      }}>
        ← Volver
      </button>

      <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 2 }}>{plantilla.nombre}</div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>{plantilla.descripcion}</div>

      {/* Datos del firmante */}
      <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 12, textTransform: "uppercase", letterSpacing: .5 }}>
          ¿Quién tiene que firmar?
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Nombre y apellido *</label>
            <input value={firmante.nombre} onChange={e => setFirmante(f => ({ ...f, nombre: e.target.value }))}
              style={inputStyle} placeholder="Juan García" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "flex", alignItems: "center", gap: 3, marginBottom: 4 }}>
                <Mail size={10} /> Email *
              </label>
              <input type="email" value={firmante.email} onChange={e => setFirmante(f => ({ ...f, email: e.target.value }))}
                style={inputStyle} placeholder="juan@gmail.com" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "flex", alignItems: "center", gap: 3, marginBottom: 4 }}>
                <Phone size={10} /> Teléfono
              </label>
              <input value={firmante.telefono} onChange={e => setFirmante(f => ({ ...f, telefono: e.target.value }))}
                style={inputStyle} placeholder="+54 11..." />
            </div>
          </div>
        </div>
      </div>

      {/* Campos del documento */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 12, textTransform: "uppercase", letterSpacing: .5 }}>
        Datos del documento
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {plantilla.campos.map(campo => (
          <div key={campo.nombre}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>
              {campo.etiqueta}{campo.requerido ? " *" : ""}
            </label>
            {campo.tipo === "textarea" ? (
              <textarea value={campos[campo.nombre] || ""} onChange={e => setCampos(p => ({ ...p, [campo.nombre]: e.target.value }))}
                style={{ ...inputStyle, height: 70, resize: "vertical" }} />
            ) : campo.tipo === "select" ? (
              <select value={campos[campo.nombre] || ""} onChange={e => setCampos(p => ({ ...p, [campo.nombre]: e.target.value }))}
                style={inputStyle}>
                <option value="">Seleccioná...</option>
                {campo.opciones?.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input type={campo.tipo} value={campos[campo.nombre] || ""}
                onChange={e => setCampos(p => ({ ...p, [campo.nombre]: e.target.value }))}
                style={inputStyle} />
            )}
          </div>
        ))}
      </div>

      <button onClick={handleSubmit} disabled={loading} style={{
        width: "100%", background: loading ? "#9ca3af" : RED, color: "#fff",
        border: "none", borderRadius: 10, padding: "12px 0", fontSize: 13,
        fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", marginTop: 22,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8
      }}>
        <Send size={14} /> {loading ? "Enviando..." : "Enviar para firma"}
      </button>
    </div>
  );
}

// ─── Fila de documento ─────────────────────────────────────────────────────────

function FilaDocumento({ doc, onVer }: { doc: Documento; onVer: () => void }) {
  const alertar = esPendienteMasDe48h(doc);
  return (
    <div onClick={onVer} style={{
      background: "#fff", border: `1.5px solid ${alertar ? "#fca5a5" : "#e5e7eb"}`,
      borderRadius: 12, padding: "14px 16px", cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 12, transition: "all .15s"
    }}
      onMouseOver={e => { e.currentTarget.style.borderColor = alertar ? "#ef4444" : "#d1d5db"; e.currentTarget.style.background = "#fafafa"; }}
      onMouseOut={e => { e.currentTarget.style.borderColor = alertar ? "#fca5a5" : "#e5e7eb"; e.currentTarget.style.background = "#fff"; }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
          <FileText size={13} color={RED} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {doc.firma_plantillas?.nombre || "Documento"}
          </span>
          {alertar && <span title="Pendiente más de 48hs" style={{ display: "inline-flex" }}><AlertCircle size={13} color="#ef4444" /></span>}
        </div>
        <div style={{ fontSize: 11, color: "#6b7280" }}>{doc.firmante_nombre} · {doc.firmante_email}</div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
          {formatFecha(doc.created_at)}
          {doc.signed_at ? ` · ✅ Firmado ${formatFecha(doc.signed_at)}` : ` · Vence ${formatFecha(doc.expires_at)}`}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
        {estadoBadge(doc.estado)}
      </div>
    </div>
  );
}

// ─── Modal detalle documento ───────────────────────────────────────────────────

function ModalDetalle({ doc, onClose, onReenviar }: { doc: Documento; onClose: () => void; onReenviar: () => void }) {
  const [reenviando, setReenviando] = useState(false);

  const handleReenviar = async () => {
    setReenviando(true);
    await onReenviar();
    setReenviando(false);
  };

  return (
    <Modal title={doc.firma_plantillas?.nombre || "Documento"} onClose={onClose}>
      <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
        {[
          ["Estado", estadoBadge(doc.estado)],
          ["Firmante", <span style={{ fontSize: 12, fontWeight: 500 }}>{doc.firmante_nombre}</span>],
          ["Email", doc.firmante_email],
          ...(doc.firmante_telefono ? [["Teléfono", doc.firmante_telefono]] : []),
          ["Enviado", formatFecha(doc.created_at)],
          ...(doc.signed_at ? [["Firmado ✅", <span style={{ fontWeight: 700, color: "#065f46" }}>{formatFecha(doc.signed_at)}</span>]] : []),
          ["Vence", formatFecha(doc.expires_at)],
        ].map(([k, v], i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: "1px solid #f3f4f6" }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>{k}</span>
            {typeof v === "string" ? <span style={{ fontSize: 12, color: "#111" }}>{v}</span> : v}
          </div>
        ))}
      </div>

      {Object.keys(doc.datos_json || {}).length > 0 && (
        <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>
            Datos del documento
          </div>
          <div style={{ display: "grid", gap: 7 }}>
            {Object.entries(doc.datos_json).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: 11, color: "#6b7280", textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</span>
                <span style={{ fontSize: 11, color: "#111", fontWeight: 500, textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {doc.url_documento_firmado && (
          <a href={doc.url_documento_firmado} target="_blank" rel="noopener noreferrer" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: "#065f46", color: "#fff", borderRadius: 10, padding: "11px 0",
            fontSize: 13, fontWeight: 700, textDecoration: "none"
          }}>
            <CheckCircle2 size={14} /> Descargar PDF firmado
          </a>
        )}
        {doc.estado === "pendiente" && doc.docuseal_submission_id && (
          <button onClick={handleReenviar} disabled={reenviando} style={{
            width: "100%", background: reenviando ? "#9ca3af" : RED, color: "#fff",
            border: "none", borderRadius: 10, padding: "11px 0", fontSize: 13,
            fontWeight: 700, cursor: reenviando ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8
          }}>
            <Send size={14} /> {reenviando ? "Reenviando..." : "Reenviar link de firma"}
          </button>
        )}
      </div>
    </Modal>
  );
}

// ─── Tab Plantillas ────────────────────────────────────────────────────────────

function TabPlantillas({ plantillas, onRefresh }: { plantillas: Plantilla[]; onRefresh: () => void }) {
  const [editando, setEditando] = useState<Plantilla | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [docusealId, setDocusealId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const propias = plantillas.filter(p => !p.es_global);
  const globales = plantillas.filter(p => p.es_global);

  const inputStyle: React.CSSProperties = {
    width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8,
    padding: "8px 12px", fontSize: 13, outline: "none", boxSizing: "border-box",
    fontFamily: "inherit", color: "#111", background: "#fff"
  };

  const abrirEditar = (p: Plantilla) => {
    setEditando(p);
    setNombre(p.nombre);
    setDescripcion(p.descripcion);
    setDocusealId(p.docuseal_template_id?.toString() || "");
    setError("");
  };

  const guardar = async () => {
    if (!editando || !nombre) return;
    setGuardando(true);
    setError("");
    const res = await fetch("/api/firma/plantillas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editando.id,
        nombre,
        descripcion,
        docuseal_template_id: docusealId ? parseInt(docusealId) : null,
      }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error || "Error al guardar"); setGuardando(false); return; }
    setEditando(null);
    onRefresh();
    setGuardando(false);
  };

  const eliminar = async (p: Plantilla) => {
    if (!confirm(`¿Eliminar la plantilla "${p.nombre}"?`)) return;
    await fetch("/api/firma/plantillas", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id }),
    });
    onRefresh();
  };

  return (
    <div>
      {/* Info DocuSeal */}
      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 12, color: "#1e40af", lineHeight: 1.6 }}>
        <strong>¿Cómo funciona?</strong> Cada plantilla tiene un <strong>ID de DocuSeal</strong> que la conecta con el PDF que subiste en tu servidor. Sin ese ID, el documento se guarda pero no se envía automáticamente por email.{" "}
        <a href={`${process.env.NEXT_PUBLIC_DOCUSEAL_URL || "#"}/templates`} target="_blank" rel="noopener noreferrer"
          style={{ color: "#1d4ed8", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}>
          Ir a DocuSeal <ExternalLink size={10} />
        </a>
      </div>

      {/* Plantillas propias */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>
        Mis plantillas
      </div>
      {propias.length === 0 ? (
        <div style={{ background: "#f8fafc", border: "1.5px dashed #e5e7eb", borderRadius: 10, padding: 20, textAlign: "center", fontSize: 12, color: "#9ca3af", marginBottom: 20 }}>
          Todavía no tenés plantillas propias.<br />Las del sistema ya están disponibles para usar.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
          {propias.map(p => (
            <div key={p.id} style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{p.nombre}</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                  {p.docuseal_template_id
                    ? <span style={{ color: "#065f46" }}>✅ DocuSeal ID: {p.docuseal_template_id}</span>
                    : <span style={{ color: "#92400e" }}>⚠ Sin ID DocuSeal</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => abrirEditar(p)} style={{ background: "#f3f4f6", border: "none", borderRadius: 7, padding: "6px 8px", cursor: "pointer" }}>
                  <Pencil size={13} color="#374151" />
                </button>
                <button onClick={() => eliminar(p)} style={{ background: "#fee2e2", border: "none", borderRadius: 7, padding: "6px 8px", cursor: "pointer" }}>
                  <Trash2 size={13} color="#991b1b" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Plantillas del sistema */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>
        Plantillas del sistema <Globe size={11} style={{ marginLeft: 4 }} />
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {globales.map(p => (
          <div key={p.id} style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{p.nombre}</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>
                {p.docuseal_template_id ? `DocuSeal ID: ${p.docuseal_template_id}` : "Sin ID configurado"}
              </div>
            </div>
            <button onClick={() => abrirEditar(p)} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 11, color: "#6b7280" }}>
              Asignar ID
            </button>
          </div>
        ))}
      </div>

      {/* Modal editar */}
      {editando && (
        <Modal title={editando.es_global ? "Configurar plantilla del sistema" : "Editar plantilla"} onClose={() => setEditando(null)}>
          <div style={{ display: "grid", gap: 14 }}>
            {!editando.es_global && (
              <>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Nombre</label>
                  <input value={nombre} onChange={e => setNombre(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Descripción</label>
                  <input value={descripcion} onChange={e => setDescripcion(e.target.value)} style={inputStyle} />
                </div>
              </>
            )}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>
                ID de DocuSeal (template_id)
              </label>
              <input value={docusealId} onChange={e => setDocusealId(e.target.value)}
                style={inputStyle} placeholder="Ej: 1000001" type="number" />
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, lineHeight: 1.5 }}>
                Lo encontrás en la URL de tu template de DocuSeal: /templates/<strong>1000001</strong>/edit
              </div>
            </div>
            {error && <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
            <button onClick={guardar} disabled={guardando} style={{
              width: "100%", background: guardando ? "#9ca3af" : RED, color: "#fff",
              border: "none", borderRadius: 10, padding: "11px 0", fontSize: 13,
              fontWeight: 700, cursor: guardando ? "not-allowed" : "pointer"
            }}>
              {guardando ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function FirmaDigital() {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState<"documentos" | "plantillas">("documentos");
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [paso, setPaso] = useState<"selector" | "formulario">("selector");
  const [plantillaSel, setPlantillaSel] = useState<Plantilla | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [docSel, setDocSel] = useState<Documento | null>(null);
  const [exito, setExito] = useState("");

  const cargarDatos = useCallback(async () => {
    const [docsRes, plantRes] = await Promise.all([
      fetch("/api/firma/documentos"),
      fetch("/api/firma/plantillas"),
    ]);
    if (docsRes.ok) setDocumentos(await docsRes.json());
    if (plantRes.ok) setPlantillas(await plantRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") cargarDatos();
  }, [status, cargarDatos]);

  const abrirNuevo = () => { setModalNuevo(true); setPaso("selector"); setPlantillaSel(null); };

  const handleEnviar = async (datos: Record<string, string>, firmante: { nombre: string; email: string; telefono: string }) => {
    if (!plantillaSel) return;
    setEnviando(true);
    try {
      const res = await fetch("/api/firma/documentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plantilla_id: plantillaSel.id,
          datos_json: datos,
          firmante_nombre: firmante.nombre,
          firmante_email: firmante.email,
          firmante_telefono: firmante.telefono,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setModalNuevo(false);
      await cargarDatos();
      setExito(`✅ Documento enviado a ${firmante.email}`);
      setTimeout(() => setExito(""), 5000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error");
    } finally {
      setEnviando(false);
    }
  };

  const handleReenviar = async (doc: Documento) => {
    const res = await fetch(`/api/firma/${doc.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reenviar" }),
    });
    if (res.ok) {
      setDocSel(null);
      setExito("✅ Email de firma reenviado");
      setTimeout(() => setExito(""), 4000);
    }
  };

  const pendientesAlerta = documentos.filter(esPendienteMasDe48h).length;
  const firmados = documentos.filter(d => d.estado === "firmado");
  const pendientes = documentos.filter(d => d.estado === "pendiente");

  if (status === "loading" || loading) {
    return (
      <AppLayout>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
          <div style={{ fontSize: 13, color: "#9ca3af" }}>Cargando...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <>
      <Head><title>Firma Digital · InmoCoach</title></Head>
      <AppLayout>
        <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 16px 40px" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: RED, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FileSignature size={19} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#111", display: "flex", alignItems: "center", gap: 8 }}>
                  Firma Digital
                  {pendientesAlerta > 0 && (
                    <span style={{ background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 999, padding: "2px 7px" }}>
                      {pendientesAlerta}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>
                  {documentos.length} doc{documentos.length !== 1 ? "s" : ""} · {firmados.length} firmado{firmados.length !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
            <button onClick={abrirNuevo} style={{
              background: RED, color: "#fff", border: "none", borderRadius: 10,
              padding: "9px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6
            }}>
              <Plus size={14} /> Nuevo documento
            </button>
          </div>

          {/* Éxito */}
          {exito && (
            <div style={{ background: "#d1fae5", color: "#065f46", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 500, marginBottom: 16 }}>
              {exito}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, background: "#f3f4f6", borderRadius: 10, padding: 4, marginBottom: 20 }}>
            {[
              { id: "documentos", label: "Documentos", Icon: FileText },
              { id: "plantillas", label: "Plantillas", Icon: Settings },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id as "documentos" | "plantillas")} style={{
                flex: 1, background: tab === t.id ? "#fff" : "transparent",
                border: "none", borderRadius: 7, padding: "8px 0", fontSize: 12,
                fontWeight: 600, color: tab === t.id ? RED : "#6b7280",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                boxShadow: tab === t.id ? "0 1px 4px rgba(0,0,0,.08)" : "none",
                transition: "all .15s"
              }}>
                <t.Icon size={13} /> {t.label}
              </button>
            ))}
          </div>

          {/* Tab: Documentos */}
          {tab === "documentos" && (
            <>
              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
                {[
                  { label: "Pendientes", value: pendientes.length, color: "#92400e", bg: "#fef3c7" },
                  { label: "Firmados", value: firmados.length, color: "#065f46", bg: "#d1fae5" },
                  { label: "Total", value: documentos.length, color: "#374151", bg: "#f3f4f6" },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: s.color, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Lista */}
              {documentos.length === 0 ? (
                <div style={{ background: "#f8fafc", border: "1.5px dashed #e5e7eb", borderRadius: 14, padding: 36, textAlign: "center" }}>
                  <FileSignature size={32} color="#d1d5db" style={{ marginBottom: 12 }} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                    Todavía no enviaste ningún documento
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 20 }}>
                    Elegí una plantilla y enviala al cliente para que firme desde su celular
                  </div>
                  <button onClick={abrirNuevo} style={{
                    background: RED, color: "#fff", border: "none", borderRadius: 10,
                    padding: "10px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer"
                  }}>
                    Crear primer documento
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {documentos.map(doc => (
                    <FilaDocumento key={doc.id} doc={doc} onVer={() => setDocSel(doc)} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Tab: Plantillas */}
          {tab === "plantillas" && (
            <TabPlantillas plantillas={plantillas} onRefresh={cargarDatos} />
          )}
        </div>

        {/* Modal Nuevo Documento */}
        {modalNuevo && (
          <Modal title="Nuevo documento" onClose={() => setModalNuevo(false)}>
            {paso === "selector" ? (
              <SelectorPlantilla
                plantillas={plantillas}
                onSelect={p => { setPlantillaSel(p); setPaso("formulario"); }}
              />
            ) : plantillaSel ? (
              <FormularioDatos
                plantilla={plantillaSel}
                onBack={() => setPaso("selector")}
                onSubmit={handleEnviar}
                loading={enviando}
              />
            ) : null}
          </Modal>
        )}

        {/* Modal Detalle Documento */}
        {docSel && (
          <ModalDetalle
            doc={docSel}
            onClose={() => setDocSel(null)}
            onReenviar={() => handleReenviar(docSel)}
          />
        )}
      </AppLayout>
    </>
  );
}
