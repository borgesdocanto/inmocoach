import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Head from "next/head";
import AppLayout from "../components/AppLayout";
import {
  FileSignature, Plus, Clock, CheckCircle2, XCircle, RefreshCw,
  ChevronRight, Send, X, AlertCircle, FileText, Phone, Mail
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
  const cfg: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    pendiente: { label: "Pendiente", color: "#92400e", bg: "#fef3c7", icon: <Clock size={12} /> },
    firmado:   { label: "Firmado",   color: "#065f46", bg: "#d1fae5", icon: <CheckCircle2 size={12} /> },
    vencido:   { label: "Vencido",   color: "#991b1b", bg: "#fee2e2", icon: <XCircle size={12} /> },
    cancelado: { label: "Cancelado", color: "#374151", bg: "#f3f4f6", icon: <XCircle size={12} /> },
  };
  const c = cfg[estado] || cfg.pendiente;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: c.bg, color: c.color,
      fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 999
    }}>
      {c.icon} {c.label}
    </span>
  );
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function esPendienteMasDe48h(doc: Documento) {
  if (doc.estado !== "pendiente") return false;
  const diff = Date.now() - new Date(doc.created_at).getTime();
  return diff > 48 * 60 * 60 * 1000;
}

// ─── Componente Selector de Plantilla ─────────────────────────────────────────

