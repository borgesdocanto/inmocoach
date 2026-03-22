import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState, useMemo } from "react";
import Head from "next/head";
import RankBadge from "../../components/RankBadge";
import StreakBadge from "../../components/StreakBadge";
import TokkoPortfolio from "../../components/TokkoPortfolio";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from "recharts";
import { ArrowLeft, RefreshCw, AlertTriangle, Calendar, Target, Eye, Zap, TrendingUp, Brain, ChevronLeft, ChevronRight, Loader2, DollarSign } from "lucide-react";

// Fecha local en formato YYYY-MM-DD (evita desfase UTC en Argentina después de las 21:00)
function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}


const RED = "#aa0000";
const GREEN = "#16a34a";

interface CalendarEvent { id: string; title: string; type: string; isGreen: boolean; isOrganizer: boolean; start: string; end?: string; isProceso?: boolean; isCierre?: boolean; }
interface DaySummary { date: string; greenCount: number; isProductive: boolean; events: CalendarEvent[]; }
interface CalendarData {
  user: { name: string; email: string; image?: string };
  syncedAt: string;
  totals: { tasaciones: number; primerasVisitas: number; fotosVideo: number; visitas: number; propuestas: number; firmas: number; reuniones: number; procesosNuevos: number; totalGreen: number; totalEvents: number; iac: number; iacGoal: number; procesosGoal: number; };
  productivityGoal: number;
  productiveDays: number;
  totalDays: number;
  productivityRate: number;
  dailySummaries: DaySummary[];
  recentEvents: CalendarEvent[];
  streak?: { current: number; best: number; todayActive: boolean; lastActiveDate: string | null };
  rankStats?: any;
}

function formatHour(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function KpiCard({ label, value, sub, accent, delay = 0, tooltip }: any) {
  const [show, setShow] = useState(false);
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 relative overflow-visible" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{label}</div>
        {tooltip && (
          <button onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} onTouchStart={() => setShow(s => !s)}
            className="w-4 h-4 rounded-full border border-gray-200 text-gray-400 text-xs flex items-center justify-center shrink-0 hover:border-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Más info">?</button>
        )}
      </div>
      <div className="text-4xl font-black leading-none" style={{ color: accent ? RED : "#111827", fontFamily: "Georgia, serif" }}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-2">{sub}</div>}
      {tooltip && show && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 px-1">
          <div className="bg-gray-900 text-white text-xs rounded-xl px-3 py-2.5 leading-relaxed shadow-xl">{tooltip}</div>
        </div>
      )}
    </div>
  );
}

