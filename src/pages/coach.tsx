import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Head from "next/head";
import AppLayout from "../components/AppLayout";
import { Brain, RefreshCw, Mail, CheckCircle, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

const RED = "#aa0000";

function localDateStr(d: Date) { return d.toISOString().slice(0, 10); }

function getMonday(weekOffset = 0) {
  const now = new Date();
  const diff = (now.getDay() === 0 ? -6 : 1 - now.getDay()) + weekOffset * 7;
  const mon = new Date(now); mon.setDate(now.getDate() + diff); mon.setHours(0, 0, 0, 0);
  return mon;
}

const profileLabel: Record<string, string> = {
  semana_productiva: "Período productivo",
  semana_ocupada: "Ocupado, poco productivo",
  semana_reactiva: "Período reactivo",
  semana_riesgo: "Riesgo comercial",
  semana_sin_actividad: "Sin actividad",
};
const profileColor: Record<string, string> = {
  semana_productiva: "#16a34a",
  semana_ocupada: "#d97706",
  semana_reactiva: "#7c3aed",
  semana_riesgo: RED,
  semana_sin_actividad: "#9ca3af",
};
const sectionConfig = [
  { label: "Lo que hiciste bien", icon: "✓", color: "#16a34a", bg: "#f0fdf4" },
  { label: "Dónde perdés oportunidades", icon: "↓", color: "#d97706", bg: "#FFFBEB" },
  { label: "La acción para esta semana", icon: "→", color: RED, bg: "#fef2f2" },
];

export default function CoachPage() {
  const { status } = useSession();
  const router = useRouter();
  const [calData, setCalData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState<"week" | "month">("week");
  const [advice, setAdvice] = useState("");
  const [profile, setProfile] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/calendar/cached?days=90")
      .then(r => r.ok ? r.json() : null)
      .then(d => { setCalData(d); setLoading(false); })
      .catch(() => setLoading(false));
    // Load report history
    fetch("/api/coach-history")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.reports) setHistory(d.reports); })
      .catch(() => {});
  }, [status]);

  const { periodStart, periodEnd, periodLabel, goal } = useMemo(() => {
    const weeklyGoal = calData?.totals?.iacGoal ?? 15;
    if (view === "week") {
      const mon = getMonday(weekOffset);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return {
        periodStart: localDateStr(mon),
        periodEnd: localDateStr(sun),
        periodLabel: weekOffset === 0 ? "Esta semana"
          : weekOffset === -1 ? "Semana pasada"
          : `Sem. ${mon.getDate()}/${mon.getMonth() + 1}`,
        goal: weeklyGoal,
      };
    } else {
      const now = new Date();
      const target = new Date(now.getFullYear(), now.getMonth() + weekOffset, 1);
      return {
        periodStart: localDateStr(new Date(target.getFullYear(), target.getMonth(), 1)),
        periodEnd: localDateStr(new Date(target.getFullYear(), target.getMonth() + 1, 0)),
        periodLabel: target.toLocaleDateString("es-AR", { month: "long", year: "numeric" }),
        goal: weeklyGoal * 4,
      };
    }
  }, [view, weekOffset, calData]);

  // Auto-fetch cached report on period change
  useEffect(() => {
    if (!periodStart || !calData) return;
    setAdvice(""); setProfile(""); setFromCache(false);
    fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dailySummaries: calData.dailySummaries,
        productivityGoal: calData.productivityGoal,
        userName: calData.user?.name,
        periodStart, periodEnd, calView: view, goal, periodLabel,
        forceRegenerate: false, checkCacheOnly: true,
      }),
    }).then(r => r.json()).then(d => {
      if (d.fromCache && d.advice) {
        setAdvice(d.advice); setProfile(d.profile || "");
        setFromCache(true); setIsClosed(d.isClosed || false);
      }
    }).catch(() => {});
  }, [periodStart, periodEnd, calData]);

  const analyze = async (force = false) => {
    if (!calData) return;
    setAnalyzing(true); setAdvice(""); setProfile("");
    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dailySummaries: calData.dailySummaries,
        productivityGoal: calData.productivityGoal,
        userName: calData.user?.name,
        periodStart, periodEnd, calView: view, goal, periodLabel,
        forceRegenerate: force,
      }),
    });
    const d = await res.json();
    setAdvice(d.advice || ""); setProfile(d.profile || "");
    setFromCache(d.fromCache || false); setIsClosed(d.isClosed || false);
    setAnalyzing(false);
  };

  const sendTestEmail = async () => {
    setEmailSending(true);
    const r = await fetch("/api/send-test-email", { method: "POST" });
    const d = await r.json();
    if (d.ok) { setEmailSent(true); setTimeout(() => setEmailSent(false), 3000); }
    setEmailSending(false);
  };

  const periodSummaries = calData?.dailySummaries?.filter((d: any) => d.date >= periodStart && d.date <= periodEnd) ?? [];
  const periodGreen = periodSummaries.flatMap((d: any) => d.events ?? []).filter((e: any) => e.isGreen).length;
  const periodActiveDays = periodSummaries.filter((d: any) => d.greenCount > 0).length;
  const periodPct = Math.min(100, Math.round((periodGreen / goal) * 100));
  const barColor = periodPct >= 100 ? "#16a34a" : periodPct >= 67 ? "#d97706" : RED;

  const blocks = advice ? advice.split(/\n\n+/).filter(b => b.trim()) : [];
  const lastBlock = blocks[blocks.length - 1] || "";
  const isNumeroCritico = lastBlock.toLowerCase().startsWith("número crítico");
  const sections = isNumeroCritico ? blocks.slice(0, -1) : blocks;
  const numeroCritico = isNumeroCritico ? lastBlock : "";

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  })();

  if (loading) return (
    <AppLayout><div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div style={{ fontSize: 13, color: "#9ca3af" }}>Cargando coach...</div>
    </div></AppLayout>
  );

  return (
    <AppLayout greeting={greeting}>
      <Head><title>Inmo Coach — InmoCoach</title></Head>

      <style>{`
        .coach-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }
        @media (max-width: 900px) { .coach-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ padding: "24px 24px 60px" }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#111827", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Brain size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 500, color: "#111827", fontFamily: "Georgia, serif" }}>Inmo Coach</div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Tu análisis personalizado de actividad comercial</div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          {/* View toggle */}
          <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 9, padding: 3, gap: 2 }}>
            {(["week", "month"] as const).map(v => (
              <button key={v} onClick={() => { setView(v); setWeekOffset(0); }} style={{
                background: view === v ? "#fff" : "transparent",
                color: view === v ? "#111827" : "#9ca3af",
                boxShadow: view === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                borderRadius: 7, padding: "5px 14px", fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer"
              }}>{v === "week" ? "Semana" : "Mes"}</button>
            ))}
          </div>
          {/* Period nav */}
          <button onClick={() => setWeekOffset(w => w - 1)} style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 8, width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronLeft size={14} color="#6b7280" />
          </button>
          <span style={{ fontSize: 13, fontWeight: 500, color: "#374151", minWidth: 120, textAlign: "center" }}>{periodLabel}</span>
          <button onClick={() => setWeekOffset(w => w + 1)} disabled={weekOffset >= 0} style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 8, width: 30, height: 30, cursor: weekOffset >= 0 ? "not-allowed" : "pointer", opacity: weekOffset >= 0 ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronRight size={14} color="#6b7280" />
          </button>
          {weekOffset !== 0 && <button onClick={() => setWeekOffset(0)} style={{ fontSize: 12, color: RED, background: "none", border: "none", cursor: "pointer" }}>Hoy</button>}

          {/* Actions */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={sendTestEmail} disabled={emailSending || emailSent} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: emailSent ? "#16a34a" : "#6b7280", background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "7px 12px", cursor: "pointer" }}>
              {emailSending ? <Loader2 size={12} className="animate-spin" /> : emailSent ? <CheckCircle size={12} /> : <Mail size={12} />}
              {emailSent ? "Enviado" : "Mail de prueba"}
            </button>
            <button onClick={() => analyze(true)} disabled={analyzing} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#fff", background: RED, border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontWeight: 500 }}>
              {analyzing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {analyzing ? "Analizando..." : advice ? "Regenerar" : "Analizar"}
            </button>
          </div>
        </div>

        <div className="coach-grid">

          {/* Análisis principal */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {!advice && !analyzing && (
              <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, padding: 24 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
                  {[
                    { label: "Reuniones comerciales", value: periodGreen },
                    { label: "Días con actividad", value: periodActiveDays },
                    { label: "Objetivo del período", value: goal },
                  ].map(k => (
                    <div key={k.label} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 36, fontWeight: 500, fontFamily: "Georgia, serif", color: "#111827" }}>{k.value}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{k.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ height: 6, background: "#f3f4f6", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ height: "100%", background: barColor, borderRadius: 3, width: `${periodPct}%` }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>0</span>
                  <span style={{ fontSize: 11, color: barColor, fontWeight: 500 }}>{periodPct}% del objetivo</span>
                </div>
                <div style={{ marginTop: 20, textAlign: "center" }}>
                  <button onClick={() => analyze(false)} style={{ background: "#111827", color: "#fff", border: "none", borderRadius: 10, padding: "12px 28px", fontSize: 14, fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <Brain size={16} /> Analizar con Inmo Coach
                  </button>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>El análisis tarda unos segundos</div>
                </div>
              </div>
            )}

            {analyzing && (
              <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, padding: "48px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>✦</div>
                <div style={{ fontSize: 14, color: "#374151", fontWeight: 500 }}>Inmo Coach está analizando...</div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>Procesando tu actividad comercial</div>
              </div>
            )}

            {advice && !analyzing && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Profile badge */}
                {profile && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, padding: "5px 12px", borderRadius: 8, background: profileColor[profile] + "15", color: profileColor[profile] }}>
                      {profileLabel[profile] || profile}
                    </span>
                    {fromCache && (
                      <span style={{ fontSize: 11, color: "#9ca3af", background: "#f3f4f6", borderRadius: 6, padding: "3px 8px" }}>
                        ✓ Guardado {!isClosed && <button onClick={() => analyze(true)} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", textDecoration: "underline", fontSize: 11 }}>actualizar</button>}
                      </span>
                    )}
                  </div>
                )}

                {/* Sections */}
                {sections.map((block, i) => {
                  const cfg = sectionConfig[i] || { label: "", icon: "→", color: "#374151", bg: "#f9fafb" };
                  return (
                    <div key={i} style={{ background: cfg.bg, borderRadius: 14, padding: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: cfg.color, marginBottom: 10 }}>
                        {cfg.icon} {cfg.label}
                      </div>
                      <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.75, margin: 0 }}>{block.trim()}</p>
                    </div>
                  );
                })}

                {numeroCritico && (
                  <div style={{ background: "#f9fafb", borderRadius: 12, padding: "12px 16px", borderLeft: "3px solid #e5e7eb" }}>
                    <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>{numeroCritico}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar — historial de reportes */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Métricas rápidas */}
            <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>Este período</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Reuniones", value: periodGreen, color: barColor },
                  { label: "Días activos", value: periodActiveDays, color: "#374151" },
                  { label: "IAC", value: `${periodPct}%`, color: barColor },
                  { label: "Meta", value: goal, color: "#9ca3af" },
                ].map(k => (
                  <div key={k.label} style={{ background: "#f9fafb", borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ fontSize: 18, fontWeight: 500, fontFamily: "Georgia, serif", color: k.color }}>{k.value}</div>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{k.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Historial */}
            {history.length > 0 && (
              <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #f3f4f6" }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: "#374151" }}>Reportes guardados</div>
                </div>
                <div style={{ maxHeight: 340, overflowY: "auto" }}>
                  {history.map((r: any, i: number) => (
                    <div key={i} style={{ padding: "10px 16px", borderBottom: "0.5px solid #f9fafb", cursor: "pointer" }}
                      onClick={() => {
                        setAdvice(r.advice); setProfile(r.profile || "");
                        setFromCache(true); setIsClosed(true);
                        const start = new Date(r.period_key.replace("week-", "").replace("month-", "") + "-01");
                        setView(r.period_key.startsWith("week") ? "week" : "month");
                      }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>
                        {r.period_key?.startsWith("week") ? "Sem." : "Mes"} {r.period_key?.slice(5, 12)}
                      </div>
                      {r.profile && (
                        <div style={{ fontSize: 11, color: profileColor[r.profile] || "#9ca3af", marginTop: 2 }}>
                          {profileLabel[r.profile] || r.profile}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info */}
            <div style={{ background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 8 }}>Sobre Inmo Coach</div>
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.7 }}>
                Analiza tus reuniones cara a cara del período, tu historial y tu cartera en Tokko para darte un diagnóstico honesto y una acción concreta.
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
