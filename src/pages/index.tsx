import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState, useMemo } from "react";
import Head from "next/head";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from "recharts";
import { LogOut, RefreshCw, AlertTriangle, Calendar, Target, Eye, Zap, TrendingUp, Brain, ChevronDown, ChevronLeft, ChevronRight, Award, Loader2, DollarSign, Mail, CheckCircle } from "lucide-react";

const RED = "#aa0000";
const GREEN = "#16a34a";
const PRODUCTIVITY_GOAL = parseInt(process.env.NEXT_PUBLIC_PRODUCTIVITY_GOAL || "10");

interface CalendarEvent { id: string; title: string; type: string; isGreen: boolean; start: string; }
interface DaySummary { date: string; greenCount: number; isProductive: boolean; events: CalendarEvent[]; }
interface CalendarData {
  user: { name: string; email: string; image?: string };
  syncedAt: string;
  totals: { tasaciones: number; visitas: number; propuestas: number; reuniones: number; otros: number; totalGreen: number; totalEvents: number; };
  productivityGoal: number;
  productiveDays: number;
  totalDays: number;
  productivityRate: number;
  dailySummaries: DaySummary[];
  recentEvents: CalendarEvent[];
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

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent, delay = 0 }: any) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{label}</div>
      <div className="text-4xl font-black leading-none" style={{ color: accent ? RED : "#111827", fontFamily: "Georgia, serif" }}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-2">{sub}</div>}
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
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7); // Monday

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
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
          const dateStr = day.toISOString().slice(0, 10);
          const summary = byDate[dateStr];
          const isToday = dateStr === today.toISOString().slice(0, 10);
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
          const isToday = dateStr === today.toISOString().slice(0, 10);
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
                  <div key={ev.id} className="text-xs bg-green-100 text-green-800 rounded px-1 truncate font-medium leading-tight py-0.5">
                    {ev.title}
                  </div>
                ))}
                {grayEvs.slice(0, 1).map(ev => (
                  <div key={ev.id} className="text-xs bg-gray-100 text-gray-400 rounded px-1 truncate leading-tight py-0.5">
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

// ─── Insta Coach Panel ────────────────────────────────────────────────────────
function InstaCoacPanel({ data }: { data: CalendarData }) {
  const [advice, setAdvice] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const analyze = async () => {
    setLoading(true);
    setAdvice("");
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totals: data.totals,
          productivityRate: data.productivityRate,
          productiveDays: data.productiveDays,
          totalDays: data.totalDays,
          productivityGoal: data.productivityGoal,
          userName: data.user.name,
        }),
      });
      const json = await res.json();
      setAdvice(json.advice || "No se pudo obtener el análisis.");
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

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center">
            <Brain size={15} className="text-gray-500" />
          </div>
          <div>
            <div className="font-black text-sm text-gray-900">Insta Coach</div>
            <div className="text-xs text-gray-400">análisis de tu semana</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={sendTestEmail} disabled={emailSending || emailSent}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
            style={{ color: emailSent ? "#16a34a" : "#6b7280" }}>
            {emailSending ? <Loader2 size={11} className="animate-spin" /> : emailSent ? <CheckCircle size={11} /> : <Mail size={11} />}
            {emailSent ? "Enviado!" : emailSending ? "Enviando..." : "Mail de prueba"}
          </button>
          <button onClick={analyze} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: RED }}>
            {loading ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
            {loading ? "Analizando..." : "Analizar"}
          </button>
        </div>
      </div>
      {advice ? (
        <p className="text-sm text-gray-600 leading-relaxed">{advice}</p>
      ) : (
        <p className="text-sm text-gray-400">
          Presioná "Analizar" para recibir el consejo más importante basado en tu actividad real.
        </p>
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
  const [days, setDays] = useState(60);
  const [subPlan, setSubPlan] = useState("free");
  const [calView, setCalView] = useState<"week" | "month">("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/subscription").then(r => r.json()).then(d => {
        setSubPlan(d.plan?.id ?? "free");
        if (d.subscription?.isExpired) router.push("/expired");
      });
    }
  }, [status]);

  const sync = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/calendar?days=${days}`);
      if (!res.ok) throw new Error((await res.json()).error || "Error de sincronización");
      setData(await res.json());
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { if (status === "authenticated") sync(); }, [status, days]);

  const trendData = useMemo(() => {
    if (!data) return [];
    return data.dailySummaries.slice(-14).map(d => ({
      date: d.date.slice(5),
      verdes: d.greenCount,
      meta: PRODUCTIVITY_GOAL,
    }));
  }, [data]);

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
        <title>InstaCoach</title>
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
              Insta<span className="text-gray-900">Coach</span>
            </div>
            <Link href="/pricing">
              <span className="text-xs font-bold px-2 py-0.5 rounded-md uppercase cursor-pointer"
                style={{ background: subPlan === "free" ? "#f3f4f6" : "#fef2f2", color: subPlan === "free" ? "#9ca3af" : RED }}>
                {subPlan}
              </span>
            </Link>
          </div>

          <div className="relative hidden sm:block">
            <select value={days} onChange={e => setDays(parseInt(e.target.value))}
              className="appearance-none bg-gray-100 rounded-xl px-3 py-1.5 pr-7 text-xs font-semibold text-gray-600 focus:outline-none cursor-pointer border-0">
              <option value={14}>14 días</option>
              <option value={30}>30 días</option>
              <option value={60}>60 días</option>
              <option value={90}>90 días</option>
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          <button onClick={sync} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-colors border border-gray-200">
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">{loading ? "Sincronizando" : "Actualizar"}</span>
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

      <main className="max-w-6xl mx-auto px-5 py-6 pb-16 space-y-5">

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 flex items-center gap-3">
            <AlertTriangle size={15} style={{ color: RED }} />
            <p className="text-sm font-medium text-red-700">{error}</p>
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
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
                style={{ background: data.productivityRate >= 50 ? "#f0fdf4" : "#fef2f2", color: data.productivityRate >= 50 ? GREEN : RED }}>
                {data.productivityRate}% días productivos
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard label="Tasaciones" value={data.totals.tasaciones} accent delay={0} />
              <KpiCard label="Visitas" value={data.totals.visitas} delay={60} />
              <KpiCard label="Propuestas" value={data.totals.propuestas} delay={120} />
              <KpiCard label="Eventos verdes" value={data.totals.totalGreen} accent delay={180}
                sub={`de ${data.totals.totalEvents} totales`} />
            </div>

            {/* Productividad + Trend */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white border border-gray-100 rounded-2xl p-5 sm:col-span-2">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Tendencia — eventos verdes</div>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#d1d5db", fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "#d1d5db" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: "none", fontSize: 11, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }} />
                    <Line type="monotone" dataKey="meta" stroke="#e5e7eb" strokeWidth={1.5} dot={false} strokeDasharray="4 4" name="Meta" />
                    <Line type="monotone" dataKey="verdes" stroke={GREEN} strokeWidth={2} dot={{ fill: GREEN, r: 3 }} name="Verdes" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col justify-center gap-4">
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Días productivos</div>
                  <div className="text-4xl font-black" style={{ color: RED, fontFamily: "Georgia, serif" }}>{data.productiveDays}</div>
                  <div className="text-xs text-gray-400 mt-1">de {data.totalDays} analizados</div>
                  <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${data.productivityRate}%`, background: RED }} />
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Meta diaria</div>
                  <div className="text-4xl font-black text-gray-900" style={{ fontFamily: "Georgia, serif" }}>{PRODUCTIVITY_GOAL}</div>
                  <div className="text-xs text-gray-400 mt-1">eventos 1 a 1 cara a cara</div>
                </div>
              </div>
            </div>

            {/* Calendar */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Calendario</div>
                <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                  {(["week", "month"] as const).map(v => (
                    <button key={v} onClick={() => setCalView(v)}
                      className="px-3 py-1 rounded-lg text-xs font-bold transition-all"
                      style={calView === v ? { background: "#fff", color: "#111827", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" } : { color: "#9ca3af" }}>
                      {v === "week" ? "Semana" : "Mes"}
                    </button>
                  ))}
                </div>
              </div>

              {calView === "week" ? (
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

            {/* Insta Coach */}
            <InstaCoacPanel data={data} />
          </>
        )}
      </main>
    </div>
  );
}
