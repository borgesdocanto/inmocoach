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

  useEffect(() => { if (status === "unauthenticated") router.replace("/login"); }, [status, router]);
  useEffect(() => { if (status === "authenticated" && email) load(); }, [status, email, period, selectedQ]);

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

  if (status === "loading") return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 size={24} className="animate-spin" style={{ color: RED }} /></div>;

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <Head><title>Detalle agente — InstaCoach</title></Head>
      <div className="h-0.5 w-full" style={{ background: RED }} />

      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-5 py-3 flex items-center gap-4">
          <button onClick={() => router.push("/equipo")} className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700 mr-auto">
            <ArrowLeft size={13} /> Mi equipo
          </button>
          <div className="font-black text-lg" style={{ fontFamily: "Georgia, serif" }}>Insta<span style={{ color: RED }}>Coach</span></div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-8 space-y-5">

        {/* Header agente */}
        <div>
          <h1 className="text-xl font-black text-gray-900" style={{ fontFamily: "Georgia, serif" }}>{agentName || email}</h1>
          <p className="text-sm text-gray-400">{email}</p>
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
