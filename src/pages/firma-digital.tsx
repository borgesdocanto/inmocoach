import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Head from "next/head";
import AppLayout from "../components/AppLayout";
import {
  FileSignature, Plus, Clock, CheckCircle2, XCircle, RefreshCw,
  ChevronRight, Send, X, AlertCircle, FileText, Phone, Mail,
  Settings, Globe, Building2, Pencil, Trash2, ExternalLink, Upload, Download
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
  firma_token: string;
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

function SelectorPlantilla({
  plantillas,
  onSelect,
  onSubirPdf,
}: {
  plantillas: Plantilla[];
  onSelect: (p: Plantilla) => void;
  onSubirPdf: () => void;
}) {
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

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#111", marginBottom: 16 }}>
        Elegí el tipo de documento
      </div>

      {/* Opción: subir PDF propio */}
      <button onClick={onSubirPdf} style={{
        width: "100%", background: "#fff8f8", border: `2px solid ${RED}`,
        borderRadius: 12, padding: "14px 15px", textAlign: "left",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 20, transition: "all .15s"
      }}
        onMouseOver={e => { e.currentTarget.style.background = "#fff0f0"; }}
        onMouseOut={e => { e.currentTarget.style.background = "#fff8f8"; }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: RED, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Upload size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: RED }}>Subir PDF para firmar</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
              Cualquier documento PDF · Sin plantilla necesaria
            </div>
          </div>
        </div>
        <ChevronRight size={15} color={RED} />
      </button>

      {plantillas.length > 0 && (
        <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
          O usá una plantilla
        </div>
      )}

      <GrupoPlantillas lista={propias} label="Mis plantillas" />
      <GrupoPlantillas lista={globales} label="Plantillas del sistema" />

      {plantillas.length === 0 && (
        <div style={{ textAlign: "center", padding: "10px 0", color: "#9ca3af", fontSize: 12 }}>
          No hay plantillas configuradas aún.
        </div>
      )}
    </div>
  );
}

// ─── Formulario subir PDF libre ────────────────────────────────────────────────

