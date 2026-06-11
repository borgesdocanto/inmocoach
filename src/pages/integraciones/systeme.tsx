import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Head from "next/head";
import AppLayout from "../../components/AppLayout";
import { CheckCircle2, AlertCircle, Loader2, RefreshCw, Play } from "lucide-react";

const BRAND = "#0ea5e9";
const MIN_TAGS = 4;

interface SyncLog {
  id: string;
  started_at: string;
  finished_at?: string;
  contacts_created: number;
  contacts_updated: number;
  contacts_skipped: number;
  errors_count: number;
  error_detail?: string;
  status: "running" | "success" | "partial" | "error";
  trigger?: "cron" | "manual";
}

interface Config {
  hasKey: boolean;
  keyPreview: string | null;
  isConfigured: boolean;
  whitelist: string[];
  fixed: string[];
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  success: { label: "Exitosa", color: "#16a34a" },
  partial: { label: "Con errores", color: "#d97706" },
  error: { label: "Error", color: "#dc2626" },
  running: { label: "Corriendo...", color: "#0ea5e9" },
};

export default function SystemePage() {
  const router = useRouter();
  const { status } = useSession();

  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<Config | null>(null);
  const [tagGroups, setTagGroups] = useState<{ group: string; tags: string[] }[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [tagSearch, setTagSearch] = useState("");
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagsError, setTagsError] = useState("");
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Form state
  const [apiKey, setApiKey] = useState("");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [fixedTags, setFixedTags] = useState<string[]>([]);
  const [newFixedTag, setNewFixedTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveOk, setSaveOk] = useState(false);
  const [keyVerifying, setKeyVerifying] = useState(false);
  const [keyValid, setKeyValid] = useState<boolean | null>(null);
  const [keyVerifyMsg, setKeyVerifyMsg] = useState("");

  // Run manual
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/systeme/config");
      if (r.status === 403) {
        router.replace("/tokko-setup");
        return;
      }
      if (r.ok) {
        const d: Config = await r.json();
        setConfig(d);
        setSelectedTags(new Set(d.whitelist));
        setFixedTags(d.fixed);
      }
    } catch { /* ignorar */ }
    setLoading(false);
  }, [router]);

  const loadTags = async () => {
    setTagsLoading(true);
    setTagsError("");
    try {
      const r = await fetch("/api/systeme/tokko-tags");
      const d = await r.json();
      if (d.groups) {
        setTagGroups(d.groups);
        // Expandir el primer grupo por defecto
        if (d.groups.length > 0) setExpandedGroups(new Set([d.groups[0].group]));
      } else setTagsError(d.error || "No se pudieron cargar las tags");
    } catch { setTagsError("Error de conexión con Tokko"); }
    setTagsLoading(false);
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const r = await fetch("/api/systeme/logs");
      const d = await r.json();
      if (d.logs) setLogs(d.logs);
    } catch { /* ignorar */ }
    setLogsLoading(false);
  };

  useEffect(() => {
    if (status === "authenticated") {
      loadConfig();
      loadTags();
      loadLogs();
    }
  }, [status, loadConfig]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const addFixedTag = () => {
    const t = newFixedTag.trim();
    if (!t || fixedTags.includes(t)) return;
    setFixedTags(prev => [...prev, t]);
    setNewFixedTag("");
  };

  const removeFixedTag = (tag: string) => {
    setFixedTags(prev => prev.filter(t => t !== tag));
  };

  // Verificar la key directamente desde el browser (evita el bloqueo del servidor)
  const verifyKey = async () => {
    const key = apiKey.trim();
    if (!key) return;
    setKeyVerifying(true); setKeyValid(null); setKeyVerifyMsg("");
    try {
      const r = await fetch("https://api.systeme.io/api/tags?limit=1", {
        headers: { "X-API-Key": key, accept: "application/json" },
      });
      if (r.ok) {
        setKeyValid(true);
        setKeyVerifyMsg("✓ API key válida");
      } else {
        setKeyValid(false);
        setKeyVerifyMsg(`✗ Key inválida (código ${r.status})`);
      }
    } catch {
      setKeyValid(false);
      setKeyVerifyMsg("✗ No se pudo conectar con Systeme.io");
    }
    setKeyVerifying(false);
  };

  const canSave = selectedTags.size >= MIN_TAGS && (!!apiKey.trim() || !!config?.hasKey);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true); setSaveError(""); setSaveOk(false);
    try {
      const r = await fetch("/api/systeme/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey.trim() || undefined,
          whitelist: Array.from(selectedTags),
          fixed: fixedTags,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        setSaveOk(true);
        await loadConfig();
        setTimeout(() => setSaveOk(false), 4000);
      } else {
        setSaveError(d.error || "Error al guardar");
      }
    } catch { setSaveError("Error de conexión"); }
    setSaving(false);
  };

  const handleRunNow = async () => {
    setRunning(true); setRunMsg("");
    try {
      const r = await fetch("/api/systeme/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const d = await r.json();
      if (d.ok) {
        setRunMsg(`✓ Corrida completada — ${d.created} creados · ${d.updated} actualizados${d.errors > 0 ? ` · ${d.errors} errores` : ""}`);
        await loadLogs();
      } else {
        setRunMsg(`✗ ${d.error || "Error"}`);
      }
    } catch { setRunMsg("✗ Error de conexión"); }
    setRunning(false);
  };

  if (loading) {
    return (
      <AppLayout>
        <div style={{ padding: 40, display: "flex", alignItems: "center", gap: 10, color: "#6b7280" }}>
          <Loader2 size={16} className="animate-spin" /> Cargando...
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Head><title>Systeme.io — InmoCoach</title></Head>
      <div style={{ maxWidth: 900, padding: "28px 24px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#111827", fontFamily: "Georgia, serif", margin: 0 }}>
            Sincronización con Systeme.io
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>
            Los contactos de Tokko creados o modificados cada día se sincronizan automáticamente a las 19hs.
          </p>
        </div>

        {/* Estado de conexión */}
        <div style={{
          background: config?.isConfigured ? "#f0fdf4" : "#fffbeb",
          border: `1px solid ${config?.isConfigured ? "#bbf7d0" : "#fde68a"}`,
          borderRadius: 12,
          padding: "14px 18px",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          {config?.isConfigured
            ? <CheckCircle2 size={16} color="#16a34a" />
            : <AlertCircle size={16} color="#d97706" />}
          <span style={{ fontSize: 13, fontWeight: 600, color: config?.isConfigured ? "#15803d" : "#92400e" }}>
            {config?.isConfigured
              ? `Configuración activa · API key: ${config.keyPreview}`
              : "Configuración incompleta — completá los pasos a continuación"}
          </span>
        </div>

        {/* Paso 1: API Key */}
        <Section num={1} title="API key de Systeme.io">
          {config?.hasKey ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, color: "#374151", fontFamily: "monospace" }}>{config.keyPreview}</span>
              <button
                onClick={() => setConfig(prev => prev ? { ...prev, hasKey: false, keyPreview: null } : prev)}
                style={{ fontSize: 12, color: BRAND, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                Cambiar
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={apiKey}
                  onChange={e => { setApiKey(e.target.value); setKeyValid(null); setKeyVerifyMsg(""); }}
                  placeholder="Pegá tu API key de Systeme.io"
                  style={{
                    flex: 1, padding: "10px 14px", borderRadius: 8,
                    border: `1px solid ${keyValid === true ? "#86efac" : keyValid === false ? "#fca5a5" : "#e5e7eb"}`,
                    fontSize: 13, fontFamily: "monospace",
                    outline: "none", boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={verifyKey}
                  disabled={!apiKey.trim() || keyVerifying}
                  style={{
                    padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                    background: keyValid === true ? "#f0fdf4" : "#f9fafb",
                    border: `1px solid ${keyValid === true ? "#86efac" : "#e5e7eb"}`,
                    color: keyValid === true ? "#16a34a" : "#374151",
                    cursor: apiKey.trim() && !keyVerifying ? "pointer" : "not-allowed",
                    opacity: !apiKey.trim() ? 0.5 : 1,
                    whiteSpace: "nowrap",
                  }}>
                  {keyVerifying ? "Verificando..." : keyValid === true ? "✓ Verificada" : "Verificar"}
                </button>
              </div>
              {keyVerifyMsg && (
                <p style={{ fontSize: 12, fontWeight: 600, marginTop: 6, color: keyValid ? "#16a34a" : "#dc2626" }}>
                  {keyVerifyMsg}
                </p>
              )}
              <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                En Systeme.io → Configuración → Claves API públicas
              </p>
            </div>
          )}
        </Section>

        {/* Paso 2: Tags de Tokko */}
        <Section num={2} title={`Tags de Tokko a sincronizar (mínimo ${MIN_TAGS})`}>
          {tagsLoading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9ca3af", fontSize: 13 }}>
              <Loader2 size={14} className="animate-spin" /> Cargando tags de Tokko...
            </div>
          ) : tagsError ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "#dc2626" }}>{tagsError}</span>
              <button onClick={loadTags} style={{ fontSize: 12, color: BRAND, background: "none", border: "none", cursor: "pointer" }}>
                Reintentar
              </button>
            </div>
          ) : (
            <div>
              {/* Buscador */}
              <div style={{ position: "relative", marginBottom: 12 }}>
                <input
                  value={tagSearch}
                  onChange={e => setTagSearch(e.target.value)}
                  placeholder="Buscar tags..."
                  style={{
                    width: "100%", padding: "8px 12px 8px 32px", borderRadius: 8,
                    border: "1px solid #e5e7eb", fontSize: 13, outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontSize: 12, fontWeight: 900 }}>⌕</span>
                {tagSearch && (
                  <button onClick={() => setTagSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 16 }}>×</button>
                )}
              </div>

              {/* Grupos expandibles — flujo natural sin scroll interno */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {tagGroups.map(({ group, tags }) => {
                  const filtered = tagSearch
                    ? tags.filter(t => t.toLowerCase().includes(tagSearch.toLowerCase()))
                    : tags;
                  if (filtered.length === 0) return null;
                  const isExpanded = expandedGroups.has(group) || !!tagSearch;
                  const selectedInGroup = filtered.filter(t => selectedTags.has(t)).length;

                  return (
                    <div key={group} style={{ borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb" }}>
                      {/* Header del grupo */}
                      <button
                        onClick={() => {
                          setExpandedGroups(prev => {
                            const next = new Set(prev);
                            if (next.has(group)) next.delete(group); else next.add(group);
                            return next;
                          });
                        }}
                        style={{
                          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "10px 14px", background: isExpanded ? "#f0f9ff" : "#f9fafb",
                          border: "none", cursor: "pointer", textAlign: "left",
                          borderBottom: isExpanded ? "1px solid #e0f2fe" : "none",
                        }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: isExpanded ? "#0369a1" : "#374151" }}>{group}</span>
                          <span style={{ fontSize: 11, color: "#9ca3af", background: "#f3f4f6", padding: "1px 7px", borderRadius: 10 }}>{filtered.length}</span>
                          {selectedInGroup > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", background: "#dbeafe", padding: "1px 8px", borderRadius: 10 }}>
                              ✓ {selectedInGroup}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 10, color: "#9ca3af", transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "inline-block" }}>▼</span>
                      </button>

                      {/* Tags del grupo */}
                      {isExpanded && (
                        <div style={{ padding: "12px 14px", display: "flex", flexWrap: "wrap", gap: 6, background: "white" }}>
                          {group === "Campos especiales Tokko" && (
                            <p style={{ width: "100%", fontSize: 12, color: "#6b7280", margin: "0 0 8px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "6px 10px" }}>
                              Estas tags se generan a partir de campos del contacto en Tokko, no son tags nativas. Solo se asignan a los contactos que cumplen la condición.
                            </p>
                          )}
                          {filtered.map(tag => {
                            const selected = selectedTags.has(tag);
                            const isSpecial = group === "Campos especiales Tokko";
                            const specialDesc: Record<string, string> = {
                              "is_owner": "Propietario — el contacto tiene o tuvo un inmueble asociado en Tokko (en venta, alquiler o ya operado)",
                            };
                            return (
                              <div key={tag} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <button
                                  onClick={() => toggleTag(tag)}
                                  style={{
                                    padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                                    border: `1.5px solid ${selected ? BRAND : isSpecial ? "#fbbf24" : "#e5e7eb"}`,
                                    background: selected ? "#e0f2fe" : isSpecial ? "#fffbeb" : "white",
                                    color: selected ? "#0369a1" : isSpecial ? "#92400e" : "#6b7280",
                                    cursor: "pointer",
                                  }}>
                                  {selected ? "✓ " : ""}{tag}
                                </button>
                                {isSpecial && specialDesc[tag] && (
                                  <span style={{ fontSize: 10, color: "#9ca3af", paddingLeft: 4 }}>{specialDesc[tag]}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {tagGroups.length === 0 && (
                  <div style={{ padding: "20px 0", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                    No se encontraron tags en Tokko
                  </div>
                )}
              </div>

              {/* Contador y actualizar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: selectedTags.size >= MIN_TAGS ? "#16a34a" : "#dc2626" }}>
                  {selectedTags.size} seleccionada{selectedTags.size !== 1 ? "s" : ""} · mínimo {MIN_TAGS}
                </span>
                <button onClick={loadTags} style={{ fontSize: 12, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <RefreshCw size={11} /> Actualizar
                </button>
              </div>
            </div>
          )}
        </Section>

        {/* Paso 3: Tags fijas */}
        <Section num={3} title="Tags que se agregan siempre a cada contacto">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {fixedTags.map(tag => (
              <span key={tag} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "4px 10px", borderRadius: 20,
                background: "#f0f9ff", border: "1px solid #bae6fd",
                color: "#0369a1", fontSize: 12, fontWeight: 600,
              }}>
                {tag}
                <button
                  onClick={() => removeFixedTag(tag)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#93c5fd", fontSize: 14, lineHeight: 1, padding: 0 }}>
                  ×
                </button>
              </span>
            ))}
            {fixedTags.length === 0 && (
              <span style={{ fontSize: 12, color: "#9ca3af" }}>Ninguna aún</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newFixedTag}
              onChange={e => setNewFixedTag(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addFixedTag()}
              placeholder="Ej: galas, inmocoach..."
              style={{
                flex: 1, padding: "8px 12px", borderRadius: 8,
                border: "1px solid #e5e7eb", fontSize: 13, outline: "none",
              }}
            />
            <button
              onClick={addFixedTag}
              style={{
                padding: "8px 16px", borderRadius: 8, background: "#f0f9ff",
                border: "1px solid #bae6fd", color: "#0369a1", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>
              + Agregar
            </button>
          </div>
          <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
            Sugerencia: el nombre de tu inmobiliaria. Se crean automáticamente en Systeme si no existen.
          </p>
        </Section>

        {/* Botón guardar */}
        <div style={{ marginBottom: 32 }}>
          {saveError && (
            <p style={{ fontSize: 13, color: "#dc2626", marginBottom: 8 }}>{saveError}</p>
          )}
          {saveOk && (
            <p style={{ fontSize: 13, color: "#16a34a", fontWeight: 700, marginBottom: 8 }}>
              ✓ Configuración guardada correctamente
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={handleSave}
              disabled={!canSave || saving}
              style={{
                padding: "11px 28px", borderRadius: 10, fontSize: 14, fontWeight: 800,
                background: canSave ? BRAND : "#e5e7eb",
                color: canSave ? "white" : "#9ca3af",
                border: "none", cursor: canSave ? "pointer" : "not-allowed",
                opacity: saving ? 0.7 : 1,
                display: "flex", alignItems: "center", gap: 8,
              }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {saving ? "Guardando..." : "Guardar configuración"}
            </button>
            {!canSave && selectedTags.size < MIN_TAGS && (
              <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>
                Seleccioná al menos {MIN_TAGS - selectedTags.size} tag{MIN_TAGS - selectedTags.size !== 1 ? "s" : ""} más
              </span>
            )}
          </div>
        </div>

        {/* Corrida manual */}
        {config?.isConfigured && (
          <div style={{
            background: "#f9fafb", border: "1px solid #f3f4f6",
            borderRadius: 12, padding: "16px 20px", marginBottom: 28,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#374151", margin: 0 }}>Ejecutar ahora</p>
                <p style={{ fontSize: 12, color: "#9ca3af", margin: "2px 0 0" }}>
                  Sincroniza los contactos de hoy sin esperar el cron de las 19hs
                </p>
              </div>
              <button
                onClick={handleRunNow}
                disabled={running}
                style={{
                  padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                  background: "#111827", color: "white", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6, opacity: running ? 0.6 : 1,
                }}>
                {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                {running ? "Sincronizando..." : "Sincronizar ahora"}
              </button>
            </div>
            {runMsg && (
              <p style={{ fontSize: 13, fontWeight: 600, marginTop: 10, color: runMsg.startsWith("✓") ? "#16a34a" : "#dc2626" }}>
                {runMsg}
              </p>
            )}
          </div>
        )}

        {/* Historial */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: "#111827", margin: 0 }}>Historial de sincronizaciones</h2>
            <button onClick={loadLogs} style={{ fontSize: 12, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <RefreshCw size={11} /> Actualizar
            </button>
          </div>

          {logsLoading ? (
            <div style={{ color: "#9ca3af", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
              <Loader2 size={13} className="animate-spin" /> Cargando...
            </div>
          ) : logs.length === 0 ? (
            <div style={{ background: "#f9fafb", borderRadius: 10, padding: "24px 20px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
              Todavía no hay corridas registradas
            </div>
          ) : (
            <div style={{ border: "1px solid #f3f4f6", borderRadius: 12, overflow: "hidden" }}>
              {logs.map((log, i) => {
                const st = STATUS_LABEL[log.status] ?? { label: log.status, color: "#6b7280" };
                const duration = log.finished_at
                  ? Math.round((new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()) / 1000)
                  : null;
                return (
                  <div key={log.id} style={{
                    padding: "12px 16px",
                    background: i % 2 === 0 ? "white" : "#fafafa",
                    borderBottom: i < logs.length - 1 ? "1px solid #f3f4f6" : "none",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: st.color, background: `${st.color}15`, padding: "2px 8px", borderRadius: 20 }}>
                          {st.label}
                        </span>
                        <span style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>
                          {new Date(log.started_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span style={{ fontSize: 10, color: log.trigger === "manual" ? "#7c3aed" : "#9ca3af", background: log.trigger === "manual" ? "#f3e8ff" : "#f3f4f6", padding: "1px 6px", borderRadius: 8, fontWeight: 600 }}>
                          {log.trigger === "manual" ? "manual" : "auto"}
                        </span>
                        {duration !== null && (
                          <span style={{ fontSize: 11, color: "#9ca3af" }}>{duration}s</span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
                        <span style={{ color: "#16a34a", fontWeight: 700 }}>+{log.contacts_created} nuevos</span>
                        <span style={{ color: "#0369a1", fontWeight: 700 }}>↻ {log.contacts_updated} actualizados</span>
                        {log.errors_count > 0 && (
                          <span style={{ color: "#dc2626", fontWeight: 700 }}>⚠ {log.errors_count} errores</span>
                        )}
                      </div>
                    </div>
                    {log.error_detail && (
                      <pre style={{ fontSize: 11, color: "#dc2626", marginTop: 6, background: "#fef2f2", padding: "6px 10px", borderRadius: 6, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                        {log.error_detail}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function Section({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "white", border: "1px solid #f3f4f6", borderRadius: 12, padding: "18px 20px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <span style={{
          width: 24, height: 24, borderRadius: "50%", background: "#0ea5e9",
          color: "white", fontSize: 11, fontWeight: 900, display: "flex",
          alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
        }}>{num}</span>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: "#111827", margin: 0 }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}
