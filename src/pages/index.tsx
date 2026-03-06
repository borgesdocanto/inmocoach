import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line
} from "recharts";
import {
  LogOut, RefreshCw, CheckCircle2, AlertTriangle,
  Calendar, Target, Eye, Zap, TrendingUp, Brain,
  ChevronDown, Award, Users, Loader2, Flame
} from "lucide-react";

const GALAS_RED = "#aa0000";
const PRODUCTIVITY_GOAL = parseInt(process.env.NEXT_PUBLIC_PRODUCTIVITY_GOAL || "10");

// ─── Types ────────────────────────────────────────────────────────────────────
interface CalendarData {
  user: { name: string; email: string; image?: string };
  syncedAt: string;
  totals: {
    tasaciones: number; visitas: number; propuestas: number;
    reuniones: number; otros: number; totalGreen: number; totalEvents: number;
  };
  productivityGoal: number;
  productiveDays: number;
  totalDays: number;
  productivityRate: number;
  dailySummaries: Array<{
    date: string; greenCount: number; isProductive: boolean;
    events: Array<{ id: string; title: string; type: string; isGreen: boolean; start: string }>;
  }>;
  recentEvents: Array<{
    id: string; title: string; type: string; isGreen: boolean; start: string;
  }>;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, sub, accent, delay = 0 }: any) {
  return (
    <div
      className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 animate-fade-up hover:shadow-md transition-all"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: accent ? "#f9e6e6" : "#f1f5f9" }}>
          <Icon size={14} style={{ color: accent ? GALAS_RED : "#94a3b8" }} />
        </div>
      </div>
      <div className="font-display font-black text-4xl leading-none" style={{ color: accent ? GALAS_RED : "#1e293b" }}>
        {value}
      </div>
      {sub && <div className="text-xs text-slate-400 font-semibold mt-2">{sub}</div>}
    </div>
  );
}

function ProductivityBadge({ rate }: { rate: number }) {
  const ok = rate >= 50;
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-2xl font-bold text-sm"
      style={{ background: ok ? "#f0fdf4" : "#fef2f2", color: ok ? "#16a34a" : GALAS_RED }}>
      {ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
      {rate}% días productivos
    </div>
  );
}

