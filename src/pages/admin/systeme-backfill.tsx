import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Head from "next/head";

interface DayResult {
  date: string;
  status: "pending" | "running" | "done" | "error";
  contacts?: number;
  created?: number;
  updated?: number;
  skipped?: number;
  errors?: number;
  errorDetail?: string;
}

function getDates(days: number): string[] {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

export default function BackfillPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [days] = useState(30);
  const [results, setResults] = useState<DayResult[]>([]);
  const [running, setRunning] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [totals, setTotals] = useState({ created: 0, updated: 0, skipped: 0, errors: 0 });

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated") {
      const email = session?.user?.email;
      if (email !== "leandro@galas.com.ar") router.replace("/");
    }
  }, [status, session, router]);

  useEffect(() => {
    setResults(getDates(days).map(date => ({ date, status: "pending" })));
  }, [days]);

  const run = async () => {
    setRunning(true);
    setTotals({ created: 0, updated: 0, skipped: 0, errors: 0 });
    const dates = getDates(days);

    for (let i = 0; i < dates.length; i++) {
      setCurrentIdx(i);
      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: "running" } : r));

      try {
        const res = await fetch("/api/admin/systeme-backfill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: dates[i] }),
        });
        const data = await res.json();
        setResults(prev => prev.map((r, idx) => idx === i ? {
          ...r,
          status: data.errors > 0 ? "error" : "done",
          contacts: data.contacts,
          created: data.created,
          updated: data.updated,
          skipped: data.skipped,
          errors: data.errors,
          errorDetail: data.errorDetail,
        } : r));
        setTotals(prev => ({
          created: prev.created + (data.created || 0),
          updated: prev.updated + (data.updated || 0),
          skipped: prev.skipped + (data.skipped || 0),
          errors: prev.errors + (data.errors || 0),
        }));
      } catch (err) {
        setResults(prev => prev.map((r, idx) => idx === i ? {
          ...r, status: "error", errorDetail: String(err),
        } : r));
      }

      // Pausa entre días para no saturar Systeme
      if (i < dates.length - 1) await new Promise(r => setTimeout(r, 1500));
    }

    setRunning(false);
    setCurrentIdx(-1);
  };

  const done = results.filter(r => r.status === "done" || r.status === "error").length;
  const progress = results.length > 0 ? Math.round((done / results.length) * 100) : 0;

  return (
    <>
      <Head><title>Backfill Systeme — Admin</title></Head>
      <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 24px", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ marginBottom: 24 }}>
          <a href="/admin" style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}>← Volver al admin</a>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#111827", margin: "0 0 8px" }}>
          Backfill Tokko → Systeme
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 24px" }}>
          Sincroniza los contactos creados/modificados en los últimos {days} días, un día por vez para evitar timeouts.
        </p>

        {/* Totales */}
        {done > 0 && (
          <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
            {[
              { label: "Creados", value: totals.created, color: "#16a34a" },
              { label: "Actualizados", value: totals.updated, color: "#0369a1" },
              { label: "Salteados", value: totals.skipped, color: "#9ca3af" },
              { label: "Errores", value: totals.errors, color: "#dc2626" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 900, color }}>{value}</div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Barra de progreso */}
        {running && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
              <span>Procesando día {done + 1} de {results.length}...</span>
              <span>{progress}%</span>
            </div>
            <div style={{ height: 6, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: "#0ea5e9", transition: "width 0.3s" }} />
            </div>
          </div>
        )}

        {/* Botón */}
        <button
          onClick={run}
          disabled={running}
          style={{
            padding: "12px 28px", borderRadius: 10, fontSize: 14, fontWeight: 800,
            background: running ? "#e5e7eb" : "#0ea5e9", color: running ? "#9ca3af" : "white",
            border: "none", cursor: running ? "not-allowed" : "pointer", marginBottom: 24,
          }}>
          {running ? `Procesando ${results[currentIdx]?.date ?? "..."}` : done > 0 ? "Volver a correr" : `Iniciar backfill (${days} días)`}
        </button>

        {/* Tabla de resultados */}
        <div style={{ border: "1px solid #f3f4f6", borderRadius: 10, overflow: "hidden" }}>
          {results.map((r, i) => (
            <div key={r.date} style={{
              padding: "8px 14px", display: "flex", alignItems: "center", gap: 12,
              background: i % 2 === 0 ? "white" : "#fafafa",
              borderBottom: i < results.length - 1 ? "1px solid #f3f4f6" : "none",
            }}>
              <span style={{ fontSize: 12, color: "#374151", fontWeight: 600, minWidth: 90 }}>{r.date}</span>
              <span style={{ fontSize: 11, minWidth: 70, fontWeight: 700, color:
                r.status === "done" ? "#16a34a" :
                r.status === "error" ? "#dc2626" :
                r.status === "running" ? "#0ea5e9" : "#9ca3af"
              }}>
                {r.status === "pending" ? "—" :
                 r.status === "running" ? "⟳ Procesando" :
                 r.status === "done" ? "✓ OK" : "✗ Error"}
              </span>
              {r.status !== "pending" && r.status !== "running" && (
                <span style={{ fontSize: 11, color: "#6b7280" }}>
                  {r.contacts} contactos · +{r.created} · ↻{r.updated} · {r.skipped} skip
                  {r.errors ? ` · ⚠${r.errors}` : ""}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
