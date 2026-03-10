import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Head from "next/head";
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, Minus, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const RED = "#aa0000";

interface PeriodStats {
  total: number;
  tasaciones: number;
  visitas: number;
  propuestas: number;
  cierres: number;
  reuniones: number;
  seguimientos: number;
  entrevistas: number;
  productiveDays: number;
  avgPerWeek: number;
  conversionRate: number;
  consistencyIndex: number;
}

interface QuarterData { quarter: string; total: number; tasaciones: number; visitas: number; propuestas: number; cierres: number; avgPerWeek: number; }
interface BestTimes { bestDay: string | null; bestHour: string | null; }

type PeriodType = "month" | "quarter" | "semester" | "year";

export default function AgentDetail() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { email } = router.query;
  const [stats, setStats] = useState<PeriodStats | null>(null);
  const [quarters, setQuarters] = useState<QuarterData[]>([]);
  const [bestTimes, setBestTimes] = useState<BestTimes>({ bestDay: null, bestHour: null });
  const [period, setPeriod] = useState<PeriodType>("month");
  const [selectedQ, setSelectedQ] = useState(Math.ceil((new Date().getMonth() + 1) / 3));
  const [year] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [agentName, setAgentName] = useState("");
  const [weekly, setWeekly] = useState<any>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(true);
  const [calEvents, setCalEvents] = useState<any[]>([]);
  const [calLoading, setCalLoading] = useState(true);

  useEffect(() => { if (status === "unauthenticated") router.replace("/login"); }, [status, router]);
  useEffect(() => { if (status === "authenticated" && email) load(); }, [status, email, period, selectedQ]);
  useEffect(() => { if (status === "authenticated" && email) loadWeekly(); }, [status, email]);
  useEffect(() => { if (status === "authenticated" && email) loadCalendar(); }, [status, email]);

  const loadWeekly = async () => {
    setWeeklyLoading(true);
    try {
      const res = await fetch(`/api/analytics/agent-weekly?agentEmail=${encodeURIComponent(email as string)}`);
      if (res.ok) {
        const d = await res.json();
        setWeekly(d);
        if (d.name) setAgentName(d.name);
      }
    } catch {}
    setWeeklyLoading(false);
  };

  const loadCalendar = async () => {
    setCalLoading(true);
    try {
      const res = await fetch(`/api/analytics/agent-calendar?agentEmail=${encodeURIComponent(email as string)}`);
      if (res.ok) { const d = await res.json(); setCalEvents(d.events || []); }
    } catch {}
    setCalLoading(false);
  };

  const load = async () => {
    setLoading(true);
    try {
      let url = `/api/analytics/agent?agentEmail=${encodeURIComponent(email as string)}&year=${year}`;
      if (period === "quarter") url += `&period=quarter&q=${selectedQ}`;
      else if (period === "semester") url += `&period=semester&semester=${selectedQ <= 2 ? 1 : 2}`;
      else if (period === "year") url += `&period=year`;
      else url += `&period=month`;

      const res = await fetch(url);
      if (!res.ok) { router.replace("/equipo"); return; }
      const data = await res.json();
      setStats(data.stats);
      setQuarters(data.quarterComparison || []);
      setBestTimes(data.bestTimes || {});
      if (!agentName) setAgentName((email as string).split("@")[0]);
    } catch { }
    setLoading(false);
  };

  const periodLabel = () => {
    if (period === "quarter") return `Q${selectedQ} ${year}`;
    if (period === "semester") return `${selectedQ <= 2 ? "1er" : "2do"} semestre ${year}`;
    if (period === "year") return `Año ${year}`;
    return "Últimos 30 días";
  };

  const TYPE_LABEL: Record<string, string> = {
    tasacion: "Tasación", visita: "Visita", propuesta: "Propuesta",
    firma: "Firma", entrevista: "Entrevista", seguimiento: "Seguimiento",
    meet: "Meet/Zoom", fotos_video: "Fotos/Video", otro: "Otro",
  };
  const TYPE_COLOR: Record<string, string> = {
    tasacion: "#aa0000", visita: "#7c3aed", propuesta: "#0369a1",
    firma: "#16a34a", entrevista: "#d97706", seguimiento: "#6b7280",
    meet: "#0891b2", fotos_video: "#db2777", otro: "#9ca3af",
  };

  const iacColor = (v: number) => v >= 70 ? "#16a34a" : v >= 40 ? "#d97706" : "#aa0000";
  const iacLabel = (v: number) => v >= 70 ? "Productivo" : v >= 40 ? "En construcción" : "En riesgo";

  if (status === "loading") return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 size={24} className="animate-spin" style={{ color: RED }} /></div>;

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <Head><title>Detalle agente — InmoCoach</title></Head>
      <div className="h-0.5 w-full" style={{ background: RED }} />

      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-5 py-3 flex items-center gap-4">
          <button onClick={() => router.push("/equipo")} className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700 mr-auto">
            <ArrowLeft size={13} /> Mi equipo
          </button>
          <div className="font-black text-lg" style={{ fontFamily: "Georgia, serif" }}>Inmo<span style={{ color: RED }}>Coach</span></div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-8 space-y-5">

        {/* Header agente */}
        <div>
          <h1 className="text-xl font-black text-gray-900" style={{ fontFamily: "Georgia, serif" }}>{agentName || email}</h1>
          <p className="text-sm text-gray-400">{email}</p>
        </div>

        {/* IAC semanal + sparkline */}
        {weeklyLoading ? (
          <div className="flex items-center justify-center py-6"><Loader2 size={18} className="animate-spin text-gray-200" /></div>
        ) : weekly && (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <div className="px-6 pt-5 pb-4 flex items-end justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">IAC esta semana</div>
                <div className="flex items-end gap-3">
                  <span className="font-black leading-none" style={{ fontFamily: "Georgia, serif", fontSize: 56, color: iacColor(weekly.iac) }}>
                    {weekly.iac}%
                  </span>
                  <div className="mb-1">
                    <div className="text-sm font-black" style={{ color: iacColor(weekly.iac) }}>{iacLabel(weekly.iac)}</div>
                    <div className="text-xs text-gray-400">{weekly.weekTotal} / 15 reuniones</div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {weekly.streak >= 1 && (
                  <span className="text-sm font-black text-orange-500">{weekly.streak >= 5 ? "🔥" : "⚡"} {weekly.streak} días de racha</span>
                )}
                <div className="text-xs text-gray-400">
                  {weekly.trend === "up" ? <span className="text-green-600 font-bold">↑ +{Math.abs(weekly.trendPct)}% vs semana anterior</span>
                  : weekly.trend === "down" ? <span className="text-red-500 font-bold">↓ {Math.abs(weekly.trendPct)}% vs semana anterior</span>
                  : <span>estable vs semana anterior</span>}
                </div>
              </div>
            </div>

            {/* Barra IAC */}
            <div className="px-6 mb-4">
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(weekly.iac, 100)}%`, background: iacColor(weekly.iac) }} />
              </div>
            </div>

            {/* Sparkline 7 días */}
            <div className="px-6 pb-5">
              <div className="text-xs text-gray-400 mb-2 font-medium">Últimos 7 días</div>
              <div className="flex items-end gap-1.5 h-12">
                {(weekly.sparkline || []).map((v: number, i: number) => {
                  const days = ["L","M","X","J","V","S","D"];
                  const max = Math.max(...(weekly.sparkline || [1]), 1);
                  const color = iacColor(weekly.iac);
                  return (
                    <div key={i} className="flex flex-col items-center gap-1 flex-1">
                      <div className="w-full rounded-sm transition-all"
                        style={{ height: `${Math.max(3, (v / max) * 36)}px`, background: v > 0 ? color : "#e5e7eb", opacity: v === 0 ? 0.3 : 1 }} />
                      <span className="text-gray-300 font-medium" style={{ fontSize: 9 }}>{days[i]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Calendario semanal */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <Calendar size={13} className="text-gray-400" />
            <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Agenda esta semana</span>
            {calLoading && <Loader2 size={11} className="animate-spin text-gray-300 ml-1" />}
            <span className="ml-auto text-xs text-gray-400">{calEvents.filter(e => e.isGreen).length} reuniones cara a cara</span>
          </div>
          {calLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-gray-200" /></div>
          ) : calEvents.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">Sin eventos esta semana aún.</p>
          ) : (() => {
            // Group by day
            const days = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
            const byDay: Record<number, any[]> = {};
            calEvents.forEach(e => {
              const d = new Date(e.start).getDay();
              const idx = d === 0 ? 6 : d - 1;
              if (!byDay[idx]) byDay[idx] = [];
              byDay[idx].push(e);
            });
            return (
              <div className="divide-y divide-gray-50">
                {Object.entries(byDay).sort(([a],[b]) => Number(a)-Number(b)).map(([idx, evs]) => (
                  <div key={idx} className="px-5 py-3">
                    <div className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">{days[Number(idx)]}</div>
                    <div className="space-y-1.5">
                      {(evs as any[]).sort((a,b) => new Date(a.start).getTime() - new Date(b.start).getTime()).map((e: any) => {
                        const start = new Date(e.start);
                        const time = start.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
                        const color = TYPE_COLOR[e.type] || "#9ca3af";
                        return (
                          <div key={e.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                            style={{ background: e.isGreen ? `${color}12` : "#f9fafb", borderLeft: `3px solid ${e.isGreen ? color : "#e5e7eb"}` }}>
                            <span className="text-xs font-bold text-gray-400 shrink-0 w-10">{time}</span>
                            <span className="text-sm font-semibold text-gray-800 flex-1 truncate">{e.title || TYPE_LABEL[e.type]}</span>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-lg shrink-0"
                              style={{ background: `${color}20`, color }}>
                              {TYPE_LABEL[e.type] || e.type}
                            </span>
                            {e.isGreen && <span className="text-green-500 text-xs font-black shrink-0">✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Selector de período */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 flex-wrap">
          <Calendar size={14} className="text-gray-400 shrink-0" />
          {(["month", "quarter", "semester", "year"] as PeriodType[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className="text-xs font-bold px-3 py-1.5 rounded-xl transition-all"
              style={{ background: period === p ? RED : "#f3f4f6", color: period === p ? "#fff" : "#6b7280" }}>
              {p === "month" ? "30 días" : p === "quarter" ? "Trimestre" : p === "semester" ? "Semestre" : "Año"}
            </button>
          ))}
          {period === "quarter" && (
            <div className="flex gap-2 ml-2">
              {[1, 2, 3, 4].map(q => (
                <button key={q} onClick={() => setSelectedQ(q)}
                  className="text-xs font-bold px-2.5 py-1.5 rounded-xl transition-all"
                  style={{ background: selectedQ === q ? "#111827" : "#f3f4f6", color: selectedQ === q ? "#fff" : "#6b7280" }}>
                  Q{q}
                </button>
              ))}
            </div>
          )}
          {period === "semester" && (
            <div className="flex gap-2 ml-2">
              {[[1, "1er sem."], [3, "2do sem."]] .map(([v, label]) => (
                <button key={v} onClick={() => setSelectedQ(v as number)}
                  className="text-xs font-bold px-2.5 py-1.5 rounded-xl transition-all"
                  style={{ background: selectedQ === v ? "#111827" : "#f3f4f6", color: selectedQ === v ? "#fff" : "#6b7280" }}>
                  {label}
                </button>
              ))}
            </div>
          )}
          <span className="ml-auto text-xs text-gray-400 font-medium">{periodLabel()}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
        ) : stats ? (
          <>
            {/* KPIs del período */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Reuniones totales", value: stats.total, sub: `${stats.avgPerWeek}/semana promedio` },
                { label: "Días productivos", value: stats.productiveDays, sub: "≥10 reuniones/día" },
                { label: "Tasa de conversión", value: `${stats.conversionRate}%`, sub: "Tasaciones → Propuestas" },
                { label: "Consistencia", value: `${stats.consistencyIndex}%`, sub: "Semanas con ≥10 reuniones" },
              ].map((k, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4">
                  <div className="text-xs text-gray-400 mb-1">{k.label}</div>
                  <div className="text-2xl font-black text-gray-900" style={{ fontFamily: "Georgia, serif" }}>{k.value}</div>
                  <div className="text-xs text-gray-400 mt-1">{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Funnel */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <h3 className="text-sm font-black text-gray-700 mb-4">Funnel comercial — {periodLabel()}</h3>
              <div className="flex items-end gap-3 flex-wrap">
                {[
                  { label: "Tasaciones", value: stats.tasaciones, color: "#111827" },
                  { label: "Visitas", value: stats.visitas, color: "#374151" },
                  { label: "Propuestas", value: stats.propuestas, color: RED },
                  { label: "Cierres", value: stats.cierres, color: "#16a34a" },
                  { label: "Reuniones", value: stats.reuniones, color: "#6b7280" },
                  { label: "Seguimientos", value: stats.seguimientos, color: "#9ca3af" },
                ].map((f, i) => (
                  <div key={i} className="flex-1 min-w-0 text-center">
                    <div className="text-xl font-black" style={{ fontFamily: "Georgia, serif", color: f.color }}>{f.value}</div>
                    <div className="text-xs text-gray-400 mt-1 truncate">{f.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mejor día y hora */}
            {(bestTimes.bestDay || bestTimes.bestHour) && (
              <div className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-6 flex-wrap">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Mejor día de la semana</div>
                  <div className="text-2xl font-black text-gray-900" style={{ fontFamily: "Georgia, serif" }}>{bestTimes.bestDay || "—"}</div>
                </div>
                <div className="w-px h-10 bg-gray-100 hidden sm:block" />
                <div>
                  <div className="text-xs text-gray-400 mb-1">Hora más productiva</div>
                  <div className="text-2xl font-black text-gray-900" style={{ fontFamily: "Georgia, serif" }}>{bestTimes.bestHour || "—"}</div>
                </div>
                <p className="text-xs text-gray-400 ml-auto max-w-xs text-right hidden sm:block">
                  Basado en los últimos 90 días de actividad registrada.
                </p>
              </div>
            )}

            {/* Comparación trimestral */}
            {quarters.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl p-5">
                <h3 className="text-sm font-black text-gray-700 mb-4">Comparación trimestral {year}</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={quarters} barSize={36}>
                    <XAxis dataKey="quarter" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 12 }}
                      formatter={(v: number, name: string) => [v, name]}
                    />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {quarters.map((q, i) => (
                        <Cell key={i} fill={q.quarter === `Q${Math.ceil((new Date().getMonth() + 1) / 3)}` ? RED : "#e5e7eb"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {quarters.map((q, i) => (
                    <div key={i} className="text-center">
                      <div className="text-xs font-bold text-gray-400">{q.quarter}</div>
                      <div className="text-sm font-black text-gray-900">{q.total}</div>
                      <div className="text-xs text-gray-400">{q.avgPerWeek}/sem</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center text-sm text-gray-400">
            Todavía no hay datos para este período. El agente necesita sincronizar su agenda al menos una vez.
          </div>
        )}
      </main>
    </div>
  );
}
