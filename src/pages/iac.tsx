import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Head from "next/head";
import AppLayout from "../components/AppLayout";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, LineChart, Line, Cell } from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";

const RED = "#aa0000";

function iacColor(v: number) {
  return v >= 100 ? "#16a34a" : v >= 67 ? "#d97706" : "#dc2626";
}

function localDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getMonday(weekOffset = 0) {
  const now = new Date();
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1 - day) + weekOffset * 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

export default function IACPage() {
  const { status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [calView, setCalView] = useState<"week" | "month">("week");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    setLoading(true);
    fetch("/api/calendar/cached?days=90")
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [status]);

  const weekGoal = data?.totals?.iacGoal ?? 15;

  // Week data
  const weekData = useMemo(() => {
    if (!data?.dailySummaries) return null;
    const mon = getMonday(weekOffset);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon); d.setDate(mon.getDate() + i);
      return d;
    });
    const byDate: Record<string, any> = {};
    data.dailySummaries.forEach((s: any) => { byDate[s.date] = s; });
    return days.map(d => {
      const ds = localDateStr(d);
      const s = byDate[ds];
      return {
        date: ds,
        day: d.toLocaleDateString("es-AR", { weekday: "short", day: "numeric" }),
        dayShort: d.toLocaleDateString("es-AR", { weekday: "short" }),
        dayNum: d.getDate(),
        greens: s?.greenCount ?? 0,
        events: s?.events ?? [],
        isToday: ds === localDateStr(new Date()),
      };
    });
  }, [data, weekOffset]);

  const weekTotal = weekData?.reduce((s: number, d: any) => s + d.greens, 0) ?? 0;
  const weekIac = Math.min(100, Math.round((weekTotal / weekGoal) * 100));
  const weekLabel = weekOffset === 0 ? "esta semana" : weekOffset === -1 ? "semana pasada" : `hace ${Math.abs(weekOffset)} semanas`;

  // 12-week history
  const historyData = useMemo(() => {
    if (!data?.dailySummaries) return [];
    const weeks = [];
    for (let w = -11; w <= 0; w++) {
      const mon = getMonday(w);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      const monStr = localDateStr(mon);
      const sunStr = localDateStr(sun);
      const weekSummaries = data.dailySummaries.filter((d: any) => d.date >= monStr && d.date <= sunStr);
      const greens = weekSummaries.reduce((s: number, d: any) => s + d.greenCount, 0);
      const iac = Math.min(100, Math.round((greens / weekGoal) * 100));
      weeks.push({
        label: `${mon.getDate()}/${mon.getMonth() + 1}`,
        iac,
        greens,
        current: w === 0,
      });
    }
    return weeks;
  }, [data, weekGoal]);

  const avgIac = historyData.length
    ? Math.round(historyData.reduce((s, w) => s + w.iac, 0) / historyData.length)
    : 0;

  const weekGreens = weekData
    ? weekData.flatMap((d: any) => d.events.filter((e: any) => e.isGreen))
    : [];

  const eventTypes = useMemo(() => {
    const counts: Record<string, number> = {};
    weekGreens.forEach((e: any) => { counts[e.type || "otro"] = (counts[e.type || "otro"] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [weekGreens]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  })();

  if (loading || !data) return (
    <AppLayout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div style={{ fontSize: 13, color: "#9ca3af" }}>Cargando actividad...</div>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout greeting={greeting}>
      <Head><title>Actividad Comercial — InmoCoach</title></Head>

      <style>{`
        .iac-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }
        .iac-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        @media (max-width: 767px) {
          .iac-grid { grid-template-columns: 1fr; }
          .iac-grid-3 { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      <div style={{ padding: "24px 24px 60px" }}>

        {/* Page header */}
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => router.push("/")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#9ca3af", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
            ← Inicio
          </button>
          <div style={{ fontSize: 22, fontWeight: 500, color: "#111827", fontFamily: "Georgia, serif" }}>Actividad comercial</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Reuniones cara a cara vs objetivo semanal</div>
        </div>

        {/* Week selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <button onClick={() => setWeekOffset(w => w - 1)} style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronLeft size={14} color="#6b7280" />
          </button>
          <div style={{ fontSize: 13, color: "#374151", fontWeight: 500, minWidth: 160, textAlign: "center" }}>
            {(() => { const mon = getMonday(weekOffset); const sun = new Date(mon); sun.setDate(mon.getDate() + 6); return `${mon.getDate()} — ${sun.getDate()} ${sun.toLocaleDateString("es-AR", { month: "short" })}`; })()}
          </div>
          <button onClick={() => setWeekOffset(w => w + 1)} disabled={weekOffset >= 0} style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 8, width: 32, height: 32, cursor: weekOffset >= 0 ? "not-allowed" : "pointer", opacity: weekOffset >= 0 ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronRight size={14} color="#6b7280" />
          </button>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} style={{ fontSize: 12, color: RED, background: "none", border: "none", cursor: "pointer" }}>Semana actual</button>
          )}
        </div>

        {/* Top KPIs */}
        <div className="iac-grid-3" style={{ marginBottom: 16 }}>
          <div style={{ background: "#fff", border: `0.5px solid ${iacColor(weekIac)}30`, borderTop: `3px solid ${iacColor(weekIac)}`, borderRadius: "0 0 12px 12px", padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>IAC {weekLabel}</div>
            <div style={{ fontSize: 44, fontWeight: 500, fontFamily: "Georgia, serif", color: iacColor(weekIac), lineHeight: 1 }}>{weekIac}%</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{weekTotal} de {weekGoal} reuniones</div>
            <div style={{ height: 4, background: "#f3f4f6", borderRadius: 2, marginTop: 10, overflow: "hidden" }}>
              <div style={{ height: "100%", background: iacColor(weekIac), borderRadius: 2, width: `${Math.min(100, weekIac)}%` }} />
            </div>
          </div>
          <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Promedio 12 sem.</div>
            <div style={{ fontSize: 44, fontWeight: 500, fontFamily: "Georgia, serif", color: iacColor(avgIac), lineHeight: 1 }}>{avgIac}%</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Tendencia histórica</div>
          </div>
          <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Días productivos</div>
            <div style={{ fontSize: 44, fontWeight: 500, fontFamily: "Georgia, serif", color: "#111827", lineHeight: 1 }}>
              {weekData?.filter((d: any) => d.greens > 0).length ?? 0}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>de 7 días esta semana</div>
          </div>
        </div>

        <div className="iac-grid" style={{ marginBottom: 16 }}>

          {/* Calendario semanal — columna por día */}
          <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: "0.5px solid #f3f4f6" }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>Calendario — {weekLabel}</div>
            </div>
            {/* Grid 7 columnas — header + eventos por columna */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
              {weekData?.map((d: any, di: number) => (
                <div key={d.date} style={{
                  borderRight: di < 6 ? "0.5px solid #f3f4f6" : "none",
                  display: "flex", flexDirection: "column",
                }}>
                  {/* Header día */}
                  <div style={{
                    padding: "10px 4px 8px", textAlign: "center",
                    borderBottom: "0.5px solid #f3f4f6",
                    background: d.isToday ? "#fef2f2" : "transparent",
                  }}>
                    <div style={{ fontSize: 9, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>{d.dayShort}</div>
                    <div style={{
                      width: 26, height: 26, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      margin: "3px auto 0",
                      fontSize: 12, fontWeight: 500,
                      background: d.isToday ? RED : "transparent",
                      color: d.isToday ? "#fff" : "#374151",
                    }}>{d.dayNum}</div>
                  </div>
                  {/* Eventos del día */}
                  <div style={{ padding: "6px 4px", display: "flex", flexDirection: "column", gap: 3, minHeight: 40 }}>
                    {d.events.filter((e: any) => e.isGreen).length === 0 && (
                      <div style={{ flex: 1 }} />
                    )}
                    {d.events.filter((e: any) => e.isGreen).map((ev: any) => (
                      <div key={ev.id} title={ev.title} style={{
                        background: "#f0fdf4",
                        border: "0.5px solid #bbf7d0",
                        borderLeft: `2px solid #16a34a`,
                        borderRadius: 4,
                        padding: "3px 5px",
                        cursor: "default",
                      }}>
                        <div style={{
                          fontSize: 10, color: "#166534", fontWeight: 500,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          lineHeight: 1.3,
                        }}>{ev.title}</div>
                        {ev.start?.slice(11, 16) !== "00:00" && (
                          <div style={{ fontSize: 9, color: "#4ade80", marginTop: 1 }}>{ev.start?.slice(11, 16)}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {weekTotal === 0 && (
              <div style={{ padding: "20px 16px", textAlign: "center", color: "#9ca3af", fontSize: 12, borderTop: "0.5px solid #f3f4f6" }}>
                Sin reuniones comerciales {weekLabel}
              </div>
            )}
          </div>

          {/* Desglose por tipo */}
          <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", borderBottom: "0.5px solid #f3f4f6" }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: "#374151" }}>Desglose por tipo</div>
            </div>
            <div style={{ padding: "12px 14px" }}>
              {eventTypes.length === 0 ? (
                <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 12, padding: "16px 0" }}>Sin actividad {weekLabel}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {eventTypes.map(([type, count]) => (
                    <div key={type}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontSize: 11, color: "#374151", textTransform: "capitalize" }}>{type.replace(/_/g, " ")}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#111827" }}>{count}</span>
                      </div>
                      <div style={{ height: 4, background: "#f3f4f6", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", background: RED, borderRadius: 2, width: `${Math.round(count / weekTotal * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Historial 12 semanas */}
        <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "0.5px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>Evolución — últimas 12 semanas</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>Promedio: <span style={{ color: iacColor(avgIac), fontWeight: 500 }}>{avgIac}%</span></div>
          </div>
          <div style={{ padding: "16px" }}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={historyData} margin={{ top: 5, right: 5, bottom: 5, left: -25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} domain={[0, 110]} />
                <Tooltip
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div style={{ background: "#111827", borderRadius: 8, padding: "8px 12px" }}>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>Sem. {d.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: iacColor(d.iac) }}>{d.iac}%</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>{d.greens} reuniones</div>
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={100} stroke="#16a34a" strokeDasharray="4 4" strokeWidth={1} />
                <Bar dataKey="iac" radius={[4, 4, 0, 0]}>
                  {historyData.map((entry, i) => (
                    <Cell key={i} fill={entry.current ? iacColor(entry.iac) : iacColor(entry.iac) + "80"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
