import { useSession, signOut } from "next-auth/react";
import OnboardingModal from "../components/OnboardingModal";
import StreakBadge from "../components/StreakBadge";
import RankBadge from "../components/RankBadge";
import RankingPosition from "../components/RankingPosition";
import AgentVsTeam from "../components/AgentVsTeam";
import TokkoPortfolio from "../components/TokkoPortfolio";
import AppLayout from "../components/AppLayout";
import PushPrompt from "../components/PushPrompt";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { useRouter } from "next/router";
import { useEffect, useState, useMemo } from "react";
import EmptyDashboard from "../components/EmptyDashboard";
import Head from "next/head";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from "recharts";
import { LogOut, RefreshCw, AlertTriangle, Calendar, Target, Eye, Zap, TrendingUp, Brain, ChevronDown, ChevronLeft, ChevronRight, Award, Loader2, DollarSign, Mail, CheckCircle, Users } from "lucide-react";

// Fecha local en formato YYYY-MM-DD (evita desfase UTC en Argentina después de las 21:00)
function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}


const RED = "#aa0000";
const GREEN = "#16a34a";

interface CalendarEvent { id: string; title: string; type: string; isGreen: boolean; isOrganizer: boolean; start: string; }
interface DaySummary { date: string; greenCount: number; isProductive: boolean; events: CalendarEvent[]; }
interface CalendarData {
  user: { name: string; email: string; image?: string };
  syncedAt: string;
  totals: {
    tasaciones: number; primerasVisitas: number; fotosVideo: number;
    visitas: number; propuestas: number; firmas: number; reuniones: number;
    procesosNuevos: number; totalGreen: number; totalEvents: number;
    iac: number; iacGoal: number; procesosGoal: number;
  };
  productivityGoal: number;
  productiveDays: number;
  totalDays: number;
  productivityRate: number;
  dailySummaries: DaySummary[];
  recentEvents: CalendarEvent[];
  onboardingDone?: boolean;
  streak?: { current: number; best: number; todayActive: boolean; lastActiveDate: string | null; minGreens?: number; shields?: number };
  rankStats?: any;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TYPE_LABEL: Record<string, string> = {
  tasacion: "TASACIÓN", visita: "VISITA", propuesta: "PROPUESTA", reunion: "REUNIÓN", otro: "EVENTO",
};

function formatHour(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function isoToDate(iso: string) { return iso?.slice(0, 10); }

// ─── Tooltip KPI Card ─────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent, delay = 0, tooltip }: any) {
  const [show, setShow] = useState(false);
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 animate-fade-up relative overflow-visible"
      style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{label}</div>
        {tooltip && (
          <button
            onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
            onTouchStart={() => setShow(s => !s)}
            className="w-4 h-4 rounded-full border border-gray-200 text-gray-400 text-xs flex items-center justify-center shrink-0 hover:border-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Más info">?</button>
        )}
      </div>
      <div className="text-4xl font-black leading-none" style={{ color: accent ? RED : "#111827", fontFamily: "Georgia, serif" }}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-2">{sub}</div>}
      {tooltip && show && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 px-1">
          <div className="bg-gray-900 text-white text-xs rounded-xl px-3 py-2.5 leading-relaxed shadow-xl">
            {tooltip}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Event Pill ───────────────────────────────────────────────────────────────
function EventPill({ event }: { event: CalendarEvent }) {
  const green = event.isGreen;
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold ${green ? "border-green-200 bg-green-50" : "border-gray-100 bg-gray-50"}`}>
      {green && <DollarSign size={11} style={{ color: GREEN, flexShrink: 0 }} />}
      <span className="truncate" style={{ color: green ? "#15803d" : "#6b7280" }}>{event.title}</span>
      {event.start.includes("T") && (
        <span className="ml-auto shrink-0 text-gray-300">{formatHour(event.start)}</span>
      )}
    </div>
  );
}

// ─── Weekly Calendar View ─────────────────────────────────────────────────────
function WeeklyView({ summaries, weekOffset, onPrev, onNext }: {
  summaries: DaySummary[]; weekOffset: number; onPrev: () => void; onNext: () => void;
}) {
  const today = new Date();
  // Calcular lunes de la semana correctamente
  const todayDay = today.getDay(); // 0=dom,1=lun,...6=sab
  const diffToMonday = (todayDay === 0 ? -6 : 1 - todayDay); // días hasta el lunes
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const byDate = useMemo(() => {
    const m: Record<string, DaySummary> = {};
    summaries.forEach(s => { m[s.date] = s; });
    return m;
  }, [summaries]);

  const weekLabel = `${days[0].toLocaleDateString("es-AR", { day: "numeric", month: "short" })} — ${days[6].toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}`;
  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <span className="text-sm font-bold text-gray-700">{weekLabel}</span>
        <div className="flex items-center gap-1">
          <button onClick={onPrev} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
            <ChevronLeft size={14} className="text-gray-500" />
          </button>
          <button onClick={onNext} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
            <ChevronRight size={14} className="text-gray-500" />
          </button>
        </div>
      </div>
      {/* Day columns */}
      <div className="overflow-x-auto">
      <div className="grid grid-cols-7 divide-x divide-gray-100 min-h-[320px] min-w-[500px]">
        {days.map((day, i) => {
          const dateStr = localDateStr(day);
          const summary = byDate[dateStr];
          const isToday = dateStr === localDateStr(today);
          const isPast = day < today;
          return (
            <div key={dateStr} className="flex flex-col">
              {/* Day header */}
              <div className={`px-2 py-2 text-center border-b border-gray-100 ${isToday ? "" : ""}`}>
                <div className="text-xs font-semibold text-gray-400 uppercase">{dayNames[i]}</div>
                <div className={`text-sm font-black mt-0.5 w-7 h-7 rounded-full flex items-center justify-center mx-auto ${isToday ? "text-white" : "text-gray-700"}`}
                  style={{ background: isToday ? RED : "transparent" }}>
                  {day.getDate()}
                </div>
                {summary && (
                  <div className="mt-1 text-xs font-bold" style={{ color: summary.isProductive ? GREEN : "#9ca3af" }}>
                    {summary.greenCount}✦
                  </div>
                )}
              </div>
              {/* Events */}
              <div className="flex-1 p-1 space-y-1 overflow-y-auto max-h-60">
                {summary?.events.map(ev => (
                  <div key={ev.id}
                    className={`text-xs px-2 py-1.5 rounded-md font-medium truncate border-l-2 ${ev.isGreen ? "bg-green-50 border-green-400 text-green-800" : "bg-gray-50 border-gray-200 text-gray-400"}`}
                    title={ev.title}>
                    {ev.start.includes("T") && (
                      <span className={`text-xs mr-1 ${ev.isGreen ? "text-green-600" : "text-gray-300"}`}>{formatHour(ev.start)}</span>
                    )}
                    {ev.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

// ─── Monthly Calendar View ────────────────────────────────────────────────────
function MonthlyView({ summaries, monthOffset, onPrev, onNext }: {
  summaries: DaySummary[]; monthOffset: number; onPrev: () => void; onNext: () => void;
}) {
  const today = new Date();
  const target = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = target.getFullYear();
  const month = target.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Start on Monday
  const startPad = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((startPad + lastDay.getDate()) / 7) * 7;

  const byDate = useMemo(() => {
    const m: Record<string, DaySummary> = {};
    summaries.forEach(s => { m[s.date] = s; });
    return m;
  }, [summaries]);

  const monthLabel = target.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <span className="text-sm font-bold text-gray-700 capitalize">{monthLabel}</span>
        <div className="flex gap-1">
          <button onClick={onPrev} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
            <ChevronLeft size={14} className="text-gray-500" />
          </button>
          <button onClick={onNext} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
            <ChevronRight size={14} className="text-gray-500" />
          </button>
        </div>
      </div>
      {/* Day names */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {dayNames.map(d => (
          <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2 uppercase">{d}</div>
        ))}
      </div>
      {/* Cells */}
      <div className="grid grid-cols-7 divide-x divide-y divide-gray-100">
        {Array.from({ length: totalCells }, (_, i) => {
          const dayNum = i - startPad + 1;
          if (dayNum < 1 || dayNum > lastDay.getDate()) {
            return <div key={i} className="h-20 bg-gray-50/50" />;
          }
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
          const summary = byDate[dateStr];
          const isToday = dateStr === localDateStr(today);
          const greenEvs = summary?.events.filter(e => e.isGreen) ?? [];
          const grayEvs = summary?.events.filter(e => !e.isGreen) ?? [];

          return (
            <div key={dateStr} className={`h-20 p-1.5 flex flex-col ${isToday ? "bg-red-50" : ""}`}>
              <div className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center mb-1 ${isToday ? "text-white" : "text-gray-600"}`}
                style={{ background: isToday ? RED : "transparent" }}>
                {dayNum}
              </div>
              <div className="flex-1 overflow-hidden space-y-0.5">
                {greenEvs.slice(0, 2).map(ev => (
                  <div key={ev.id} className="text-xs bg-green-100 text-green-800 rounded px-1 truncate font-medium leading-tight py-0.5" title={ev.title}>
                    {ev.title}
                  </div>
                ))}
                {grayEvs.slice(0, 1).map(ev => (
                  <div key={ev.id} className="text-xs bg-gray-100 text-gray-400 rounded px-1 truncate leading-tight py-0.5" title={ev.title}>
                    {ev.title}
                  </div>
                ))}
                {(greenEvs.length + grayEvs.length) > 3 && (
                  <div className="text-xs text-gray-300 font-medium">+{greenEvs.length + grayEvs.length - 3} más</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Inmo Coach Panel ────────────────────────────────────────────────────────
function InstaCoacPanel({ data, calView, monthOffset, weekOffset, days = 30 }: { data: CalendarData; calView: "week" | "month"; monthOffset: number; weekOffset: number; days?: number }) {
  const [advice, setAdvice] = useState("");
  const [profile, setProfile] = useState("");
  const [weekTotals, setWeekTotals] = useState<any>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [isClosed, setIsClosed] = useState(false);

  // Reset cuando cambia la vista o el mes
  useEffect(() => { setAdvice(""); setProfile(""); setWeekTotals(null); setFromCache(false); setIsClosed(false); }, [calView, monthOffset, weekOffset]);

  const today = new Date();

  const { periodStart, periodEnd, periodLabel, goal, goalLabel } = useMemo(() => {
    if (calView === "week") {
      // Calcular lunes de la semana según weekOffset
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const weekLabel = weekOffset === 0
        ? "esta semana"
        : `semana del ${monday.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}`;
      return {
        periodStart: localDateStr(monday),
        periodEnd: localDateStr(sunday),
        periodLabel: weekLabel,
        goal: data.totals.iacGoal ?? 15,
        goalLabel: "meta semanal",
      };
    } else {
      const target = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
      const firstDay = new Date(target.getFullYear(), target.getMonth(), 1);
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0);
      const monthName = target.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
      const weeklyGoal = data.totals.iacGoal ?? 15;
      return {
        periodStart: localDateStr(firstDay),
        periodEnd: localDateStr(lastDay),
        periodLabel: monthName,
        goal: weeklyGoal * 4,
        goalLabel: `meta mensual (${weeklyGoal}×4)`,
      };
    }
  }, [calView, monthOffset, weekOffset]);

  const periodSummaries = data.dailySummaries.filter(d => d.date >= periodStart && d.date <= periodEnd);
  const periodGreen = periodSummaries.flatMap(d => d.events).filter(e => e.isGreen).length;
  const periodActiveDays = periodSummaries.filter(d => d.greenCount > 0).length;
  const periodPct = Math.min(100, Math.round((periodGreen / goal) * 100));
  const barColor = periodPct >= 100 ? "#16a34a" : periodPct >= 50 ? "#b45309" : RED;

  // Auto-fetch informe guardado al cambiar de período
  useEffect(() => {
    if (!periodStart) return;
    let cancelled = false;
    const fetchCached = async () => {
      try {
        const res = await fetch("/api/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dailySummaries: data.dailySummaries,
            productivityGoal: data.productivityGoal,
            userName: data.user.name,
            periodStart,
            periodEnd,
            calView,
            goal,
            periodLabel,
            forceRegenerate: false,
            checkCacheOnly: true,
          }),
        });
        const json = await res.json();
        if (cancelled) return;
        if (json.fromCache && json.advice) {
          setAdvice(json.advice);
          setProfile(json.profile || "");
          setWeekTotals(json.weekTotals || null);
          setFromCache(true);
          setIsClosed(json.isClosed || false);
        }
      } catch { /* silencioso */ }
    };
    fetchCached();
    return () => { cancelled = true; };
  }, [periodStart, periodEnd]);

  const analyze = async (forceRegenerate = false) => {
    setLoading(true);
    setAdvice("");
    setProfile("");
    setWeekTotals(null);
    setFromCache(false);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dailySummaries: data.dailySummaries,
          productivityGoal: data.productivityGoal,
          userName: data.user.name,
          periodStart,
          periodEnd,
          calView,
          goal,
          periodLabel,
          forceRegenerate,
        }),
      });
      const json = await res.json();
      setAdvice(json.advice || "No se pudo obtener el análisis.");
      setProfile(json.profile || "");
      setWeekTotals(json.weekTotals || null);
      setFromCache(json.fromCache || false);
      setIsClosed(json.isClosed || false);
    } catch { setAdvice("Error al conectar. Intentá de nuevo."); }
    setLoading(false);
  };

  const sendTestEmail = async () => {
    setEmailSending(true);
    try {
      const res = await fetch("/api/send-test-email", { method: "POST" });
      const json = await res.json();
      if (json.ok) { setEmailSent(true); setTimeout(() => setEmailSent(false), 4000); }
      else alert("Error: " + json.error);
    } catch { alert("Error al enviar el mail."); }
    setEmailSending(false);
  };

  const blocks = advice ? advice.split(/\n\n+/).filter(b => b.trim()) : [];
  const lastBlock = blocks[blocks.length - 1] || "";
  const isNumeroCritico = lastBlock.toLowerCase().startsWith("número crítico");
  const sections = isNumeroCritico ? blocks.slice(0, -1) : blocks;
  const numeroCritico = isNumeroCritico ? lastBlock : "";

  const sectionConfig = [
    { label: "Lo que hiciste bien", color: "#16a34a", bg: "#f0fdf4" },
    { label: "Dónde perdés oportunidades", color: "#b45309", bg: "#fffbeb" },
    { label: calView === "week" ? "La acción para esta semana" : "La acción para el próximo mes", color: RED, bg: "#fef2f2" },
  ];

  const profileLabel: Record<string, string> = {
    semana_productiva: "Período productivo",
    semana_ocupada: "Ocupado, poco productivo",
    semana_reactiva: "Período reactivo",
    semana_riesgo: "Riesgo comercial",
    semana_sin_actividad: "Sin actividad comercial",
  };

  const profileColor: Record<string, string> = {
    semana_productiva: "#16a34a",
    semana_ocupada: "#b45309",
    semana_reactiva: "#7c3aed",
    semana_riesgo: RED,
    semana_sin_actividad: "#374151",
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center">
            <Brain size={15} className="text-gray-500" />
          </div>
          <div>
            <div className="font-black text-sm text-gray-900">Inmo Coach</div>
            <div className="text-xs text-gray-400">
              {profile ? (
                <span className="font-semibold" style={{ color: profileColor[profile] || "#6b7280" }}>
                  {profileLabel[profile]}
                </span>
              ) : `análisis — ${periodLabel}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {fromCache && (
            <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-gray-100 text-gray-400 flex items-center gap-1">
              ✓ Guardado
              {!isClosed && (
                <button onClick={() => analyze(true)} className="ml-1 underline hover:text-gray-600 transition-colors">
                  actualizar
                </button>
              )}
            </span>
          )}
          <button onClick={sendTestEmail} disabled={emailSending || emailSent}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
            style={{ color: emailSent ? "#16a34a" : "#6b7280" }}>
            {emailSending ? <Loader2 size={11} className="animate-spin" /> : emailSent ? <CheckCircle size={11} /> : <Mail size={11} />}
            {emailSent ? "Enviado!" : emailSending ? "Enviando..." : "Mail de prueba"}
          </button>
        </div>
      </div>

      {!advice && (
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest">
              {calView === "week" ? "Últimos 7 días" : `Mes: ${periodLabel}`}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="text-center">
              <div className="text-2xl font-black text-gray-900" style={{ fontFamily: "Georgia, serif" }}>{periodGreen}</div>
              <div className="text-xs text-gray-400 font-medium">reuniones comerciales</div>
            </div>
            <div className="text-center border-x border-gray-200">
              <div className="text-2xl font-black text-gray-900" style={{ fontFamily: "Georgia, serif" }}>{periodActiveDays}</div>
              <div className="text-xs text-gray-400 font-medium">días con actividad</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black" style={{ fontFamily: "Georgia, serif", color: periodGreen >= goal ? "#16a34a" : RED }}>{goal}</div>
              <div className="text-xs text-gray-400 font-medium">{goalLabel}</div>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${periodPct}%`, background: barColor }} />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <div className="text-xs text-gray-400">
              {calView === "month" && <span>{data.totals.iacGoal ?? 15}/semana × 4 semanas = {goal} reuniones</span>}
            </div>
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
                <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: cfg.color }}>
                  {i === 0 ? "✓ " : i === 1 ? "↓ " : "→ "}{cfg.label}
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{block.trim()}</p>
              </div>
            );
          })}
          {numeroCritico && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-400">{numeroCritico}</p>
            </div>
          )}
          <button onClick={() => { setAdvice(""); setProfile(""); setWeekTotals(null); }}
            className="text-xs text-gray-300 hover:text-gray-500 transition-colors mt-1">
            ← Volver al resumen
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function TokkoPortfolioCard() {
  const [stats, setStats] = useState<{ active: number; complete: number; incomplete: number; stale: number } | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/tokko-portfolio", { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.connected && d.stats) { setStats(d.stats); setConnected(true); } setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const cartHealth = !stats ? null
    : stats.incomplete === 0 ? "green"
    : stats.incomplete <= stats.active * 0.3 ? "amber"
    : "red";
  const cartColor = cartHealth === "green" ? "#16a34a" : cartHealth === "amber" ? "#d97706" : cartHealth === "red" ? "#dc2626" : "#e5e7eb";
  const cartLabel = cartHealth === "green" ? "Cartera al día" : cartHealth === "amber" ? "Atención requerida" : cartHealth === "red" ? "Fichas críticas" : "";

  return (
    <div style={{
      background: "#fff",
      border: `0.5px solid ${connected && stats ? cartColor + "30" : "#e5e7eb"}`,
      borderTop: `4px solid ${connected && stats ? cartColor : "#e5e7eb"}`,
      borderRadius: "0 0 14px 14px", overflow: "hidden", cursor: "pointer",
    }}>
      <div style={{ background: connected && stats ? cartColor + "08" : "#f9fafb", padding: "14px 16px 10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em" }}>Cartera Tokko</span>
            <span title="Estado de tus propiedades en Tokko. Ficha completa = 15+ fotos, plano, video o tour 360, y editada en los últimos 30 días." style={{ fontSize: 10, color: "#d1d5db", cursor: "help", border: "0.5px solid #e5e7eb", borderRadius: "50%", width: 14, height: 14, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>?</span>
          </div>
          <span style={{ fontSize: 13, color: "#d1d5db" }}>›</span>
        </div>

        {loading ? (
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 10 }}>Cargando...</div>
        ) : !connected || !stats ? (
          /* Sin API Key — invitación simple */
          <div style={{ paddingTop: 10 }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>🏠</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 4 }}>Conectá tu cartera de Tokko</div>
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, marginBottom: 12 }}>
              Mirá el estado de tus fichas, alertas de actualización y fichas incompletas — todo desde acá.
            </div>
            <button
              onClick={e => { e.stopPropagation(); router.push("/tokko-setup"); }}
              style={{ background: "#aa0000", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
              Conectar Tokko →
            </button>
          </div>
        ) : (
          /* Con datos */
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
            <div style={{ fontSize: 56, fontWeight: 500, fontFamily: "Georgia, serif", color: cartColor, lineHeight: 1 }}>{stats.active}</div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>disponibles</div>
            {cartLabel && (
              <div style={{
                fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 20,
                background: cartHealth === "green" ? "#EAF3DE" : cartHealth === "amber" ? "#FAEEDA" : "#FCEBEB",
                color: cartHealth === "green" ? "#3B6D11" : cartHealth === "amber" ? "#854F0B" : "#A32D2D",
              }}>{cartLabel}</div>
            )}
          </div>
        )}
      </div>

      {stats && (
        <div style={{ padding: "10px 16px 14px" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, background: "#f9fafb", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 500, fontFamily: "Georgia, serif", color: "#16a34a" }}>{stats.complete}</div>
              <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>Fichas OK</div>
            </div>
            <div style={{ flex: 1, background: stats.incomplete > 0 ? "#FEF2F2" : "#f9fafb", borderRadius: 8, padding: "8px 10px", textAlign: "center", border: stats.incomplete > 0 ? "1px solid #fecaca" : "none" }}>
              <div style={{ fontSize: 22, fontWeight: 500, fontFamily: "Georgia, serif", color: stats.incomplete > 0 ? "#dc2626" : "#9ca3af" }}>{stats.incomplete}</div>
              <div style={{ fontSize: 10, color: stats.incomplete > 0 ? "#dc2626" : "#9ca3af", marginTop: 1 }}>Por mejorar</div>
            </div>
          </div>
          {stats.incomplete > 0 && (
            <div style={{ marginTop: 10, background: "#FEF2F2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#991b1b" }}>{stats.incomplete} ficha{stats.incomplete !== 1 ? "s" : ""} necesitan atención</div>
                <div style={{ fontSize: 11, color: "#b91c1c", marginTop: 1 }}>Fotos, plano o video faltante · tocá para ver</div>
              </div>
            </div>
          )}
          {stats.stale > 0 && (
            <div style={{ marginTop: 6, background: "#FFFBEB", border: "0.5px solid #fcd34d", borderRadius: 8, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14 }}>🕐</span>
              <span style={{ fontSize: 11, color: "#92400e" }}>{stats.stale} sin actualizar hace más de 30 días</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [days, setDays] = useState(7);
  useEffect(() => {
    const saved = localStorage.getItem("inmocoach_days");
    if (saved) setDays(parseInt(saved, 10));
  }, []);
  const handleSetDays = (d: number) => { setDays(d); localStorage.setItem("inmocoach_days", String(d)); };
  const [subPlan, setSubPlan] = useState("free");
  const [isOwner, setIsOwner] = useState(false);
  const [hasTeam, setHasTeam] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  // calView is derived from days selector — no separate state needed
  const [weekOffset, setWeekOffset] = useState(0);
  // Deep link desde mail: ?week=YYYY-MM-DD
  useEffect(() => {
    const weekParam = new URLSearchParams(window.location.search).get("week");
    if (!weekParam) return;
    const targetMonday = new Date(weekParam + "T12:00:00");
    const now = new Date();
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    thisMonday.setHours(0, 0, 0, 0);
    const diffMs = targetMonday.getTime() - thisMonday.getTime();
    const offset = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
    if (offset !== 0) setWeekOffset(offset);
  }, []);
  const [monthOffset, setMonthOffset] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [brokerExpiredModal, setBrokerExpiredModal] = useState<{ brokerName: string; brokerEmail: string } | null>(null);
  const { status: pushStatus, subscribe: subscribePush } = usePushNotifications();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/subscription").then(r => r.json()).then(d => {
        setSubPlan(d.plan?.id ?? "free");
        setIsOwner(d.subscription?.teamRole === "owner" || d.subscription?.teamRole === "team_leader");
        setHasTeam(!!d.subscription?.teamId);
        if (d.subscription?.isExpired) router.push("/expired");
        // Chequear si el equipo del broker expiró
        if (d.subscription?.teamId && d.subscription?.teamRole === "member") {
          fetch(`/api/teams/status?teamId=${d.subscription.teamId}`)
            .then(r => r.json())
            .then(t => {
              if (t.status === "expired") setBrokerExpiredModal({ brokerName: t.brokerName, brokerEmail: t.brokerEmail });
            }).catch(() => {});
        }
        if (d.plan?.id === "free" && d.subscription?.createdAt) {
          const created = new Date(d.subscription.createdAt);
          const diff = 7 - Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
          setDaysLeft(Math.max(0, diff));
        }
      });
    }
  }, [status]);

  const handleOnboardingClose = async (dontShow: boolean) => {
    setShowOnboarding(false);
    if (dontShow) {
      await fetch("/api/onboarding", { method: "POST" });
    }
    // Pedir permiso de push al cerrar el onboarding
    if (pushStatus === "default") {
      // Pequeña pausa para que el modal desaparezca primero
      setTimeout(() => subscribePush(), 800);
    }
  };

  const [syncing, setSyncing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);

  const loadFromCache = async (d: number) => {
    // Paso 1: mostrar datos de DB inmediatamente
    try {
      const fetchDays = Math.max(d, 14);
      const res = await fetch(`/api/calendar/cached?days=${fetchDays}`);
      if (res.status === 401) { router.push("/relogin"); return false; }
      if (res.status === 403) { router.push("/expired"); return false; }
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setFromCache(true);
        setLoading(false);
        return true;
      }
    } catch {}
    return false;
  };

  const syncWithGoogle = async (d: number, silent = false) => {
    // Paso 2: sincronizar con Google en background
    if (!silent) setSyncing(true);
    try {
      const fetchDays = Math.max(d, 14);
      const res = await fetch(`/api/calendar?days=${fetchDays}`);
      if (res.status === 401) { router.push("/relogin"); return; }
      if (res.status === 403) { return; } // freemium expirado, ya manejado
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setFromCache(false);
        setLastSyncedAt(json.syncedAt);
        setError("");
      } else {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error || "";
        // Si el error es de token/auth redirigir siempre, incluso con datos en caché
        if (errMsg.includes("token") || errMsg.includes("auth") || errMsg.includes("invalid") || errMsg.includes("revoked")) {
          router.push("/relogin");
          return;
        }
        if (!data) setError(errMsg || "Error de sincronización");
      }
    } catch (e: any) {
      if (!data) setError(e.message);
    }
    setSyncing(false);
  };

  const sync = async () => {
    // Solo mostrar loading si no hay datos previos
    if (!data) setLoading(true);
    setError("");
    // Primero mostrar caché, luego sincronizar
    await loadFromCache(days);
    await syncWithGoogle(days);
    setLoading(false);
  };

  useEffect(() => {
    if (status === "authenticated") sync();
  }, [status]);

  // Cuando cambia `days`, mostrar caché primero y re-sincronizar
  useEffect(() => {
    if (status !== "authenticated" || !data) return;
    // No borrar datos — cargar en background
    loadFromCache(days).then(() => syncWithGoogle(days, true));
  }, [days]);

  // Polling liviano — detecta cambios del webhook y actualiza el dashboard
  useEffect(() => {
    if (status !== "authenticated") return;
    let lastKnown: string | undefined = undefined;

    const poll = async () => {
      try {
        const res = await fetch("/api/calendar/last-updated", { cache: "no-store" });
        if (!res.ok) return;
        const { lastUpdated } = await res.json();
        if (!lastUpdated) return;

        // Primera vez — solo guardar baseline
        if (lastKnown === undefined) { lastKnown = lastUpdated; return; }

        // Cambió — recargar desde DB
        if (lastUpdated !== lastKnown) {
          lastKnown = lastUpdated;
          const fetchDays = Math.max(days, 14);
          const r = await fetch(`/api/calendar/cached?days=${fetchDays}`, { cache: "no-store" });
          if (r.ok) { setData(await r.json()); setFromCache(true); }
        }
      } catch {}
    };

    const t = setTimeout(poll, 4000);
    const i = setInterval(poll, 20000);
    const onVisible = () => { if (document.visibilityState === "visible") poll(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearTimeout(t); clearInterval(i); document.removeEventListener("visibilitychange", onVisible); };
  }, [status, days]);

  // Auto-navegar a semana anterior si hoy es lunes/martes y esta semana no tiene eventos aún
  useEffect(() => {
    if (!data || weekOffset !== 0) return;
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=dom, 1=lun, 2=mar
    if (dayOfWeek <= 2) {
      // Es lunes o martes — ver si esta semana tiene eventos verdes
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      monday.setHours(0, 0, 0, 0);
      const mondayStr = monday.toISOString().slice(0, 10);
      const thisWeekHasEvents = data.dailySummaries.some(d => d.date >= mondayStr && d.greenCount > 0);
      if (!thisWeekHasEvents) setWeekOffset(-1);
    }
  }, [data]);

  // Mostrar onboarding si el usuario no lo completó todavía
  useEffect(() => {
    if (data && data.onboardingDone === false) {
      setShowOnboarding(true);
    }
  }, [data]);

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
        return { dateLabel: `${dt.getDate()}/${dt.getMonth() + 1}`, verdes: d.greenCount, meta: data.totals.iacGoal ?? 15 };
      });
  }, [data, days]);

  // Totales de la semana visible (respeta weekOffset)
  const visibleWeekTotals = useMemo(() => {
    if (!data) return null;
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23, 59, 59, 999);
    const monStr = localDateStr(monday);
    const sunStr = localDateStr(sunday);
    const weekSummaries = data.dailySummaries.filter(d => d.date >= monStr && d.date <= sunStr);
    const totalGreen = weekSummaries.reduce((s, d) => s + d.greenCount, 0);
    const totalEvents = weekSummaries.reduce((s, d) => s + (d.events?.length ?? 0), 0);
    const greenEvs = weekSummaries.flatMap(d => (d.events ?? []).filter((e: any) => e.isGreen));
    const tasaciones = greenEvs.filter((e: any) => e.type === "tasacion").length;
    const visitas = greenEvs.filter((e: any) => ["visita","conocer","primera_visita"].includes(e.type)).length;
    const propuestas = greenEvs.filter((e: any) => e.type === "propuesta").length;
    const firmas = greenEvs.filter((e: any) => e.isCierre).length;
    const iacGoal = data.totals.iacGoal ?? 15;
    const iac = Math.min(100, Math.round((totalGreen / iacGoal) * 100));
    return { totalGreen, totalEvents, tasaciones, visitas, propuestas, firmas, iacGoal, iac };
  }, [data, weekOffset]);

  if (status === "loading" || (!data && !error && loading)) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg"
          style={{ background: RED }}>IC</div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 size={14} className="animate-spin" style={{ color: RED }} />
          Sincronizando tu calendario...
        </div>
      </div>
    );
  }

  const iac = (() => {
    if (!data) return 0;
    const wt = (days <= 14 && visibleWeekTotals) ? visibleWeekTotals : null;
    const greens = wt ? wt.totalGreen : data.totals.totalGreen;
    const goal = data.totals.iacGoal ?? 15;
    return Math.min(100, Math.round((greens / Math.max(1, days / 7)) / goal * 100));
  })();
  const iacColor = iac >= 100 ? "#16a34a" : iac >= 67 ? "#d97706" : "#aa0000";
  const iacLabel = iac >= 100 ? "En objetivo" : iac >= 67 ? "Buen ritmo" : "Por debajo del objetivo";
  const iacSemaforo = iac >= 100 ? [true, true, true] : iac >= 67 ? [true, true, false] : [true, false, false];
  const weekGreens = visibleWeekTotals ? visibleWeekTotals.totalGreen : (data?.totals.totalGreen ?? 0);
  const weekGoal = data?.totals.iacGoal ?? 15;

  const weekLabel = weekOffset === 0 ? "semana actual"
    : weekOffset === -1 ? "semana pasada"
    : `hace ${Math.abs(weekOffset)} sem.`;

  const greeting = (() => {
    const h = new Date().getHours();
    const name = data?.user.name?.split(" ")[0] ?? session?.user?.name?.split(" ")[0] ?? "";
    if (h < 12) return `Buenos días, ${name}`;
    if (h < 19) return `Buenas tardes, ${name}`;
    return `Buenas noches, ${name}`;
  })();

  const topbarExtra = (
    <>
      <div className="ic-days-desktop" style={{ alignItems: "center", background: "#f3f4f6", borderRadius: 9, padding: "3px", gap: 2 }}>
        {([7, 14, 30] as const).map(d => (
          <button key={d} onClick={() => handleSetDays(d)} style={{
            background: days === d ? "#fff" : "transparent",
            color: days === d ? "#111827" : "#9ca3af",
            boxShadow: days === d ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            borderRadius: 7, padding: "4px 10px", fontSize: 11, fontWeight: 500, border: "none", cursor: "pointer"
          }}>{d}d</button>
        ))}
      </div>
      <button onClick={sync} disabled={loading || syncing} style={{
        fontSize: 12, color: syncing ? "#d97706" : "#6b7280",
        background: "#f9fafb", border: "0.5px solid #e5e7eb",
        borderRadius: 7, padding: "5px 10px", cursor: "pointer", whiteSpace: "nowrap"
      }}>
        {syncing ? "↻ Actualizando..." : "↻ Sync"}
      </button>
    </>
  );

  return (
    <AppLayout greeting={greeting} topbarExtra={topbarExtra}>
      <Head><title>InmoCoach</title></Head>

      <style>{`
        .ic-days-desktop { display: flex; }
        .ic-cards-grid { display: grid; grid-template-columns: repeat(2, 1fr); }
        @media (max-width: 767px) {
          .ic-days-desktop { display: none; }
          .ic-cards-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Days mobile strip */}
      <div style={{ background: "#fff", borderBottom: "0.5px solid #e5e7eb", padding: "8px 16px", display: "none", gap: 6, overflowX: "auto" }} className="ic-days-mobile-strip">
        {([7, 14, 30, 60, 90] as const).map(d => (
          <button key={d} onClick={() => handleSetDays(d)} style={{
            background: days === d ? "#111827" : "transparent", color: days === d ? "#fff" : "#9ca3af",
            borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 500,
            border: days === d ? "none" : "0.5px solid #e5e7eb", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0
          }}>{d}d</button>
        ))}
      </div>

      <div style={{ padding: "20px" }}>
        {/* Alert */}
        {error && (
          <div style={{ background: "#fef2f2", border: "0.5px solid #fecaca", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: RED, fontSize: 13 }}>⚠</span>
            <span style={{ fontSize: 13, color: "#991b1b" }}>{error}</span>
            {(error.includes("token") || error.includes("auth")) && (
              <button onClick={() => router.push("/relogin")} style={{ marginLeft: "auto", fontSize: 12, color: RED, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                Reconectar →
              </button>
            )}
          </div>
        )}

        {/* Week nav */}
        <div style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14, display: "flex", alignItems: "center", gap: 4 }}>
          <span>
            {weekOffset === 0 ? (() => {
              const mon = new Date(); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
              const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
              return `Semana del ${mon.getDate()} al ${sun.getDate()} de ${sun.toLocaleDateString("es-AR", { month: "long" })}`;
            })() : weekLabel}
          </span>
          <button onClick={() => setWeekOffset(w => w - 1)} style={{ fontSize: 14, color: "#9ca3af", background: "none", border: "none", cursor: "pointer" }}>‹</button>
          <button onClick={() => setWeekOffset(w => w + 1)} style={{ fontSize: 14, color: "#9ca3af", background: "none", border: "none", cursor: "pointer" }}>›</button>
          {weekOffset !== 0 && <button onClick={() => setWeekOffset(0)} style={{ fontSize: 10, color: RED, background: "none", border: "none", cursor: "pointer" }}>Hoy</button>}
        </div>

        {/* Cards */}
        {data && (
          <>
            <div className="ic-cards-grid" style={{ gap: 12, marginBottom: 12 }}>

              {/* IAC */}
              <div onClick={() => router.push("/iac")} style={{
                background: "#fff", border: `0.5px solid ${iacColor}20`,
                borderTop: `4px solid ${iacColor}`, borderRadius: "0 0 14px 14px",
                cursor: "pointer", overflow: "hidden",
              }}>
                <div style={{ background: `${iacColor}08`, padding: "14px 16px 10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em" }}>Actividad comercial</span>
                      <span title="Reuniones cara a cara realizadas vs el objetivo semanal. 100% = motor encendido, pipeline activo." style={{ fontSize: 10, color: "#d1d5db", cursor: "help", border: "0.5px solid #e5e7eb", borderRadius: "50%", width: 14, height: 14, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>?</span>
                    </div>
                    <span style={{ fontSize: 13, color: "#d1d5db" }}>›</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
                    <div style={{ fontSize: 56, fontWeight: 500, fontFamily: "Georgia, serif", color: iacColor, lineHeight: 1 }}>{iac}%</div>
                    <div style={{ fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 20, background: iac >= 100 ? "#EAF3DE" : iac >= 67 ? "#FAEEDA" : "#FCEBEB", color: iac >= 100 ? "#3B6D11" : iac >= 67 ? "#854F0B" : "#A32D2D" }}>{iacLabel}</div>
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{weekGreens} de {weekGoal} reuniones · {weekLabel}</div>
                </div>
                <div style={{ padding: "10px 16px 14px" }}>
                  <div style={{ height: 6, background: "#f3f4f6", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 3, background: iacColor, width: `${Math.min(100, iac)}%` }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: "#9ca3af" }}>0</span>
                    <span style={{ fontSize: 10, color: iacColor, fontWeight: 500 }}>{weekGoal} meta</span>
                  </div>
                  {visibleWeekTotals && (
                    <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                      {visibleWeekTotals.tasaciones > 0 && <span style={{ fontSize: 10, background: "#f3f4f6", color: "#374151", borderRadius: 6, padding: "2px 7px" }}>🏠 {visibleWeekTotals.tasaciones} tasac.</span>}
                      {visibleWeekTotals.visitas > 0 && <span style={{ fontSize: 10, background: "#f3f4f6", color: "#374151", borderRadius: 6, padding: "2px 7px" }}>👁 {visibleWeekTotals.visitas} visitas</span>}
                      {visibleWeekTotals.propuestas > 0 && <span style={{ fontSize: 10, background: "#f3f4f6", color: "#374151", borderRadius: 6, padding: "2px 7px" }}>📋 {visibleWeekTotals.propuestas} prop.</span>}
                      {visibleWeekTotals.firmas > 0 && <span style={{ fontSize: 10, background: "#EAF3DE", color: "#3B6D11", borderRadius: 6, padding: "2px 7px", fontWeight: 500 }}>✓ {visibleWeekTotals.firmas} firma{visibleWeekTotals.firmas !== 1 ? "s" : ""}</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Cartera */}
              <div onClick={() => router.push("/cartera")} style={{ cursor: "pointer" }}>
                <TokkoPortfolioCard />
              </div>

              {/* Racha + Rango */}
              <div onClick={() => router.push("/racha-rango")} style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden", cursor: "pointer" }}>
                <div style={{ padding: "14px 16px 10px", borderBottom: "0.5px solid #f3f4f6" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em" }}>Racha y rango</span>
                      <span title="Días consecutivos con al menos 1 reunión verde. Si perdés un día, la racha se reinicia. El rango sube según tu IAC sostenido." style={{ fontSize: 10, color: "#d1d5db", cursor: "help", border: "0.5px solid #e5e7eb", borderRadius: "50%", width: 14, height: 14, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>?</span>
                    </div>
                    <span style={{ fontSize: 13, color: "#d1d5db" }}>›</span>
                  </div>
                </div>
                <div style={{ padding: "12px 16px 14px" }}>
                  {data.streak !== undefined && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                          <div style={{ fontSize: 44, fontWeight: 500, fontFamily: "Georgia, serif", color: data.streak.current > 0 ? "#111827" : "#9ca3af", lineHeight: 1 }}>{data.streak.current}</div>
                          <div style={{ fontSize: 13, color: "#6b7280" }}>días</div>
                        </div>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Récord: {data.streak.best} días 🏆</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 36, lineHeight: 1 }}>{data.streak.current >= 20 ? "🔥" : data.streak.current >= 10 ? "⚡" : data.streak.current > 0 ? "✦" : "💤"}</div>
                        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>{data.streak.current >= 20 ? "En llamas" : data.streak.current >= 10 ? "Muy activo" : data.streak.current > 0 ? "Activo" : "Sin racha"}</div>
                      </div>
                    </div>
                  )}
                  {data.streak !== undefined && (
                    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} title="Escudo protector" style={{ width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, background: i < (data.streak as any).shields ? "#EEF2FF" : "#f3f4f6", border: `0.5px solid ${i < (data.streak as any).shields ? "#c7d2fe" : "#e5e7eb"}` }}>
                          {i < (data.streak as any).shields ? "🛡" : "·"}
                        </div>
                      ))}
                      <span style={{ fontSize: 11, color: "#9ca3af", alignSelf: "center", marginLeft: 2 }}>protectores</span>
                    </div>
                  )}
                  {data.rankStats && (
                    <div style={{ background: "#f9fafb", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 22 }}>{data.rankStats.currentRank?.icon ?? "🏠"}</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{data.rankStats.currentRank?.label ?? "Agente"}</div>
                            <div style={{ fontSize: 10, color: "#9ca3af" }}>rango actual</div>
                          </div>
                        </div>
                        {data.rankStats.nextRank && (
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 11, color: "#9ca3af" }}>próximo</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                              <span style={{ fontSize: 14 }}>{data.rankStats.nextRank.icon}</span>
                              <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{data.rankStats.nextRank.label}</span>
                            </div>
                          </div>
                        )}
                      </div>
                      {data.rankStats.nextRank && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ height: 3, background: "#e5e7eb", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", background: "#6366f1", borderRadius: 2, width: `${Math.min(100, (data.rankStats as any).progressPct ?? 40)}%` }} />
                          </div>
                          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>
                            {(data.rankStats as any).weeksAtCurrentIAC ?? 0} sem. en objetivo · necesitás {(data.rankStats as any).weeksToNext ?? "?"} más
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Posición */}
              <div onClick={() => router.push("/posicion")} style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden", cursor: "pointer" }}>
                <div style={{ padding: "14px 16px 10px", borderBottom: "0.5px solid #f3f4f6" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em" }}>Posición en el equipo</span>
                      <span title="Tu posición en el ranking del equipo esta semana, basada en IAC." style={{ fontSize: 10, color: "#d1d5db", cursor: "help", border: "0.5px solid #e5e7eb", borderRadius: "50%", width: 14, height: 14, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>?</span>
                    </div>
                    {isOwner && <span style={{ fontSize: 13, color: "#d1d5db" }}>›</span>}
                  </div>
                </div>
                <div style={{ padding: "12px 16px 14px" }}>
                  <RankingPosition compact />
                </div>
              </div>
            </div>

            {/* Coach */}
            <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "14px 16px 10px", borderBottom: "0.5px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af" }}>Análisis del coach</span>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>Inmo Coach ✦</span>
              </div>
              <div style={{ padding: 16 }}>
                <InstaCoacPanel data={data} calView={days <= 14 ? "week" : "month"} monthOffset={monthOffset} weekOffset={weekOffset} days={days} />
              </div>
            </div>
          </>
        )}

        {!data && !loading && !error && <EmptyDashboard userName={session?.user?.name ?? ""} onSync={sync} syncing={syncing} />}
      </div>

      {showOnboarding && <OnboardingModal onClose={handleOnboardingClose} />}
      {brokerExpiredModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 400, width: "100%" }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: "#111827", marginBottom: 8 }}>Suscripción del equipo vencida</div>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>El plan de {brokerExpiredModal.brokerName} venció. Contactalo para reactivar el acceso del equipo.</div>
            <a href={`mailto:${brokerExpiredModal.brokerEmail}`} style={{ display: "block", marginTop: 16, fontSize: 13, color: RED }}>{brokerExpiredModal.brokerEmail}</a>
          </div>
        </div>
      )}
      {subPlan === "free" && <PushPrompt />}
    </AppLayout>
  );
}