function CoachPanel({ data }: { data: CalendarData }) {
  const [advice, setAdvice] = useState("");
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    setLoading(true);
    setAdvice("");
    const { totals, productivityRate, productiveDays, totalDays } = data;
    const prompt = `Sos un coach de ventas inmobiliarias de alto rendimiento. Analizá este embudo y dá un consejo concreto, directo y accionable en 3-4 oraciones. Solo párrafos, sin listas. Hablá en segunda persona, motivá a actuar HOY.

DATOS:
- Tasaciones: ${totals.tasaciones}
- Visitas: ${totals.visitas}
- Propuestas de valor: ${totals.propuestas}
- Reuniones: ${totals.reuniones}
- Total eventos productivos (verdes): ${totals.totalGreen}
- Días productivos (≥${PRODUCTIVITY_GOAL} eventos verdes): ${productiveDays} de ${totalDays} (${productivityRate}%)
- Meta diaria de eventos verdes: ${PRODUCTIVITY_GOAL}

Identificá el cuello de botella más crítico y dá el consejo más valioso.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const json = await res.json();
      const text = json.content?.map((b: any) => b.text || "").join("") || "Sin respuesta.";
      setAdvice(text);
    } catch {
      setAdvice("Error al conectar con el Coach IA.");
    }
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 animate-fade-up" style={{ animationDelay: "300ms" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#f9e6e6" }}>
            <Brain size={15} style={{ color: GALAS_RED }} />
          </div>
          <div>
            <div className="font-black text-sm text-slate-800">Coach IA</div>
            <div className="text-xs text-slate-400">basado en tu Calendar</div>
          </div>
        </div>
        <button onClick={analyze} disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-black text-white transition-all hover:scale-105 disabled:opacity-60"
          style={{ background: `linear-gradient(135deg, #1e293b, #334155)` }}>
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
          {loading ? "Analizando..." : "Analizar"}
        </button>
      </div>

      {advice ? (
        <p className="text-slate-700 text-sm leading-relaxed font-medium">{advice}</p>
      ) : (
        <p className="text-slate-400 text-sm font-medium">
          Presioná "Analizar" para que el Coach lea tus números y te dé el consejo más importante del día.
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
  const [days, setDays] = useState(30);
  const [activeTab, setActiveTab] = useState<"resumen" | "dias" | "eventos">("resumen");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const sync = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/calendar?days=${days}`);
      if (!res.ok) throw new Error((await res.json()).error || "Error de sincronización");
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  // Auto-sync al abrir
  useEffect(() => {
    if (status === "authenticated") sync();
  }, [status, days]);

  const funnelData = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Tasaciones", valor: data.totals.tasaciones },
      { name: "Visitas", valor: data.totals.visitas },
      { name: "Propuestas", valor: data.totals.propuestas },
      { name: "Reuniones", valor: data.totals.reuniones },
    ];
  }, [data]);

  const trendData = useMemo(() => {
    if (!data) return [];
    return data.dailySummaries.slice(-14).map(d => ({
      date: d.date.slice(5),
      verdes: d.greenCount,
      meta: PRODUCTIVITY_GOAL,
      productivo: d.isProductive,
    }));
  }, [data]);

  if (status === "loading" || (!data && !error && loading)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg animate-pulse"
          style={{ background: `linear-gradient(135deg, ${GALAS_RED}, #6b0000)` }}>G</div>
        <div className="flex items-center gap-2 text-slate-500 font-bold text-sm">
          <Loader2 size={16} className="animate-spin" style={{ color: GALAS_RED }} />
          Sincronizando tu Calendar...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-1 fixed top-0 left-0 right-0 z-50"
        style={{ background: `linear-gradient(90deg, ${GALAS_RED}, #6b0000, ${GALAS_RED})` }} />

      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-1 z-40 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2 mr-auto">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-sm shadow"
              style={{ background: `linear-gradient(135deg, ${GALAS_RED}, #6b0000)` }}>G</div>
            <div>
              <div className="font-display font-black text-base leading-none" style={{ color: GALAS_RED }}>GALAS</div>
              <div className="text-xs text-slate-300 font-semibold leading-none">MANAGEMENT</div>
            </div>
          </div>

          {/* Days filter */}
          <div className="relative hidden sm:block">
            <select value={days} onChange={e => setDays(parseInt(e.target.value))}
              className="appearance-none bg-slate-100 rounded-2xl px-4 py-2 pr-8 text-xs font-black text-slate-600 focus:outline-none cursor-pointer">
              <option value={7}>7 días</option>
              <option value={14}>14 días</option>
              <option value={30}>30 días</option>
              <option value={60}>60 días</option>
              <option value={90}>90 días</option>
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Sync */}
          <button onClick={sync} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-black transition-all border"
            style={{ borderColor: `${GALAS_RED}44`, color: GALAS_RED }}>
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">{loading ? "Sincronizando" : "Sincronizar"}</span>
          </button>

          {/* Avatar */}
          {session?.user?.image ? (
            <img src={session.user.image} alt="" className="w-8 h-8 rounded-full border-2 cursor-pointer"
              style={{ borderColor: GALAS_RED }} onClick={() => signOut({ callbackUrl: "/login" })} />
          ) : (
            <button onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-700">
              <LogOut size={14} />
            </button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 pb-20 space-y-4">

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-3xl px-5 py-4 flex items-center gap-3">
            <AlertTriangle size={16} style={{ color: GALAS_RED }} />
            <p className="text-sm font-bold text-red-700">{error}</p>
          </div>
        )}

        {data && (
          <>
            {/* Bienvenida + productividad */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 animate-fade-up flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">
                  {new Date(data.syncedAt).toLocaleString("es-AR", { weekday: "long", hour: "2-digit", minute: "2-digit" })}
                </p>
                <h1 className="font-display font-black text-2xl text-slate-800">
                  Hola, {data.user.name?.split(" ")[0]}
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">{data.user.email}</p>
              </div>
              <ProductivityBadge rate={data.productivityRate} />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 rounded-2xl p-1 w-full">
              {[
                { key: "resumen", label: "Resumen", icon: TrendingUp },
                { key: "dias", label: "Por Día", icon: Calendar },
                { key: "eventos", label: "Eventos", icon: Zap },
              ].map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setActiveTab(key as any)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black transition-all"
                  style={activeTab === key
                    ? { background: GALAS_RED, color: "#fff", boxShadow: "0 2px 8px rgba(170,0,0,0.3)" }
                    : { color: "#64748b" }}>
                  <Icon size={12} />{label}
                </button>
              ))}
            </div>

            {/* ─── TAB: RESUMEN ────────────────────────────────────── */}
            {activeTab === "resumen" && (
              <div className="space-y-4 card-stagger">

                {/* KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <KpiCard label="Tasaciones" value={data.totals.tasaciones} icon={Target} accent delay={0} />
                  <KpiCard label="Visitas" value={data.totals.visitas} icon={Eye} delay={60} />
                  <KpiCard label="Propuestas" value={data.totals.propuestas} icon={Award} delay={120} />
                  <KpiCard label="Total Verdes" value={data.totals.totalGreen} icon={Flame} accent delay={180}
                    sub={`de ${data.totals.totalEvents} eventos`} />
                </div>

                {/* Productividad */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 animate-fade-up" style={{ animationDelay: "200ms" }}>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Días Productivos</div>
                    <div className="font-display font-black text-4xl leading-none" style={{ color: GALAS_RED }}>
                      {data.productiveDays}
                    </div>
                    <div className="text-xs text-slate-400 font-semibold mt-2">de {data.totalDays} días analizados</div>
                    <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${data.productivityRate}%`, background: `linear-gradient(90deg, ${GALAS_RED}, #6b0000)` }} />
                    </div>
                  </div>
                  <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 animate-fade-up" style={{ animationDelay: "240ms" }}>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Meta Diaria</div>
                    <div className="font-display font-black text-4xl leading-none text-slate-800">{PRODUCTIVITY_GOAL}</div>
                    <div className="text-xs text-slate-400 font-semibold mt-2">eventos verdes / día</div>
                    <div className="mt-3 flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ background: GALAS_RED }} />
                      <span className="text-xs font-bold text-slate-500">cara a cara, 1 a 1</span>
                    </div>
                  </div>
                </div>

                {/* Funnel Chart */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 animate-fade-up" style={{ animationDelay: "260ms" }}>
                  <h3 className="font-black text-slate-800 mb-4 text-sm">Distribución de Actividad</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={funnelData} barSize={36}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#cbd5e1" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 16, border: "none", boxShadow: "0 8px 32px rgba(0,0,0,0.1)", fontSize: 12, fontWeight: 700 }} />
                      <Bar dataKey="valor" radius={[10, 10, 0, 0]}>
                        {funnelData.map((_, i) => (
                          <Cell key={i} fill={i === 0 ? GALAS_RED : i === 1 ? "#cc2222" : i === 2 ? "#dd4444" : "#ee8888"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Coach */}
                <CoachPanel data={data} />
              </div>
            )}

            {/* ─── TAB: POR DÍA ────────────────────────────────────── */}
            {activeTab === "dias" && (
              <div className="space-y-4">
                {/* Trend line */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 animate-fade-up">
                  <h3 className="font-black text-slate-800 mb-4 text-sm">Eventos Verdes — Últimos 14 días</h3>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#cbd5e1", fontWeight: 700 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: "#cbd5e1" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: 11, fontWeight: 700 }} />
                      <Line type="monotone" dataKey="meta" stroke="#e2e8f0" strokeWidth={2} dot={false} name="Meta" strokeDasharray="4 4" />
                      <Line type="monotone" dataKey="verdes" stroke={GALAS_RED} strokeWidth={2.5} dot={{ fill: GALAS_RED, r: 3 }} name="Verdes" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Daily list */}
                <div className="space-y-2">
                  {[...data.dailySummaries].reverse().map((day, i) => (
                    <div key={day.date}
                      className="bg-white rounded-3xl px-5 py-4 shadow-sm border border-slate-100 flex items-center gap-4 animate-fade-up"
                      style={{ animationDelay: `${i * 30}ms` }}>
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 ${day.isProductive ? "text-white" : "text-slate-400 bg-slate-100"}`}
                        style={day.isProductive ? { background: `linear-gradient(135deg, ${GALAS_RED}, #6b0000)` } : {}}>
                        {day.isProductive ? <CheckCircle2 size={16} /> : day.greenCount}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-sm text-slate-800">
                          {new Date(day.date + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short" })}
                        </div>
                        <div className="text-xs text-slate-400 font-semibold">
                          {day.events.length} eventos · {day.greenCount} verdes
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-black text-lg" style={{ color: day.isProductive ? GALAS_RED : "#cbd5e1" }}>
                          {day.greenCount}<span className="text-xs font-bold text-slate-300">/{PRODUCTIVITY_GOAL}</span>
                        </div>
                        <div className={`text-xs font-black ${day.isProductive ? "text-green-600" : "text-slate-400"}`}>
                          {day.isProductive ? "PRODUCTIVO" : "falta acción"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── TAB: EVENTOS ────────────────────────────────────── */}
            {activeTab === "eventos" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-3 h-3 rounded-full" style={{ background: GALAS_RED }} />
                  <span className="text-xs font-black text-slate-500">Verde = productivo · Gris = no productivo</span>
                </div>
                {data.recentEvents.map((ev, i) => (
                  <div key={ev.id}
                    className="bg-white rounded-3xl px-5 py-3.5 shadow-sm border border-slate-100 flex items-center gap-3 animate-fade-up"
                    style={{ animationDelay: `${Math.min(i * 20, 400)}ms` }}>
                    <div className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: ev.isGreen ? GALAS_RED : "#e2e8f0" }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-slate-800 truncate">{ev.title}</div>
                      <div className="text-xs text-slate-400 font-semibold">
                        {new Date(ev.start).toLocaleString("es-AR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    {ev.isGreen && (
                      <span className="text-xs font-black px-2.5 py-1 rounded-xl shrink-0"
                        style={{ background: "#f9e6e6", color: GALAS_RED }}>
                        {ev.type === "tasacion" ? "TASACIÓN" :
                          ev.type === "visita" ? "VISITA" :
                            ev.type === "propuesta" ? "PROPUESTA" :
                              ev.type === "reunion" ? "REUNIÓN" : "VERDE"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