function FormularioPdf({
  onBack, onSubmit, loading
}: {
  onBack: () => void;
  onSubmit: (payload: { nombre_documento: string; firmante_nombre: string; firmante_email: string; firmante_telefono: string; pdf_base64: string }) => void;
  loading: boolean;
}) {
  const [nombreDoc, setNombreDoc] = useState("");
  const [firmante, setFirmante] = useState({ nombre: "", email: "", telefono: "" });
  const [pdfBase64, setPdfBase64] = useState("");
  const [pdfNombre, setPdfNombre] = useState("");
  const [dragging, setDragging] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8,
    padding: "8px 12px", fontSize: 13, outline: "none", boxSizing: "border-box",
    fontFamily: "inherit", background: "#fff", color: "#111"
  };

  const procesarPdf = (file: File) => {
    if (file.type !== "application/pdf") { alert("Solo se aceptan archivos PDF"); return; }
    if (file.size > 9 * 1024 * 1024) { alert("El PDF no puede superar 9 MB"); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const result = e.target?.result as string;
      setPdfBase64(result); // data:application/pdf;base64,XXXX
      setPdfNombre(file.name);
      if (!nombreDoc) setNombreDoc(file.name.replace(/\.pdf$/i, ""));
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) procesarPdf(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) procesarPdf(file);
  };

  const handleSubmit = () => {
    if (!pdfBase64) { alert("Seleccioná un PDF"); return; }
    if (!firmante.nombre || !firmante.email) { alert("Nombre y email del firmante son obligatorios"); return; }
    if (!nombreDoc) { alert("Ingresá un nombre para el documento"); return; }
    onSubmit({ nombre_documento: nombreDoc, firmante_nombre: firmante.nombre, firmante_email: firmante.email, firmante_telefono: firmante.telefono, pdf_base64: pdfBase64 });
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

      <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 4 }}>Subir PDF para firmar</div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>El cliente recibe el link por email y firma desde su celular</div>

      {/* Drop zone PDF */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragging ? RED : pdfBase64 ? "#10b981" : "#d1d5db"}`,
          borderRadius: 12, padding: "24px 16px", textAlign: "center",
          background: dragging ? "#fff8f8" : pdfBase64 ? "#f0fdf4" : "#fafafa",
          marginBottom: 18, transition: "all .2s", cursor: "pointer"
        }}
        onClick={() => document.getElementById("pdf-input")?.click()}
      >
        <input id="pdf-input" type="file" accept="application/pdf" style={{ display: "none" }} onChange={handleFileInput} />
        {pdfBase64 ? (
          <div>
            <CheckCircle2 size={28} color="#10b981" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: "#065f46" }}>{pdfNombre}</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Clic para cambiar el archivo</div>
          </div>
        ) : (
          <div>
            <Upload size={28} color="#9ca3af" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Arrastrá el PDF acá</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>o hacé clic para buscarlo · Máx 9 MB</div>
          </div>
        )}
      </div>

      {/* Nombre del documento */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Nombre del documento *</label>
        <input value={nombreDoc} onChange={e => setNombreDoc(e.target.value)} style={inputStyle} placeholder="Ej: Contrato de alquiler Pérez" />
      </div>

      {/* Datos del firmante */}
      <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 12, textTransform: "uppercase", letterSpacing: .5 }}>
          ¿Quién tiene que firmar?
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Nombre y apellido *</label>
            <input value={firmante.nombre} onChange={e => setFirmante(f => ({ ...f, nombre: e.target.value }))} style={inputStyle} placeholder="Juan García" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "flex", alignItems: "center", gap: 3, marginBottom: 4 }}>
                <Mail size={10} /> Email *
              </label>
              <input type="email" value={firmante.email} onChange={e => setFirmante(f => ({ ...f, email: e.target.value }))} style={inputStyle} placeholder="juan@gmail.com" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "flex", alignItems: "center", gap: 3, marginBottom: 4 }}>
                <Phone size={10} /> Teléfono
              </label>
              <input value={firmante.telefono} onChange={e => setFirmante(f => ({ ...f, telefono: e.target.value }))} style={inputStyle} placeholder="+54 11..." />
            </div>
          </div>
        </div>
      </div>

      <button onClick={handleSubmit} disabled={loading || !pdfBase64} style={{
        width: "100%", background: loading || !pdfBase64 ? "#9ca3af" : RED, color: "#fff",
        border: "none", borderRadius: 10, padding: "12px 0", fontSize: 13,
        fontWeight: 700, cursor: loading || !pdfBase64 ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8
      }}>
        <Send size={14} /> {loading ? "Enviando..." : "Enviar para firma"}
      </button>
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

// ─── Botón para generar PDF firmado si no existe aún ─────────────────────────

function GenerarPdfBtn({ docId, firmaToken, onListo }: { docId: string; firmaToken: string; onListo: () => void }) {
  const [generando, setGenerando] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  const generar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setGenerando(true);
    try {
      const res = await fetch("/api/firma/generar-pdf-final", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firma_token: firmaToken }),
      });
      const json = await res.json();
      if (json.pdf_url) {
        setUrl(json.pdf_url);
        onListo();
      } else {
        alert(json.error || "Error al generar PDF");
      }
    } catch { alert("Error de conexión"); }
    setGenerando(false);
  };

  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "#065f46", color: "#fff", borderRadius: 8,
          padding: "7px 14px", fontSize: 12, fontWeight: 700, textDecoration: "none"
        }}>
        <Download size={13} /> Descargar PDF firmado
      </a>
    );
  }

  return (
    <button onClick={generar} disabled={generando} style={{
      display: "flex", alignItems: "center", gap: 6,
      background: generando ? "#9ca3af" : "#065f46", color: "#fff",
      border: "none", borderRadius: 8, padding: "7px 14px",
      fontSize: 12, fontWeight: 700, cursor: generando ? "not-allowed" : "pointer"
    }}>
      <Download size={13} /> {generando ? "Generando PDF..." : "Generar PDF firmado"}
    </button>
  );
}

// ─── Fila de documento ─────────────────────────────────────────────────────────

function FilaDocumento({ doc, onVer }: { doc: Documento; onVer: () => void }) {
  const alertar = esPendienteMasDe48h(doc);
  const firmado = doc.estado === "firmado";

  return (
    <div style={{
      background: "#fff", border: `1.5px solid ${alertar ? "#fca5a5" : firmado ? "#bbf7d0" : "#e5e7eb"}`,
      borderRadius: 12, overflow: "hidden", transition: "all .15s"
    }}>
      <div onClick={onVer} style={{
        padding: "14px 16px", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12
      }}
        onMouseOver={e => { e.currentTarget.style.background = "#fafafa"; }}
        onMouseOut={e => { e.currentTarget.style.background = ""; }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
            <FileText size={13} color={firmado ? "#065f46" : RED} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {doc.datos_json?.nombre_documento || doc.firma_plantillas?.nombre || "Documento"}
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

      {/* Botón descarga visible directamente en la fila si está firmado */}
      {firmado && (
        <div style={{ borderTop: "1px solid #f0fdf4", padding: "10px 16px", background: "#f0fdf4", display: "flex", gap: 10, alignItems: "center" }}>
          {doc.url_documento_firmado ? (
            <a
              href={doc.url_documento_firmado}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "#065f46", color: "#fff", borderRadius: 8,
                padding: "7px 14px", fontSize: 12, fontWeight: 700,
                textDecoration: "none", flexShrink: 0
              }}
            >
              <Download size={13} /> Descargar PDF firmado
            </a>
          ) : (
            <GenerarPdfBtn docId={doc.id} firmaToken={doc.firma_token} onListo={onVer} />
          )}
          <span style={{ fontSize: 11, color: "#065f46" }}>
            Firmado el {formatFecha(doc.signed_at!)}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Modal detalle documento ───────────────────────────────────────────────────

function ModalDetalle({
  doc, onClose, onReenviar, onEditar
}: {
  doc: Documento;
  onClose: () => void;
  onReenviar: () => Promise<void>;
  onEditar: (nombre: string, email: string, tel: string) => Promise<void>;
}) {
  const [modo, setModo] = useState<"ver" | "editar">("ver");
  const [reenviando, setReenviando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [fnombre, setFnombre] = useState(doc.firmante_nombre || "");
  const [femail, setFemail] = useState(doc.firmante_email || "");
  const [ftel, setFtel] = useState(doc.firmante_telefono || "");
  const [msgExito, setMsgExito] = useState("");

  const inputStyle: React.CSSProperties = {
    width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8,
    padding: "8px 12px", fontSize: 13, outline: "none", boxSizing: "border-box",
    fontFamily: "inherit", color: "#111", background: "#fff"
  };

  const handleReenviar = async () => {
    setReenviando(true);
    await onReenviar();
    setMsgExito("✅ Email enviado");
    setTimeout(() => setMsgExito(""), 4000);
    setReenviando(false);
  };

  const handleGuardar = async () => {
    if (!fnombre || !femail) { alert("Nombre y email son obligatorios"); return; }
    setGuardando(true);
    await onEditar(fnombre, femail, ftel);
    setModo("ver");
    setMsgExito("✅ Datos actualizados");
    setTimeout(() => setMsgExito(""), 4000);
    setGuardando(false);
  };

  const handleGuardarYReenviar = async () => {
    if (!fnombre || !femail) { alert("Nombre y email son obligatorios"); return; }
    setGuardando(true);
    await onEditar(fnombre, femail, ftel);
    setModo("ver");
    setGuardando(false);
    setReenviando(true);
    await onReenviar();
    setMsgExito("✅ Datos actualizados y email reenviado");
    setTimeout(() => setMsgExito(""), 5000);
    setReenviando(false);
  };

  const nombreDoc = doc.datos_json?.nombre_documento || doc.firma_plantillas?.nombre || "Documento";

  return (
    <Modal title={nombreDoc} onClose={onClose}>
      {doc.estado === "pendiente" && (
        <div style={{ display: "flex", gap: 4, background: "#f3f4f6", borderRadius: 8, padding: 4, marginBottom: 20 }}>
          {(["ver", "editar"] as const).map(m => (
            <button key={m} onClick={() => setModo(m)} style={{
              flex: 1, background: modo === m ? "#fff" : "transparent",
              border: "none", borderRadius: 6, padding: "7px 0", fontSize: 12,
              fontWeight: 600, color: modo === m ? RED : "#6b7280",
              cursor: "pointer", boxShadow: modo === m ? "0 1px 3px rgba(0,0,0,.08)" : "none"
            }}>
              {m === "ver" ? "📄 Detalle" : "✏️ Editar firmante"}
            </button>
          ))}
        </div>
      )}

      {msgExito && (
        <div style={{ background: "#d1fae5", color: "#065f46", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 500, marginBottom: 16 }}>
          {msgExito}
        </div>
      )}

      {modo === "ver" && (
        <>
          <div style={{ display: "grid", marginBottom: 20 }}>
            {[
              ["Estado", estadoBadge(doc.estado)],
              ["Firmante", <span style={{ fontSize: 12, fontWeight: 500 }} key="fn">{doc.firmante_nombre}</span>],
              ["Email", doc.firmante_email],
              ...(doc.firmante_telefono ? [["Teléfono", doc.firmante_telefono]] : []),
              ["Enviado", formatFecha(doc.created_at)],
              ...(doc.signed_at ? [["Firmado ✅", <span key="fs" style={{ fontWeight: 700, color: "#065f46" }}>{formatFecha(doc.signed_at)}</span>]] : []),
              ["Vence", formatFecha(doc.expires_at)],
            ].map(([k, v], i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
                <span style={{ fontSize: 12, color: "#6b7280" }}>{k}</span>
                {typeof v === "string" ? <span style={{ fontSize: 12, color: "#111" }}>{v}</span> : v}
              </div>
            ))}
          </div>

          {Object.keys(doc.datos_json || {}).filter(k => k !== "nombre_documento").length > 0 && (
            <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>
                Datos del documento
              </div>
              <div style={{ display: "grid", gap: 7 }}>
                {Object.entries(doc.datos_json).filter(([k]) => k !== "nombre_documento").map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ fontSize: 11, color: "#6b7280", textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</span>
                    <span style={{ fontSize: 11, color: "#111", fontWeight: 500, textAlign: "right" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gap: 10 }}>
            {doc.url_documento_firmado ? (
              <a href={doc.url_documento_firmado} target="_blank" rel="noopener noreferrer" style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                background: "#065f46", color: "#fff", borderRadius: 10, padding: "13px 0",
                fontSize: 14, fontWeight: 700, textDecoration: "none"
              }}>
                <Download size={15} /> Descargar PDF firmado
              </a>
            ) : doc.estado === "firmado" ? (
              <GenerarPdfBtn docId={doc.id} firmaToken={doc.firma_token} onListo={onClose} />
            ) : null}
            {doc.estado === "pendiente" && (
              <button onClick={handleReenviar} disabled={reenviando} style={{
                width: "100%", background: reenviando ? "#9ca3af" : RED, color: "#fff",
                border: "none", borderRadius: 10, padding: "11px 0", fontSize: 13,
                fontWeight: 700, cursor: reenviando ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8
              }}>
                <Send size={14} /> {reenviando ? "Enviando..." : "Reenviar email de firma"}
              </button>
            )}
          </div>
        </>
      )}

      {modo === "editar" && (
        <div style={{ display: "grid", gap: 14 }}>
          <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
            Corregí los datos del firmante. Después podés reenviarle el email.
          </p>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Nombre y apellido *</label>
            <input value={fnombre} onChange={e => setFnombre(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "flex", alignItems: "center", gap: 3, marginBottom: 4 }}>
              <Mail size={10} /> Email *
            </label>
            <input type="email" value={femail} onChange={e => setFemail(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "flex", alignItems: "center", gap: 3, marginBottom: 4 }}>
              <Phone size={10} /> Teléfono
            </label>
            <input value={ftel} onChange={e => setFtel(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button onClick={() => setModo("ver")} style={{
              background: "#f3f4f6", border: "none", borderRadius: 10, padding: "11px 0",
              fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer"
            }}>
              Cancelar
            </button>
            <button onClick={handleGuardar} disabled={guardando} style={{
              background: guardando ? "#9ca3af" : "#374151", color: "#fff",
              border: "none", borderRadius: 10, padding: "11px 0",
              fontSize: 13, fontWeight: 700, cursor: guardando ? "not-allowed" : "pointer"
            }}>
              {guardando ? "Guardando..." : "Solo guardar"}
            </button>
          </div>
          <button onClick={handleGuardarYReenviar} disabled={guardando || reenviando} style={{
            width: "100%", background: guardando || reenviando ? "#9ca3af" : RED, color: "#fff",
            border: "none", borderRadius: 10, padding: "12px 0", fontSize: 13,
            fontWeight: 700, cursor: guardando || reenviando ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8
          }}>
            <Send size={14} /> {guardando || reenviando ? "Procesando..." : "Guardar y reenviar email"}
          </button>
        </div>
      )}
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
  const [paso, setPaso] = useState<"selector" | "formulario" | "subir-pdf">("selector");
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

  const handleEnviarPdf = async (payload: { nombre_documento: string; firmante_nombre: string; firmante_email: string; firmante_telefono: string; pdf_base64: string }) => {
    setEnviando(true);
    try {
      const res = await fetch("/api/firma/subir-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setModalNuevo(false);
      await cargarDatos();
      setExito(`✅ PDF enviado a ${payload.firmante_email} para firma`);
      setTimeout(() => setExito(""), 5000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al enviar");
    } finally {
      setEnviando(false);
    }
  };

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

  const handleReenviar = async (doc: Documento): Promise<void> => {
    const res = await fetch(`/api/firma/${doc.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reenviar" }),
    });
    if (!res.ok) {
      const json = await res.json();
      alert(json.error || "Error al reenviar");
    }
  };

  const handleEditar = async (doc: Documento, nombre: string, emailFirmante: string, tel: string): Promise<void> => {
    const res = await fetch(`/api/firma/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firmante_nombre: nombre, firmante_email: emailFirmante, firmante_telefono: tel }),
    });
    if (res.ok) {
      // Actualizar doc en el estado local sin cerrar el modal
      const { doc: updated } = await res.json();
      setDocumentos(prev => prev.map(d => d.id === doc.id ? { ...d, ...updated } : d));
      setDocSel(prev => prev ? { ...prev, firmante_nombre: nombre, firmante_email: emailFirmante, firmante_telefono: tel } : prev);
    } else {
      const json = await res.json();
      alert(json.error || "Error al guardar");
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
      <Head><title>Firma Digital</title></Head>
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
                onSubirPdf={() => setPaso("subir-pdf")}
              />
            ) : paso === "subir-pdf" ? (
              <FormularioPdf
                onBack={() => setPaso("selector")}
                onSubmit={handleEnviarPdf}
                loading={enviando}
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
            onEditar={(nombre, emailF, tel) => handleEditar(docSel, nombre, emailF, tel)}
          />
        )}
      </AppLayout>
    </>
  );
}