function WeeklyView({ summaries, weekOffset, onPrev, onNext }: { summaries: DaySummary[]; weekOffset: number; onPrev: () => void; onNext: () => void; }) {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(startOfWeek); d.setDate(startOfWeek.getDate() + i); return d; });
  const byDate = useMemo(() => { const m: Record<string, DaySummary> = {}; summaries.forEach(s => { m[s.date] = s; }); return m; }, [summaries]);
  const weekLabel = `${days[0].toLocaleDateString("es-AR", { day: "numeric", month: "short" })} — ${days[6].toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}`;
  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <span className="text-sm font-bold text-gray-700">{weekLabel}</span>
        <div className="flex items-center gap-1">
          <button onClick={onPrev} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"><ChevronLeft size={14} className="text-gray-500" /></button>
          <button onClick={onNext} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"><ChevronRight size={14} className="text-gray-500" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 divide-x divide-gray-100 min-h-[320px]">
        {days.map((day, i) => {
          const dateStr = localDateStr(day);
          const summary = byDate[dateStr];
          const isToday = dateStr === localDateStr(today);
          return (
            <div key={dateStr} className="flex flex-col">
              <div className="px-2 py-2 text-center border-b border-gray-100">
                <div className="text-xs font-semibold text-gray-400 uppercase">{dayNames[i]}</div>
                <div className={`text-sm font-black mt-0.5 w-7 h-7 rounded-full flex items-center justify-center mx-auto ${isToday ? "text-white" : "text-gray-700"}`} style={{ background: isToday ? RED : "transparent" }}>{day.getDate()}</div>
                {summary && <div className="mt-1 text-xs font-bold" style={{ color: summary.isProductive ? GREEN : "#9ca3af" }}>{summary.greenCount}✦</div>}
              </div>
              <div className="flex-1 p-1 space-y-1 overflow-y-auto max-h-60">
                {summary?.events.map(ev => (
                  <div key={ev.id} className={`text-xs px-2 py-1.5 rounded-md font-medium truncate border-l-2 ${ev.isGreen ? "bg-green-50 border-green-400 text-green-800" : "bg-gray-50 border-gray-200 text-gray-400"}`}
                    title={ev.title}>
                    {ev.start.includes("T") && <span className={`text-xs mr-1 ${ev.isGreen ? "text-green-600" : "text-gray-300"}`}>{formatHour(ev.start)}</span>}
                    {ev.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthlyView({ summaries, monthOffset, onPrev, onNext }: { summaries: DaySummary[]; monthOffset: number; onPrev: () => void; onNext: () => void; }) {
  const today = new Date();
  const target = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = target.getFullYear(); const month = target.getMonth();
  const firstDay = new Date(year, month, 1); const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((startPad + lastDay.getDate()) / 7) * 7;
  const byDate = useMemo(() => { const m: Record<string, DaySummary> = {}; summaries.forEach(s => { m[s.date] = s; }); return m; }, [summaries]);
  const monthLabel = target.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <span className="text-sm font-bold text-gray-700 capitalize">{monthLabel}</span>
        <div className="flex gap-1">
          <button onClick={onPrev} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"><ChevronLeft size={14} className="text-gray-500" /></button>
          <button onClick={onNext} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"><ChevronRight size={14} className="text-gray-500" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-gray-100">{dayNames.map(d => <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2 uppercase">{d}</div>)}</div>
      <div className="grid grid-cols-7 divide-x divide-y divide-gray-100">
        {Array.from({ length: totalCells }, (_, i) => {
          const dayNum = i - startPad + 1;
          if (dayNum < 1 || dayNum > lastDay.getDate()) return <div key={i} className="h-20 bg-gray-50/50" />;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
          const summary = byDate[dateStr];
          const isToday = dateStr === localDateStr(today);
          const greenEvs = summary?.events.filter(e => e.isGreen) ?? [];
          const grayEvs = summary?.events.filter(e => !e.isGreen) ?? [];
          return (
            <div key={dateStr} className={`h-20 p-1.5 flex flex-col ${isToday ? "bg-red-50" : ""}`}>
              <div className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center mb-1 ${isToday ? "text-white" : "text-gray-600"}`} style={{ background: isToday ? RED : "transparent" }}>{dayNum}</div>
              <div className="flex-1 overflow-hidden space-y-0.5">
                {greenEvs.slice(0, 2).map(ev => <div key={ev.id} className="text-xs bg-green-100 text-green-800 rounded px-1 truncate font-medium leading-tight py-0.5" title={ev.title}>{ev.title}</div>)}
                {grayEvs.slice(0, 1).map(ev => <div key={ev.id} className="text-xs bg-gray-100 text-gray-400 rounded px-1 truncate leading-tight py-0.5" title={ev.title}>{ev.title}</div>)}
                {(greenEvs.length + grayEvs.length) > 3 && <div className="text-xs text-gray-300 font-medium">+{greenEvs.length + grayEvs.length - 3} más</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CoachPanel({ data, calView, monthOffset, weekOffset, agentEmail }: { data: CalendarData; calView: "week" | "month"; monthOffset: number; weekOffset: number; agentEmail: string }) {
  const [advice, setAdvice] = useState("");
  const [profile, setProfile] = useState("");
  const [loading, setLoading] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [isClosed, setIsClosed] = useState(false);

  useEffect(() => { setAdvice(""); setProfile(""); setFromCache(false); setIsClosed(false); }, [calView, monthOffset, weekOffset]);

  const today = new Date();
  const { periodStart, periodEnd, periodLabel, goal, goalLabel } = useMemo(() => {
    if (calView === "week") {
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
      const weekLabel = weekOffset === 0 ? "esta semana" : `semana del ${monday.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}`;
      return { periodStart: localDateStr(monday), periodEnd: localDateStr(sunday), periodLabel: weekLabel, goal: 15, goalLabel: "meta semanal" };
    } else {
      const target = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
      const firstDay = new Date(target.getFullYear(), target.getMonth(), 1);
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0);
      const monthName = target.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
      return { periodStart: localDateStr(firstDay), periodEnd: localDateStr(lastDay), periodLabel: monthName, goal: 60, goalLabel: "meta mensual (15×4)" };
    }
  }, [calView, monthOffset, weekOffset]);

  const periodSummaries = data.dailySummaries.filter(d => d.date >= periodStart && d.date <= periodEnd);
  const periodGreen = periodSummaries.flatMap(d => d.events).filter(e => e.isGreen).length;
  const periodActiveDays = periodSummaries.filter(d => d.greenCount > 0).length;
  const periodPct = Math.min(100, Math.round((periodGreen / goal) * 100));
  const barColor = periodPct >= 100 ? "#16a34a" : periodPct >= 50 ? "#b45309" : RED;

  useEffect(() => {
    if (!periodStart) return;
    let cancelled = false;
    const fetchCached = async () => {
      try {
        const res = await fetch("/api/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dailySummaries: data.dailySummaries, productivityGoal: data.productivityGoal, userName: data.user.name, periodStart, periodEnd, calView, goal, periodLabel, forceRegenerate: false, checkCacheOnly: true }),
        });
        const json = await res.json();
        if (cancelled) return;
        if (json.fromCache && json.advice) { setAdvice(json.advice); setProfile(json.profile || ""); setFromCache(true); setIsClosed(json.isClosed || false); }
      } catch {}
    };
    fetchCached();
    return () => { cancelled = true; };
  }, [periodStart, periodEnd]);

  const analyze = async (forceRegenerate = false) => {
    setLoading(true); setAdvice(""); setProfile(""); setFromCache(false);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailySummaries: data.dailySummaries, productivityGoal: data.productivityGoal, userName: data.user.name, periodStart, periodEnd, calView, goal, periodLabel, forceRegenerate }),
      });
      const json = await res.json();
      setAdvice(json.advice || "No se pudo obtener el análisis."); setProfile(json.profile || ""); setFromCache(json.fromCache || false); setIsClosed(json.isClosed || false);
    } catch { setAdvice("Error al conectar. Intentá de nuevo."); }
    setLoading(false);
  };

  const blocks = advice ? advice.split(/\n\n+/).filter(b => b.trim()) : [];
  const lastBlock = blocks[blocks.length - 1] || "";
  const isNumeroCritico = lastBlock.toLowerCase().startsWith("número crítico");
  const sections = isNumeroCritico ? blocks.slice(0, -1) : blocks;
  const numeroCritico = isNumeroCritico ? lastBlock : "";
  const sectionConfig = [
    { label: "Lo que hizo bien", color: "#16a34a", bg: "#f0fdf4" },
    { label: "Dónde pierde oportunidades", color: "#b45309", bg: "#fffbeb" },
    { label: calView === "week" ? "La acción para esta semana" : "La acción para el próximo mes", color: RED, bg: "#fef2f2" },
  ];
  const profileLabel: Record<string, string> = { semana_productiva: "Período productivo", semana_ocupada: "Ocupado, poco productivo", semana_reactiva: "Período reactivo", semana_riesgo: "Riesgo comercial", semana_sin_actividad: "Sin actividad comercial" };
  const profileColor: Record<string, string> = { semana_productiva: "#16a34a", semana_ocupada: "#b45309", semana_reactiva: "#7c3aed", semana_riesgo: RED, semana_sin_actividad: "#374151" };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center"><Brain size={15} className="text-gray-500" /></div>
          <div>
            <div className="font-black text-sm text-gray-900">Inmo Coach <span className="font-normal text-gray-400">— vista broker</span></div>
            <div className="text-xs text-gray-400">{profile ? <span className="font-semibold" style={{ color: profileColor[profile] || "#6b7280" }}>{profileLabel[profile]}</span> : `análisis — ${periodLabel}`}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {fromCache && (
            <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-gray-100 text-gray-400 flex items-center gap-1">
              ✓ Guardado
              {!isClosed && <button onClick={() => analyze(true)} className="ml-1 underline hover:text-gray-600 transition-colors">actualizar</button>}
            </span>
          )}
          {(!fromCache || !isClosed) && (
            <button onClick={() => analyze(false)} disabled={loading || (fromCache && isClosed)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-50" style={{ background: RED }}>
              {loading ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
              {loading ? "Analizando..." : fromCache ? "Re-analizar" : "Analizar"}
            </button>
          )}
        </div>
      </div>

      {!advice && (
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">{calView === "week" ? "Últimos 7 días" : `Mes: ${periodLabel}`}</div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="text-center"><div className="text-2xl font-black text-gray-900" style={{ fontFamily: "Georgia, serif" }}>{periodGreen}</div><div className="text-xs text-gray-400 font-medium">reuniones comerciales</div></div>
            <div className="text-center border-x border-gray-200"><div className="text-2xl font-black text-gray-900" style={{ fontFamily: "Georgia, serif" }}>{periodActiveDays}</div><div className="text-xs text-gray-400 font-medium">días con actividad</div></div>
            <div className="text-center"><div className="text-2xl font-black" style={{ fontFamily: "Georgia, serif", color: periodGreen >= goal ? "#16a34a" : RED }}>{goal}</div><div className="text-xs text-gray-400 font-medium">{goalLabel}</div></div>
          </div>
          <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${periodPct}%`, background: barColor }} /></div>
          <div className="flex items-center justify-between mt-1.5">
            <div className="text-xs text-gray-400">{calView === "month" && <span>15/semana × 4 semanas = {goal} reuniones</span>}</div>
            <div className="text-xs font-semibold" style={{ color: barColor }}>{periodPct}% del objetivo</div>
          </div>
        </div>
      )}

      {advice && (
        <div className="space-y-3">
          {sections.map((block, i) => {
            const cfg = sectionConfig[i] || { label: "", color: "#374151", bg: "#f9fafb" };
            return (
              <div key={i} className="rounded-xl p-4" style={{ background: cfg.bg }}>
                <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: cfg.color }}>{i === 0 ? "✓ " : i === 1 ? "↓ " : "→ "}{cfg.label}</div>
                <p className="text-sm text-gray-700 leading-relaxed">{block.trim()}</p>
              </div>
            );
          })}
          {numeroCritico && <div className="border-t border-gray-100 pt-3"><p className="text-xs font-semibold text-gray-400">{numeroCritico}</p></div>}
          <button onClick={() => { setAdvice(""); setProfile(""); }} className="text-xs text-gray-300 hover:text-gray-500 transition-colors mt-1">← Volver al resumen</button>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AgentDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { email } = router.query;

  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [days, setDays] = useState(7);
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  useEffect(() => { if (status === "unauthenticated") router.replace("/login"); }, [status, router]);

  useEffect(() => {
    if (status === "authenticated" && email) load();
  }, [status, email, days]);

  const load = async (afterSync = false) => {
    if (!afterSync) setLoading(true);
    try {
      const res = await fetch(`/api/analytics/agent-dashboard?agentEmail=${encodeURIComponent(email as string)}&days=${days}`);
      if (!res.ok) { router.replace("/equipo"); return; }
      const d = await res.json();
      setData(d);
      // Auto-sync if no data in DB
      if (!d.hasData && !afterSync) {
        sync(d);
      }
    } catch {}
    if (!afterSync) setLoading(false);
  };

  const sync = async (currentData?: any) => {
    setSyncing(true);
    setSyncMsg("Sincronizando calendario...");
    try {
      const res = await fetch("/api/analytics/agent-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentEmail: email }),
      });
      const d = await res.json();
      if (d.ok) {
        setSyncMsg(`✓ ${d.synced} eventos sincronizados`);
        await load(true);
      } else if (d.reason === "no_token") {
        setSyncMsg("El agente aún no vinculó su Google Calendar.");
      } else {
        setSyncMsg("Error al sincronizar.");
      }
    } catch {
      setSyncMsg("Error de conexión.");
    }
    setSyncing(false);
    setTimeout(() => setSyncMsg(""), 4000);
  };

  const trendData = useMemo(() => {
    if (!data) return [];
    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setDate(today.getDate() - Math.min(days, 30));
    const fromStr = localDateStr(fromDate);
    const todayStr = localDateStr(today);
    return data.dailySummaries
      .filter(d => d.date >= fromStr && d.date <= todayStr)
      .map(d => {
        const dt = new Date(d.date + "T12:00:00");
        return { dateLabel: `${dt.getDate()}/${dt.getMonth() + 1}`, verdes: d.greenCount, meta: data?.totals?.iacGoal ?? 15 };
      });
  }, [data, days]);

  if (status === "loading" || (loading && !data)) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 size={24} className="animate-spin" style={{ color: RED }} /></div>;
  }

  const calView = days < 30 ? "week" : "month";

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <Head><title>{data?.user.name || email} — InmoCoach</title></Head>
      <div className="h-0.5 w-full" style={{ background: RED }} />

      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-2">
          {/* Fila 1: back + banner + historial */}
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => router.push("/equipo")} className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors shrink-0">
              <ArrowLeft size={13} /> Equipo
            </button>
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold text-center" style={{ background: "#fef2f2", color: RED }}>
                <Eye size={11} className="shrink-0" />
                <span className="truncate">{data?.user.name || (email as string)?.split("@")[0]}</span>
              </div>
            </div>
            <button onClick={() => router.push(`/equipo/historial?email=${encodeURIComponent(email as string)}`)}
              className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 shrink-0">
              📈 Historial
            </button>
            <button onClick={() => sync()} disabled={syncing || loading} title="Sincronizar"
              className="flex items-center text-xs text-gray-400 hover:text-gray-700 disabled:opacity-50 p-1.5 rounded-lg hover:bg-gray-100 shrink-0">
              <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
            </button>
          </div>
          {/* Fila 2: days selector + sync msg */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-xl p-1 flex-1 justify-center">
              {([7, 14, 30, 60, 90] as const).map(d => (
                <button key={d} onClick={() => setDays(d)}
                  className="text-xs font-bold px-2.5 py-1 rounded-lg transition-all flex-1"
                  style={{ background: days === d ? "white" : "transparent", color: days === d ? "#111827" : "#9ca3af", boxShadow: days === d ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                  {d}d
                </button>
              ))}
            </div>
            {syncMsg && (
              <span className="text-xs font-semibold px-2 py-1 rounded-lg shrink-0" style={{ background: syncMsg.startsWith("✓") ? "#f0fdf4" : "#fef2f2", color: syncMsg.startsWith("✓") ? "#16a34a" : RED }}>
                {syncMsg}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-6 pb-16 space-y-5">
        {data && (
          <>
            {/* Greeting / identity */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                {data.user.image ? (
                  <img src={data.user.image} alt="" className="w-12 h-12 rounded-full ring-2" style={{ outlineColor: RED }} />
                ) : (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-black text-white" style={{ background: RED }}>
                    {(data.user.name || "?")[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-black text-gray-900" style={{ fontFamily: "Georgia, serif" }}>{data.user.name}</h1>
                  <p className="text-sm text-gray-400">{data.user.email}</p>
                </div>
              </div>
              {(() => {
                const semanas = Math.max(1, days / 7);
                const iacPeriod = Math.round((data.totals.totalGreen / semanas) / (data.totals.iacGoal ?? 15) * 100);
                const iacColor = iacPeriod >= 100 ? GREEN : iacPeriod >= 67 ? "#d97706" : RED;
                const iacBg = iacPeriod >= 100 ? "#f0fdf4" : iacPeriod >= 67 ? "#fffbeb" : "#fef2f2";
                return (
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold" style={{ background: iacBg, color: iacColor }}>
                      IAC {iacPeriod}%
                    </div>
                    <div className="text-xs text-gray-400 mt-1 text-right">{data.totals.totalGreen} reuniones · {days}d</div>
                  </div>
                );
              })()}
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard label="Eventos verdes" value={data.totals.totalGreen} accent sub={`${days}d · objetivo ${Math.round((data.totals.iacGoal ?? 15) * days / 7)}`} tooltip="Reuniones cara a cara detectadas en el calendario del agente." />
              <KpiCard label="Visitas" value={data.totals.visitas} sub="venta · alquiler · propiedad" tooltip="Visitas a propiedades registradas en el período." />
              <KpiCard label="Tasaciones · Propuestas" value={`${data.totals.tasaciones} · ${data.totals.propuestas}`} sub="captaciones + presentaciones" tooltip="Tasaciones y propuestas registradas como eventos en el calendario." />
              <KpiCard label="Firmas" value={data.totals.firmas ?? 0} sub="cierres de operación" tooltip="Operaciones cerradas detectadas por la palabra 'Firma' en el evento." />
            </div>

            {/* Streak */}
            {data.streak && <StreakBadge current={data.streak.current} best={data.streak.best} todayActive={data.streak.todayActive} />}

            {/* Rango */}
            {data.rankStats && <RankBadge stats={data.rankStats} />}

            {/* Cartera Tokko */}
            <TokkoPortfolio agentEmail={email as string} />

            {/* Tendencia + IAC */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white border border-gray-100 rounded-2xl p-5 col-span-1 sm:col-span-2">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Tendencia — eventos verdes</div>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 9, fill: "#d1d5db", fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "#d1d5db" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: "none", fontSize: 11, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }} />
                    <Line type="monotone" dataKey="meta" stroke="#e5e7eb" strokeWidth={1.5} dot={false} strokeDasharray="4 4" name="Meta" />
                    <Line type="monotone" dataKey="verdes" stroke={GREEN} strokeWidth={2} dot={{ fill: GREEN, r: 3 }} name="Verdes" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {(() => {
                const semanas = Math.max(1, days / 7);
                const iacPeriod = Math.round((data.totals.totalGreen / semanas) / (data.totals.iacGoal ?? 15) * 100);
                const iacColor = iacPeriod >= 100 ? GREEN : iacPeriod >= 67 ? "#d97706" : RED;
                const avgSem = Math.round((data.totals.totalGreen / semanas) * 10) / 10;
                const goalPeriod = Math.round((data.totals.iacGoal ?? 15) * semanas);
                return (
                  <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-row sm:flex-col justify-between sm:justify-center gap-4">
                    <div>
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">IAC · {days}d</div>
                      <div className="text-4xl font-black" style={{ color: iacColor, fontFamily: "Georgia, serif" }}>{iacPeriod}%</div>
                      <div className="text-xs text-gray-400 mt-1">{data.totals.totalGreen} de {goalPeriod} · {avgSem}/sem</div>
                      <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, iacPeriod)}%`, background: iacColor }} /></div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Objetivo semanal</div>
                      <div className="text-4xl font-black text-gray-900" style={{ fontFamily: "Georgia, serif" }}>{data.totals.iacGoal ?? 15}</div>
                      <div className="text-xs text-gray-400 mt-1">reuniones cara a cara / semana</div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Calendario */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Calendario · {calView === "week" ? "vista semana" : "vista mes"}</div>
              </div>
              {calView === "week" ? (
                <WeeklyView summaries={data.dailySummaries} weekOffset={weekOffset} onPrev={() => setWeekOffset(w => w - 1)} onNext={() => setWeekOffset(w => w + 1)} />
              ) : (
                <MonthlyView summaries={data.dailySummaries} monthOffset={monthOffset} onPrev={() => setMonthOffset(m => m - 1)} onNext={() => setMonthOffset(m => m + 1)} />
              )}
              <div className="flex items-center gap-4 mt-2 px-1">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-200" /><span className="text-xs text-gray-400 font-medium">1 a 1 cara a cara</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-gray-200" /><span className="text-xs text-gray-400 font-medium">Otros eventos</span></div>
              </div>
            </div>

            {/* Inmo Coach */}
            <CoachPanel data={data} calView={calView} monthOffset={monthOffset} weekOffset={weekOffset} agentEmail={email as string} />
          </>
        )}
      </main>
    </div>
  );
}
