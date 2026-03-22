import { useSession, signOut } from "next-auth/react";
import OnboardingModal from "../components/OnboardingModal";
import StreakBadge from "../components/StreakBadge";
import RankBadge from "../components/RankBadge";
import RankingPosition from "../components/RankingPosition";
import AgentVsTeam from "../components/AgentVsTeam";
import TokkoPortfolio from "../components/TokkoPortfolio";
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
      <div className="grid grid-cols-7 divide-x divide-gray-100 min-h-[320px]">
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

  const [syncing, setSyncing] = useState(false); // sync en background
  const [fromCache, setFromCache] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

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
        // Si hay datos de caché, no mostrar error — solo loggear
        if (!data) setError(errData.error || "Error de sincronización");
      }
    } catch (e: any) {
      if (!data) setError(e.message);
    }
    setSyncing(false);
  };

  const sync = async () => {
    setLoading(true);
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
    setLoading(true);
    loadFromCache(days).then(() => syncWithGoogle(days).then(() => setLoading(false)));
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

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <Head>
        <title>InmoCoach</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet" />
      </Head>

      {/* Top accent line */}
      <div className="h-0.5 w-full" style={{ background: RED }} />

      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2 mr-auto">
            <div className="font-black text-lg tracking-tight" style={{ color: RED, fontFamily: "Georgia, serif" }}>
              Inmo<span className="text-gray-900">Coach</span>
            </div>
            {subPlan === "free" ? (
              <Link href="/pricing">
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ background: "#fef2f2", color: RED }}>
                  {daysLeft !== null ? `${daysLeft}d gratis` : "Activar →"}
                </span>
              </Link>
            ) : (
              <Link href="/cuenta">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                  style={{ background: "#f3f4f6", color: "#6b7280" }}>
                  Mi cuenta
                </span>
              </Link>
            )}

          </div>

          <div style={{ display: "flex", alignItems: "center", background: "#f3f4f6", borderRadius: "12px", padding: "4px", gap: "2px" }} className="hidden sm:flex">
            {([7, 14, 30, 60, 90] as const).map(d => (
              <button key={d} onClick={() => handleSetDays(d)}
                style={days === d
                  ? { background: "#fff", color: "#111827", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", borderRadius: "8px", padding: "4px 8px", fontSize: "11px", fontWeight: 700, border: "none", cursor: "pointer", whiteSpace: "nowrap" }
                  : { color: "#9ca3af", borderRadius: "8px", padding: "4px 8px", fontSize: "11px", fontWeight: 700, border: "none", cursor: "pointer", background: "transparent", whiteSpace: "nowrap" }}>
                {d}d
              </button>
            ))}
          </div>

          {isOwner ? (
            <button onClick={() => router.push("/equipo")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-colors border border-gray-200">
              <Users size={11} />
              <span className="hidden sm:inline">Mi equipo</span>
            </button>
          ) : !hasTeam ? (
            <button onClick={() => router.push(subPlan === "free" ? "/pricing" : "/cuenta")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold hover:opacity-90 transition-all border"
              style={{ background: "#fef2f2", color: RED, borderColor: "#fecaca" }}>
              <Users size={11} />
              <span className="hidden sm:inline">{subPlan === "free" ? "Sumar agentes" : "Invitar agentes"}</span>
            </button>
          ) : null}

          <button onClick={sync} disabled={loading || syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border"
            style={{
              color: syncing ? "#d97706" : "#6b7280",
              borderColor: syncing ? "#fcd34d" : "#e5e7eb",
              background: syncing ? "#fffbeb" : "white",
            }}>
            <RefreshCw size={11} className={loading || syncing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">
              {loading ? "Cargando" : syncing ? "Actualizando" : fromCache ? "Actualizar" : "Actualizar"}
            </span>
          </button>

          {session?.user?.image ? (
            <img src={session.user.image} alt="" className="w-7 h-7 rounded-full cursor-pointer ring-2"
              style={{ outline: `2px solid ${RED}`, outlineOffset: "2px" }} onClick={() => signOut({ callbackUrl: "/login" })} />
          ) : (
            <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-gray-400 hover:text-gray-700">
              <LogOut size={15} />
            </button>
          )}
        </div>
      </header>

      {/* Days selector — mobile only, scrollable strip below header */}
      <div className="sm:hidden bg-white border-b border-gray-100 px-4 py-2 flex gap-1 overflow-x-auto">
        {([7, 14, 30, 60, 90] as const).map(d => (
          <button key={d} onClick={() => handleSetDays(d)}
            style={days === d
              ? { background: "#111827", color: "#fff", borderRadius: "8px", padding: "4px 12px", fontSize: "12px", fontWeight: 700, border: "none", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }
              : { color: "#9ca3af", borderRadius: "8px", padding: "4px 12px", fontSize: "12px", fontWeight: 700, border: "1px solid #e5e7eb", cursor: "pointer", background: "transparent", whiteSpace: "nowrap", flexShrink: 0 }}>
            {d}d
          </button>
        ))}
      </div>

      <main className="max-w-6xl mx-auto px-5 py-6 pb-16 space-y-5">

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={15} style={{ color: RED }} className="mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-red-700 mb-0.5">No se pudo conectar con Google Calendar</p>
                <p className="text-xs text-red-500">{error}</p>
              </div>
              <button onClick={sync} className="text-xs font-bold px-3 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-100 transition-all shrink-0">
                Reintentar
              </button>
            </div>
            {error.includes("token") || error.includes("auth") || error.includes("permission") ? (
              <div className="mt-3 pt-3 border-t border-red-100">
                <button onClick={() => router.push("/relogin")} className="text-xs font-bold text-red-600 underline">
                  Reconectar Google Calendar →
                </button>
              </div>
            ) : null}
          </div>
        )}

        {data && (
          <>
            {/* Greeting */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-black text-gray-900" style={{ fontFamily: "Georgia, serif" }}>
                  Buenos días, {data.user.name?.split(" ")[0]}.
                </h1>
                <p className="text-sm text-gray-400 mt-0.5">
                  Última sincronización: {new Date(data.syncedAt).toLocaleString("es-AR", { weekday: "long", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              {(() => {
                const wt = (days <= 14 && visibleWeekTotals) ? visibleWeekTotals : null;
                const iacPeriod = wt ? wt.iac : Math.round((data.totals.totalGreen / Math.max(1, days / 7)) / (data.totals.iacGoal ?? 15) * 100);
                const iacColor = iacPeriod >= 100 ? GREEN : iacPeriod >= 67 ? "#d97706" : RED;
                const iacBg = iacPeriod >= 100 ? "#f0fdf4" : iacPeriod >= 67 ? "#fffbeb" : "#fef2f2";
                const weekLabel = weekOffset === 0 ? `${days}d` : weekOffset === -1 ? "sem. pasada" : `hace ${Math.abs(weekOffset)} sem.`;
                return (
                  <div className="flex flex-col items-end">
                    <div className="relative group">
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold cursor-default"
                        style={{ background: iacBg, color: iacColor }}>
                        IAC {iacPeriod}%
                        <span className="w-4 h-4 rounded-full border flex items-center justify-center text-xs font-bold opacity-60"
                          style={{ borderColor: iacColor, color: iacColor, fontSize: "9px" }}>?</span>
                      </div>
                      <div className="absolute right-0 top-full mt-2 z-50 w-64 hidden group-hover:block">
                        <div className="bg-gray-900 text-white text-xs rounded-xl px-3 py-2.5 leading-relaxed shadow-xl">
                          <strong>Índice de Actividad Comercial</strong><br/>Tu nivel de actividad comparado con lo esperable para convertirte en Top Producer. 100% = {data.totals.iacGoal ?? 15} reuniones cara a cara por semana.
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1 text-right">
                      {(days <= 14 && visibleWeekTotals ? visibleWeekTotals.totalGreen : data.totals.totalGreen)} reuniones · {weekLabel}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* KPIs */}
            {(() => {
              const wt = (days <= 14 && visibleWeekTotals) ? visibleWeekTotals : null;
              const totals = wt ? { ...data.totals, totalGreen: wt.totalGreen, tasaciones: wt.tasaciones, visitas: wt.visitas, propuestas: wt.propuestas, firmas: wt.firmas } : data.totals;
              const weekLabel2 = weekOffset === 0 ? `${days}d` : weekOffset === -1 ? "sem. pasada" : `hace ${Math.abs(weekOffset)} sem.`;
              return (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative z-10">
              <KpiCard
                label="Eventos verdes"
                value={totals.totalGreen}
                accent
                sub={`${weekLabel2} · objetivo ${data.totals.iacGoal ?? 15}`}
                tooltip="Cada vez que estás cara a cara con una persona hablando de tu negocio. Reuniones, visitas, tasaciones, propuestas — todo lo que genera dinero. El motor del negocio."
              />
              <KpiCard
                label="Visitas"
                value={totals.visitas}
                sub={`venta · alquiler · propiedad`}
                tooltip="Cantidad de visitas a propiedades: venta, alquiler o conocer propiedad. Toda visita mueve el pipeline. Enfocate en visitas de venta para maximizar ingresos."
              />
              <KpiCard
                label="Tasaciones · Propuestas"
                value={`${totals.tasaciones} · ${totals.propuestas}`}
                sub="captaciones + presentaciones"
                tooltip={`Se muestran eventos con las palabras "tasación" o "captación" (${totals.tasaciones}) y eventos con "propuesta" o "presentación" (${totals.propuestas}). La propuesta de valor es la segunda fase de la captación: el momento donde te diferenciás para lograr captar en exclusiva.`}
              />
              <KpiCard
                label="Firmas"
                value={totals.firmas ?? 0}
                sub="cierres de operación"
                tooltip='Operaciones cerradas. El evento debe tener la palabra "Firma" en el título (firma de contrato, firma de escritura, etc.).'
              />
            </div>
              );
            })()}

            {/* Push notifications prompt — solo si ya cerró el onboarding */}
            {!showOnboarding && <PushPrompt />}

            {/* Streak */}
            {data.streak !== undefined && (
              <StreakBadge
                current={data.streak.current}
                best={data.streak.best}
                todayActive={data.streak.todayActive}
                minGreens={data.streak.minGreens ?? 1}
                shields={data.streak.shields ?? 0}
              />
            )}

            {/* Rango */}
            {data.rankStats && <RankBadge stats={data.rankStats} />}

            {/* Posición en ranking */}
            <RankingPosition />

            {/* Evolución histórica + comparativa vs equipo */}
            <AgentVsTeam weekOffset={weekOffset} />

            {/* Cartera Tokko — solo si el equipo tiene Tokko conectado */}
            <TokkoPortfolio />

            {/* Productividad + Trend */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white border border-gray-100 rounded-2xl p-5 col-span-1 sm:col-span-2" style={{ position: "relative", zIndex: 0 }}>
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
                const wt = (days <= 14 && visibleWeekTotals) ? visibleWeekTotals : null;
                const semanas = Math.max(1, days / 7);
                const greenCount = wt ? wt.totalGreen : data.totals.totalGreen;
                const iacGoal = wt ? wt.iacGoal : (data.totals.iacGoal ?? 15);
                const iacPeriod = wt ? wt.iac : Math.round((greenCount / semanas) / iacGoal * 100);
                const iacColor = iacPeriod >= 100 ? GREEN : iacPeriod >= 67 ? "#d97706" : RED;
                const goalPeriod = Math.round(iacGoal * semanas);
                return (
                  <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-row sm:flex-col justify-between sm:justify-center gap-4">
                    <div>
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
                        IAC · {days === 7 ? "esta semana" : `${days}d`}
                      </div>
                      <div className="text-4xl font-black" style={{ color: iacColor, fontFamily: "Georgia, serif" }}>
                        {iacPeriod}%
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {greenCount} reuniones · meta {goalPeriod}
                      </div>
                      <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, iacPeriod)}%`, background: iacColor }} />
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Objetivo semanal</div>
                      <div className="text-4xl font-black text-gray-900" style={{ fontFamily: "Georgia, serif" }}>{iacGoal}</div>
                      <div className="text-xs text-gray-400 mt-1">reuniones cara a cara / semana</div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Calendar — auto semana si ≤30d, mes si >30d */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                  Calendario · {days < 30 ? "vista semana" : "vista mes"}
                </div>
              </div>

              {days < 30 ? (
                <WeeklyView
                  summaries={data.dailySummaries}
                  weekOffset={weekOffset}
                  onPrev={() => setWeekOffset(w => w - 1)}
                  onNext={() => setWeekOffset(w => w + 1)}
                />
              ) : (
                <MonthlyView
                  summaries={data.dailySummaries}
                  monthOffset={monthOffset}
                  onPrev={() => setMonthOffset(m => m - 1)}
                  onNext={() => setMonthOffset(m => m + 1)}
                />
              )}

              {/* Legend */}
              <div className="flex items-center gap-4 mt-2 px-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-green-200" />
                  <span className="text-xs text-gray-400 font-medium">1 a 1 cara a cara</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-gray-200" />
                  <span className="text-xs text-gray-400 font-medium">Otros eventos</span>
                </div>
              </div>
            </div>

            {/* Inmo Coach */}
            <InstaCoacPanel data={data} calView={days < 30 ? "week" : "month"} monthOffset={monthOffset} weekOffset={weekOffset} days={days} />
          </>
        )}
      </main>
      {showOnboarding && <OnboardingModal onClose={handleOnboardingClose} weeklyGoal={data?.totals?.iacGoal ?? 15} />}

      {brokerExpiredModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="text-2xl text-center">⚠️</div>
            <div className="text-base font-black text-gray-900 text-center">Tu equipo no continuó en InmoCoach</div>
            <p className="text-sm text-gray-500 text-center leading-relaxed">
              El broker <strong>{brokerExpiredModal.brokerName}</strong> no renovó el plan del equipo.<br/>
              Tenés 7 días de acceso gratuito para decidir qué hacer.
            </p>
            <div className="space-y-2">
              <a href={`mailto:${brokerExpiredModal.brokerEmail}?subject=InmoCoach - Renovación del equipo`}
                className="block w-full text-center py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:border-gray-400 transition-all">
                Contactar a {brokerExpiredModal.brokerName}
              </a>
              <button onClick={() => { setBrokerExpiredModal(null); router.push("/pricing"); }}
                className="block w-full text-center py-2.5 rounded-xl text-sm font-black text-white transition-all"
                style={{ background: "#aa0000" }}>
                Contratar plan individual →
              </button>
              <button onClick={() => setBrokerExpiredModal(null)}
                className="block w-full text-center py-2 text-xs text-gray-400 hover:text-gray-600">
                Cerrar (me quedan días de acceso)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
