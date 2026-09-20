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
  cron_mode?: "recent" | "historic";
  from_date?: string;
  to_date?: string;
  total_processed?: number;
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
  
  // Config collapsible
  const [configExpanded, setConfigExpanded] = useState(false);

  // Run manual
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState("");
  // Run por rango
  const today = new Date().toISOString().split("T")[0];
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [rangeFrom, setRangeFrom] = useState(threeDaysAgo);
  const [rangeTo, setRangeTo] = useState(today);
  const [runningRange, setRunningRange] = useState(false);
  const [rangeMsg, setRangeMsg] = useState("");
  // CRON 2: Sync histórico hacia atrás en el tiempo
  const [runningHistoric, setRunningHistoric] = useState(false);
  const [historicMsg, setHistoricMsg] = useState("");
  const [oldestDate, setOldestDate] = useState<string | null>(null);
  const [lastHistoricRun, setLastHistoricRun] = useState<{ date: string; created: number; updated: number; skipped: number; total: number; from_date?: string; to_date?: string; status: string; error?: string } | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [runningLogStartTime, setRunningLogStartTime] = useState<Date | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  // Verificar que sea GALAS owner/team_leader antes de cargar config
  // Auto-refresh cada 5 segundos si hay un sync "running"
  useEffect(() => {
    const hasRunning = logs.some(log => log.status === "running");
    
    if (hasRunning) {
      // Inicia el auto-refresh
      if (!autoRefreshInterval) {
        const interval = setInterval(() => {
          loadLogs();
        }, 5000);
        setAutoRefreshInterval(interval);
      }
    } else {
      // Detiene el auto-refresh
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        setAutoRefreshInterval(null);
      }
    }
  }, [logs.filter(l => l.status === "running").length]);

  useEffect(() => {
    if (status !== "authenticated") return;
    
    fetch("/api/subscription")
      .then(r => r.json())
      .then(d => {
        const teamId = d.subscription?.teamId;
        const role = d.subscription?.teamRole;
        
        const isGalasTeam = teamId === "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93";
        const authorized = (role === "owner" || role === "team_leader") && isGalasTeam;
        
        if (!authorized) {
          router.replace("/");
          return;
        }
        
        setIsAuthorized(true);
      })
      .catch(() => {
        router.replace("/");
      });
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
        // Todos cerrados por defecto
        setExpandedGroups(new Set());
      } else setTagsError(d.error || "No se pudieron cargar las tags");
    } catch { setTagsError("Error de conexión con Tokko"); }
    setTagsLoading(false);
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const r = await fetch("/api/systeme/logs");
      const d = await r.json();
      if (d.logs) {
        setLogs(d.logs);
        // Detectar si hay algún log en estado "running"
        const runningLog = d.logs.find((log: SyncLog) => log.status === "running");
        if (runningLog && !runningLogStartTime) {
          // Inicia tracking de tiempo para este sync
          setRunningLogStartTime(new Date(runningLog.started_at));
        } else if (!runningLog && runningLogStartTime) {
          // El sync terminó
          setRunningLogStartTime(null);
        }
        // Extraer última ejecución de CRON 2 (historic)
        const lastHistoric = d.logs.find((log: SyncLog) => log.cron_mode === "historic");
        if (lastHistoric) {
          setLastHistoricRun({
            date: lastHistoric.started_at,
            created: lastHistoric.contacts_created,
            updated: lastHistoric.contacts_updated,
            skipped: lastHistoric.contacts_skipped,
            total: lastHistoric.total_processed ?? (lastHistoric.contacts_created + lastHistoric.contacts_updated + lastHistoric.contacts_skipped),
            from_date: lastHistoric.from_date,
            to_date: lastHistoric.to_date,
            status: lastHistoric.status,
            error: lastHistoric.error_detail
          });
        }
      }
      if (d.oldestSyncedDate) setOldestDate(d.oldestSyncedDate);
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

  const handleRunRange = async () => {
    if (!rangeFrom) { setRangeMsg("✗ Elegí una fecha desde"); return; }
    if (rangeTo && rangeFrom > rangeTo) { setRangeMsg("✗ Desde debe ser menor o igual a Hasta"); return; }
    setRunningRange(true); setRangeMsg("");
    try {
      const r = await fetch("/api/systeme/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromDate: rangeFrom, toDate: rangeTo || undefined }),
      });
      const d = await r.json();
      if (d.ok) {
        setRangeMsg(`✓ Corrida completada (${rangeFrom}${rangeTo ? ` → ${rangeTo}` : ""}) — ${d.created} creados · ${d.updated} actualizados${d.errors > 0 ? ` · ${d.errors} errores` : ""}`);
        await loadLogs();
      } else {
        setRangeMsg(`✗ ${d.error || "Error"}`);
      }
    } catch { setRangeMsg("✗ Error de conexión"); }
    setRunningRange(false);
  };

  const handleRunHistoric = async () => {
    setRunningHistoric(true); setHistoricMsg("");
    try {
      const r = await fetch("/api/systeme/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cronMode: "historic" }),
      });
      const d = await r.json();
      if (d.ok) {
        setHistoricMsg(`✓ Sync histórico iniciado${oldestDate ? ` desde ${oldestDate}` : ""}... Consultá los logs para el resultado.`);
        await loadLogs();
      } else {
        setHistoricMsg(`✗ ${d.error || "Error"}`);
      }
    } catch { setHistoricMsg("✗ Error de conexión"); }
    setRunningHistoric(false);
  };

  const handleCleanupStuck = async () => {
    setRunningHistoric(true);
    try {
      const r = await fetch("/api/systeme/cleanup-stuck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const d = await r.json();
      if (r.ok) {
        setHistoricMsg(`✓ ${d.message} (${d.cleaned} log/s marcado/s como error). Reintentando sincronización...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        await loadLogs();
        await handleRunHistoric();
      } else {
        setHistoricMsg(`✗ ${d.error || "Error al limpiar"}`);
      }
    } catch { setHistoricMsg("✗ Error de conexión"); }
    setRunningHistoric(false);
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

        {/* MODO CONFIGURADO: Dashboard limpio */}
        {config?.isConfigured && (
          <>
            {/* Botones de acción */}
            <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
              <button
                onClick={handleRunNow}
                disabled={running}
                style={{
                  padding: "10px 18px", borderRadius: 8, fontSize: 14, fontWeight: 700,
                  background: "#111827", color: "white", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6, opacity: running ? 0.6 : 1,
                }}>
                {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {running ? "Sincronizando..." : "Sincronizar ahora"}
              </button>

              <button
                onClick={lastHistoricRun && lastHistoricRun.status === "running" ? handleCleanupStuck : handleRunHistoric}
                disabled={runningHistoric}
                style={{
                  padding: "10px 18px", borderRadius: 8, fontSize: 14, fontWeight: 700,
                  background: lastHistoricRun && lastHistoricRun.status === "running" ? "#dc2626" : "#7c3aed", 
                  color: "white", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6, opacity: runningHistoric ? 0.6 : 1,
                }}>
                {runningHistoric ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {runningHistoric ? "Procesando..." : lastHistoricRun && lastHistoricRun.status === "running" ? "🔧 Limpiar & reintentar" : "Sincronizar histórico"}
              </button>
              
              <button
                onClick={() => setConfigExpanded(!configExpanded)}
                style={{
                  padding: "10px 18px", borderRadius: 8, fontSize: 14, fontWeight: 700,
                  background: "#f9fafb", color: "#374151", border: "1px solid #e5e7eb", 
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                }}>
                ⚙ Configuración
              </button>
            </div>

            {/* Config collapsible */}
            {configExpanded && (
              <div style={{
                background: "white", border: "1px solid #f3f4f6", borderRadius: 12,
                padding: "20px", marginBottom: 20,
              }}>
                {/* API key */}
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: "0 0 12px" }}>API key de Systeme.io</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, color: "#374151", fontFamily: "monospace", flex: 1 }}>{config.keyPreview}</span>
                    <button
                      onClick={() => setConfig(prev => prev ? { ...prev, hasKey: false, keyPreview: null } : prev)}
                      style={{ fontSize: 12, color: BRAND, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                      Cambiar
                    </button>
                  </div>
                </div>

                {/* Tags a sincronizar */}
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: "0 0 12px" }}>Tags a sincronizar (mín. {MIN_TAGS})</h3>
                  {tagsLoading ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#9ca3af", fontSize: 13 }}>
                      <Loader2 size={14} className="animate-spin" /> Cargando tags...
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

                      {/* Grupos expandibles */}
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

                      {/* Contador */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: selectedTags.size >= MIN_TAGS ? "#16a34a" : "#dc2626" }}>
                          {selectedTags.size} seleccionada{selectedTags.size !== 1 ? "s" : ""} · mínimo {MIN_TAGS}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tags fijas */}
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: "0 0 12px" }}>Tags fijas (se asignan siempre)</h3>
                  {fixedTags.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                      {fixedTags.map(tag => (
                        <span
                          key={tag}
                          style={{
                            fontSize: 12, fontWeight: 600, color: "#16a34a",
                            background: "#dffce7", padding: "4px 10px", borderRadius: 6,
                          }}>
                          {tag} <span style={{ marginLeft: 6, cursor: "pointer" }} onClick={() => {
                            setFixedTags(prev => prev.filter(t => t !== tag));
                          }}>×</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 10 }}>No hay tags fijas</p>
                  )}
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      value={newFixedTag}
                      onChange={e => setNewFixedTag(e.target.value)}
                      placeholder="Agregar tag fija..."
                      onKeyDown={e => {
                        if (e.key === "Enter" && newFixedTag.trim()) {
                          if (!fixedTags.includes(newFixedTag.trim())) {
                            setFixedTags([...fixedTags, newFixedTag.trim()]);
                          }
                          setNewFixedTag("");
                        }
                      }}
                      style={{
                        flex: 1, padding: "8px 12px", borderRadius: 6,
                        border: "1px solid #e5e7eb", fontSize: 13, outline: "none", boxSizing: "border-box",
                      }}
                    />
                    <button
                      onClick={() => {
                        if (newFixedTag.trim() && !fixedTags.includes(newFixedTag.trim())) {
                          setFixedTags([...fixedTags, newFixedTag.trim()]);
                          setNewFixedTag("");
                        }
                      }}
                      style={{
                        padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600,
                        background: BRAND, color: "white", border: "none", cursor: "pointer",
                      }}>
                      Agregar
                    </button>
                  </div>
                </div>

                {/* Guardar */}
                <button
                  onClick={handleSave}
                  disabled={!canSave || saving}
                  style={{
                    width: "100%", padding: "11px 14px", borderRadius: 8, fontSize: 14, fontWeight: 700,
                    background: canSave ? BRAND : "#e5e7eb",
                    color: canSave ? "white" : "#9ca3af",
                    border: "none", cursor: canSave ? "pointer" : "not-allowed",
                    opacity: saving ? 0.7 : 1,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            )}

            {/* Sincronizar por rango */}
            <div style={{
              background: "#f9fafb", border: "1px solid #f3f4f6",
              borderRadius: 12, padding: "16px 20px", marginBottom: 20,
            }}>
              <div style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#374151", margin: 0 }}>Sincronizar por rango de fechas</p>
                <p style={{ fontSize: 12, color: "#9ca3af", margin: "2px 0 0" }}>
                  Útil para recuperar gaps históricos o forzar resincronización de un período específico
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>Desde</label>
                  <input
                    type="date"
                    value={rangeFrom}
                    onChange={e => setRangeFrom(e.target.value)}
                    max={today}
                    style={{
                      padding: "7px 10px", borderRadius: 6, fontSize: 13,
                      border: "1px solid #d1d5db", background: "white", outline: "none", boxSizing: "border-box",
                    }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>Hasta (opcional)</label>
                  <input
                    type="date"
                    value={rangeTo}
                    onChange={e => setRangeTo(e.target.value)}
                    max={today}
                    style={{
                      padding: "7px 10px", borderRadius: 6, fontSize: 13,
                      border: "1px solid #d1d5db", background: "white", outline: "none", boxSizing: "border-box",
                    }}
                  />
                </div>
                <button
                  onClick={handleRunRange}
                  disabled={runningRange}
                  style={{
                    padding: "9px 18px", borderRadius: 6, fontSize: 13, fontWeight: 700,
                    background: "#0ea5e9", color: "white", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6, opacity: runningRange ? 0.6 : 1,
                    marginTop: 17,
                  }}>
                  {runningRange ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                  {runningRange ? "Sincronizando..." : "Sincronizar rango"}
                </button>
              </div>
              {rangeMsg && (
                <p style={{ fontSize: 13, fontWeight: 600, marginTop: 10, color: rangeMsg.startsWith("✓") ? "#16a34a" : "#dc2626" }}>
                  {rangeMsg}
                </p>
              )}
              {historicMsg && (
                <p style={{ fontSize: 13, fontWeight: 600, marginTop: 10, color: historicMsg.startsWith("✓") ? "#16a34a" : "#dc2626" }}>
                  {historicMsg}
                </p>
              )}
            </div>
          </>
        )}

        {/* MODO NO CONFIGURADO: Setup steps */}
        {!config?.isConfigured && (
          <>
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
        </>
        )}

        {/* Historial (siempre visible) */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: "#111827", margin: 0 }}>Historial de sincronizaciones</h2>
            <button onClick={loadLogs} style={{ fontSize: 12, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <RefreshCw size={11} /> Actualizar
            </button>
          </div>

          {oldestDate && (() => {
            const [year, month, day] = oldestDate.split('-');
            const formatted = `${day}/${month}/${year}`;
            return (
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12, padding: "8px 12px", background: "#f9fafb", borderRadius: 8 }}>
                📅 Fecha más antigua sincronizada: <strong>{formatted}</strong> (CRON 2 retrocede desde aquí)
              </div>
            );
          })()}

          {lastHistoricRun && (
            <div style={{ 
              background: lastHistoricRun.status === "success" ? "#f0f9ff" : lastHistoricRun.status === "error" ? "#fef2f2" : "#fef3c7",
              border: lastHistoricRun.status === "success" ? "1px solid #bfdbfe" : lastHistoricRun.status === "error" ? "1px solid #fecaca" : "1px solid #fde68a",
              borderRadius: 10, 
              padding: "12px 14px", 
              marginBottom: 14, 
              fontSize: 12
            }}>
              <div style={{ color: lastHistoricRun.status === "success" ? "#0c4a6e" : lastHistoricRun.status === "error" ? "#7f1d1d" : "#92400e", fontWeight: 700, marginBottom: 8 }}>
                🔄 Última sincronización histórica (CRON 2)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, color: lastHistoricRun.status === "success" ? "#0c4a6e" : lastHistoricRun.status === "error" ? "#7f1d1d" : "#92400e", fontSize: 11 }}>
                <div><strong>Cuándo:</strong> {new Date(lastHistoricRun.date).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
                {lastHistoricRun.from_date && lastHistoricRun.to_date && (() => {
                  const formatDate = (dateStr: string) => {
                    const [year, month, day] = dateStr.split('-');
                    return `${day}/${month}/${year}`;
                  };
                  return <div><strong>Período sincronizado:</strong> {formatDate(lastHistoricRun.from_date!)} → {formatDate(lastHistoricRun.to_date!)}</div>;
                })()}
                {lastHistoricRun.total > 0 && (
                  <div><strong>Resultado:</strong> {lastHistoricRun.total} contactos procesados (+{lastHistoricRun.created} nuevos, ↻ {lastHistoricRun.updated} actualizados, ↷ {lastHistoricRun.skipped} omitidos)</div>
                )}
                {lastHistoricRun.total === 0 && (
                  <div><strong>Resultado:</strong> Sin contactos en este período (0 procesados)</div>
                )}
                <div><strong>Estado:</strong> <span style={{ fontWeight: 700, color: lastHistoricRun.status === "success" ? "#16a34a" : lastHistoricRun.status === "error" ? "#dc2626" : "#d97706" }}>
                  {lastHistoricRun.status === "success" ? "✓ Exitosa" : lastHistoricRun.status === "error" ? "✗ Error" : "⚠ Parcial"}
                </span></div>
                {oldestDate && (() => {
                  const [year, month, day] = oldestDate.split('-');
                  const nextDate = new Date(new Date(`${oldestDate}T00:00:00Z`).getTime() - 7 * 24 * 60 * 60 * 1000);
                  const formatted = `${String(nextDate.getUTCDate()).padStart(2, '0')}/${String(nextDate.getUTCMonth() + 1).padStart(2, '0')}/${nextDate.getUTCFullYear()}`;
                  return <div><strong>Próxima ventana:</strong> {formatted}</div>;
                })()}
                {lastHistoricRun.error && (
                  <pre style={{ fontSize: 10, color: "#dc2626", marginTop: 6, background: "#fef2f2", padding: "4px 8px", borderRadius: 4, whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0 }}>
                    {lastHistoricRun.error}
                  </pre>
                )}
              </div>
            </div>
          )}

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
                const isRunning = log.status === "running";
                const duration = log.finished_at
                  ? Math.round((new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()) / 1000)
                  : isRunning && runningLogStartTime
                  ? Math.round((new Date().getTime() - new Date(log.started_at).getTime()) / 1000)
                  : null;
                return (
                  <div key={log.id} style={{
                    padding: "12px 16px",
                    background: isRunning ? "#f0f9ff" : i % 2 === 0 ? "white" : "#fafafa",
                    borderBottom: i < logs.length - 1 ? "1px solid #f3f4f6" : "none",
                    borderLeft: isRunning ? `4px solid ${st.color}` : "none",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, color: st.color, background: `${st.color}15`, padding: "2px 8px", borderRadius: 20 }}>
                          {isRunning && <Loader2 size={10} className="animate-spin" />}
                          {st.label}
                        </span>
                        <span style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>
                          {new Date(log.started_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span style={{ fontSize: 10, color: log.trigger === "manual" ? "#7c3aed" : "#9ca3af", background: log.trigger === "manual" ? "#f3e8ff" : "#f3f4f6", padding: "1px 6px", borderRadius: 8, fontWeight: 600 }}>
                          {log.trigger === "manual" ? "manual" : log.cron_mode ? (log.cron_mode === "historic" ? "cron2" : "cron1") : "auto"}
                        </span>
                        {duration !== null && (
                          <span style={{ fontSize: 11, color: isRunning ? st.color : "#9ca3af", fontWeight: isRunning ? 700 : 400 }}>
                            ⏱ {duration}s {isRunning && "en progreso"}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
                        {isRunning ? (
                          <span style={{ color: "#0369a1", fontStyle: "italic" }}>Sincronizando... por favor espera</span>
                        ) : (
                          <>
                            <span style={{ color: "#16a34a", fontWeight: 700 }}>+{log.contacts_created} nuevos</span>
                            <span style={{ color: "#0369a1", fontWeight: 700 }}>↻ {log.contacts_updated} actualizados</span>
                            {log.contacts_skipped > 0 && (
                              <span style={{ color: "#9ca3af", fontWeight: 600 }}>⊘ {log.contacts_skipped} omitidos</span>
                            )}
                            {log.errors_count > 0 && (
                              <span style={{ color: "#dc2626", fontWeight: 700 }}>⚠ {log.errors_count} errores</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    {isRunning && (
                      <div style={{ fontSize: 12, color: "#0369a1", marginTop: 8, padding: "8px 10px", background: "#e0f2fe", borderRadius: 6 }}>
                        ✓ El sync está corriendo en background. El dashboard se actualiza automáticamente cada 5 segundos.
                      </div>
                    )}
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