function SelectorPlantilla({
  plantillas, onSelect
}: { plantillas: Plantilla[]; onSelect: (p: Plantilla) => void }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#111", marginBottom: 14 }}>
        Elegí el tipo de documento
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {plantillas.map(p => (
          <button key={p.id} onClick={() => onSelect(p)} style={{
            width: "100%", background: "#fff", border: "1.5px solid #e5e7eb",
            borderRadius: 12, padding: "14px 16px", textAlign: "left",
            cursor: "pointer", transition: "border-color .15s",
            display: "flex", alignItems: "center", justifyContent: "space-between"
          }}
            onMouseOver={e => (e.currentTarget.style.borderColor = RED)}
            onMouseOut={e => (e.currentTarget.style.borderColor = "#e5e7eb")}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{p.nombre}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{p.descripcion}</div>
            </div>
            <ChevronRight size={16} color="#9ca3af" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Componente Formulario de Datos ───────────────────────────────────────────

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

  const setCampo = (k: string, v: string) => setCampos(prev => ({ ...prev, [k]: v }));

  const handleSubmit = () => {
    // Validar requeridos
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

  const inputStyle: React.CSSProperties = {
    width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8,
    padding: "8px 12px", fontSize: 13, outline: "none", boxSizing: "border-box",
    fontFamily: "inherit", background: "#fff", color: "#111"
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

      <div style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 4 }}>
        {plantilla.nombre}
      </div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>{plantilla.descripcion}</div>

      {/* Datos del firmante */}
      <div style={{
        background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10,
        padding: 14, marginBottom: 18
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 12 }}>
          ¿Quién tiene que firmar?
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>
              Nombre y apellido *
            </label>
            <input value={firmante.nombre} onChange={e => setFirmante(f => ({ ...f, nombre: e.target.value }))}
              style={inputStyle} placeholder="Juan García" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>
              <Mail size={11} style={{ marginRight: 3 }} />Email *
            </label>
            <input type="email" value={firmante.email} onChange={e => setFirmante(f => ({ ...f, email: e.target.value }))}
              style={inputStyle} placeholder="juan@gmail.com" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>
              <Phone size={11} style={{ marginRight: 3 }} />Teléfono (opcional)
            </label>
            <input value={firmante.telefono} onChange={e => setFirmante(f => ({ ...f, telefono: e.target.value }))}
              style={inputStyle} placeholder="+54 11 1234-5678" />
          </div>
        </div>
      </div>

      {/* Campos del documento */}
      <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 12 }}>
        Datos del documento
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {plantilla.campos.map(campo => (
          <div key={campo.nombre}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>
              {campo.etiqueta}{campo.requerido ? " *" : ""}
            </label>
            {campo.tipo === "textarea" ? (
              <textarea value={campos[campo.nombre] || ""} onChange={e => setCampo(campo.nombre, e.target.value)}
                style={{ ...inputStyle, height: 70, resize: "vertical" }} />
            ) : campo.tipo === "select" ? (
              <select value={campos[campo.nombre] || ""} onChange={e => setCampo(campo.nombre, e.target.value)}
                style={inputStyle}>
                <option value="">Seleccioná...</option>
                {campo.opciones?.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input type={campo.tipo} value={campos[campo.nombre] || ""}
                onChange={e => setCampo(campo.nombre, e.target.value)} style={inputStyle} />
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
        <Send size={15} /> {loading ? "Enviando..." : "Enviar para firma"}
      </button>
    </div>
  );
}

// ─── Componente Fila de Documento ─────────────────────────────────────────────

function FilaDocumento({
  doc, onReenviar, onVer
}: {
  doc: Documento;
  onReenviar: (doc: Documento) => void;
  onVer: (doc: Documento) => void;
}) {
  const alertar = esPendienteMasDe48h(doc);

  return (
    <div onClick={() => onVer(doc)} style={{
      background: "#fff", border: `1.5px solid ${alertar ? "#fca5a5" : "#e5e7eb"}`,
      borderRadius: 12, padding: "14px 16px", cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 12, transition: "border-color .15s"
    }}
      onMouseOver={e => (e.currentTarget.style.borderColor = alertar ? "#ef4444" : "#d1d5db")}
      onMouseOut={e => (e.currentTarget.style.borderColor = alertar ? "#fca5a5" : "#e5e7eb")}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <FileText size={14} color={RED} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {doc.firma_plantillas?.nombre || "Documento"}
          </span>
          {alertar && (
            <span title="Pendiente más de 48hs">
              <AlertCircle size={14} color="#ef4444" />
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "#6b7280" }}>
          {doc.firmante_nombre} · {doc.firmante_email}
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
          Enviado {formatFecha(doc.created_at)}
          {doc.signed_at ? ` · Firmado ${formatFecha(doc.signed_at)}` : ` · Vence ${formatFecha(doc.expires_at)}`}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
        {estadoBadge(doc.estado)}
        {doc.estado === "pendiente" && doc.docuseal_submission_id && (
          <button onClick={e => { e.stopPropagation(); onReenviar(doc); }}
            style={{
              background: "none", border: `1px solid ${RED}`, color: RED,
              fontSize: 11, fontWeight: 600, borderRadius: 6, padding: "3px 8px",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 4
            }}>
            <RefreshCw size={10} /> Reenviar
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Modal Detalle Documento ───────────────────────────────────────────────────

function ModalDetalle({
  doc, onClose, onReenviar
}: { doc: Documento; onClose: () => void; onReenviar: () => void }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
      zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center"
    }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: "16px 16px 0 0", padding: 24,
        width: "100%", maxWidth: 520, maxHeight: "80vh", overflowY: "auto"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>
            {doc.firma_plantillas?.nombre || "Documento"}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <X size={20} color="#6b7280" />
          </button>
        </div>

        <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Estado</span>
            {estadoBadge(doc.estado)}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Firmante</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: "#111" }}>{doc.firmante_nombre}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Email</span>
            <span style={{ fontSize: 12, color: "#111" }}>{doc.firmante_email}</span>
          </div>
          {doc.firmante_telefono && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>Teléfono</span>
              <span style={{ fontSize: 12, color: "#111" }}>{doc.firmante_telefono}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Enviado</span>
            <span style={{ fontSize: 12, color: "#111" }}>{formatFecha(doc.created_at)}</span>
          </div>
          {doc.signed_at && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>Firmado</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#065f46" }}>{formatFecha(doc.signed_at)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Vence</span>
            <span style={{ fontSize: 12, color: "#111" }}>{formatFecha(doc.expires_at)}</span>
          </div>
        </div>

        {/* Datos del documento */}
        {Object.keys(doc.datos_json || {}).length > 0 && (
          <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 10 }}>Datos del documento</div>
            <div style={{ display: "grid", gap: 8 }}>
              {Object.entries(doc.datos_json).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontSize: 11, color: "#6b7280", textTransform: "capitalize" }}>
                    {k.replace(/_/g, " ")}
                  </span>
                  <span style={{ fontSize: 11, color: "#111", fontWeight: 500, textAlign: "right" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Acciones */}
        <div style={{ display: "grid", gap: 10 }}>
          {doc.url_documento_firmado && (
            <a href={doc.url_documento_firmado} target="_blank" rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                background: "#065f46", color: "#fff", borderRadius: 10, padding: "12px 0",
                fontSize: 13, fontWeight: 700, textDecoration: "none"
              }}>
              <CheckCircle2 size={15} /> Descargar PDF firmado
            </a>
          )}
          {doc.estado === "pendiente" && doc.docuseal_submission_id && (
            <button onClick={onReenviar} style={{
              width: "100%", background: RED, color: "#fff", border: "none",
              borderRadius: 10, padding: "12px 0", fontSize: 13, fontWeight: 700,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8
            }}>
              <Send size={15} /> Reenviar link de firma
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Página Principal ──────────────────────────────────────────────────────────

export default function FirmaDigital() {
  const { data: session, status } = useSession();
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [paso, setPaso] = useState<"selector" | "formulario">("selector");
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<Plantilla | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [docSeleccionado, setDocSeleccionado] = useState<Documento | null>(null);
  const [mensajeExito, setMensajeExito] = useState("");
  const [planInfo, setPlanInfo] = useState<{ plan: string; usadosMes: number } | null>(null);

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

  // Calcular uso mensual
  useEffect(() => {
    if (!documentos.length) return;
    const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
    const usadosMes = documentos.filter(d => new Date(d.created_at) >= inicioMes).length;
    setPlanInfo({ plan: "individual", usadosMes }); // se actualiza con plan real si querés
  }, [documentos]);

  const pendientesAlerta = documentos.filter(esPendienteMasDe48h).length;

  const handleEnviar = async (datos: Record<string, string>, firmante: { nombre: string; email: string; telefono: string }) => {
    if (!plantillaSeleccionada) return;
    setEnviando(true);
    try {
      const res = await fetch("/api/firma/documentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plantilla_id: plantillaSeleccionada.id,
          datos_json: datos,
          firmante_nombre: firmante.nombre,
          firmante_email: firmante.email,
          firmante_telefono: firmante.telefono,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al crear el documento");
      setMostrarNuevo(false);
      setPaso("selector");
      setPlantillaSeleccionada(null);
      await cargarDatos();
      setMensajeExito(`✅ Documento enviado a ${firmante.email}`);
      setTimeout(() => setMensajeExito(""), 5000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al enviar el documento");
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
    const json = await res.json();
    if (res.ok) {
      setDocSeleccionado(null);
      setMensajeExito("✅ Email de firma reenviado");
      setTimeout(() => setMensajeExito(""), 4000);
    } else {
      alert(json.error || "Error al reenviar");
    }
  };

  if (status === "loading" || loading) {
    return (
      <AppLayout>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
          <div style={{ fontSize: 13, color: "#9ca3af" }}>Cargando documentos...</div>
        </div>
      </AppLayout>
    );
  }

  const firmados = documentos.filter(d => d.estado === "firmado");
  const pendientes = documentos.filter(d => d.estado === "pendiente");

  return (
    <>
      <Head>
        <title>Firma Digital · InmoCoach</title>
      </Head>
      <AppLayout>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px 32px" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: RED, display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <FileSignature size={18} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#111", display: "flex", alignItems: "center", gap: 8 }}>
                  Firma Digital
                  {pendientesAlerta > 0 && (
                    <span style={{
                      background: "#ef4444", color: "#fff", fontSize: 10,
                      fontWeight: 700, borderRadius: 999, padding: "2px 7px"
                    }}>
                      {pendientesAlerta}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>
                  {documentos.length} documento{documentos.length !== 1 ? "s" : ""} · {firmados.length} firmado{firmados.length !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
            <button
              onClick={() => { setMostrarNuevo(true); setPaso("selector"); setPlantillaSeleccionada(null); }}
              style={{
                background: RED, color: "#fff", border: "none", borderRadius: 10,
                padding: "9px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6
              }}>
              <Plus size={14} /> Nuevo
            </button>
          </div>

          {/* Mensaje de éxito */}
          {mensajeExito && (
            <div style={{
              background: "#d1fae5", color: "#065f46", borderRadius: 10,
              padding: "10px 14px", fontSize: 13, fontWeight: 500, marginBottom: 16
            }}>
              {mensajeExito}
            </div>
          )}

          {/* Stats rápidas */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
            {[
              { label: "Pendientes", value: pendientes.length, color: "#92400e", bg: "#fef3c7" },
              { label: "Firmados", value: firmados.length, color: "#065f46", bg: "#d1fae5" },
              { label: "Total", value: documentos.length, color: "#374151", bg: "#f3f4f6" },
            ].map(s => (
              <div key={s.label} style={{
                background: s.bg, borderRadius: 10, padding: "12px 10px", textAlign: "center"
              }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: s.color, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Lista de documentos */}
          {documentos.length === 0 ? (
            <div style={{
              background: "#f8fafc", border: "1.5px dashed #e5e7eb", borderRadius: 14,
              padding: 32, textAlign: "center"
            }}>
              <FileSignature size={32} color="#d1d5db" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                Todavía no enviaste ningún documento
              </div>
              <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 20 }}>
                Elegí una plantilla y enviala al cliente para que firme desde su celular
              </div>
              <button onClick={() => setMostrarNuevo(true)} style={{
                background: RED, color: "#fff", border: "none", borderRadius: 10,
                padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer"
              }}>
                Crear primer documento
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {documentos.map(doc => (
                <FilaDocumento
                  key={doc.id}
                  doc={doc}
                  onReenviar={handleReenviar}
                  onVer={d => setDocSeleccionado(d)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Drawer Nuevo Documento */}
        {mostrarNuevo && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
            zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center"
          }}
            onClick={() => setMostrarNuevo(false)}>
            <div onClick={e => e.stopPropagation()} style={{
              background: "#fff", borderRadius: "16px 16px 0 0", padding: 24,
              width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>Nuevo documento</div>
                <button onClick={() => setMostrarNuevo(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                  <X size={20} color="#6b7280" />
                </button>
              </div>

              {paso === "selector" ? (
                <SelectorPlantilla
                  plantillas={plantillas}
                  onSelect={p => { setPlantillaSeleccionada(p); setPaso("formulario"); }}
                />
              ) : plantillaSeleccionada ? (
                <FormularioDatos
                  plantilla={plantillaSeleccionada}
                  onBack={() => setPaso("selector")}
                  onSubmit={handleEnviar}
                  loading={enviando}
                />
              ) : null}
            </div>
          </div>
        )}

        {/* Modal Detalle */}
        {docSeleccionado && (
          <ModalDetalle
            doc={docSeleccionado}
            onClose={() => setDocSeleccionado(null)}
            onReenviar={() => handleReenviar(docSeleccionado)}
          />
        )}
      </AppLayout>
    </>
  );
}
