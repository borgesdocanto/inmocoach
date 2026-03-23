import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Head from "next/head";
import AppLayout from "../components/AppLayout";
import { ExternalLink } from "lucide-react";

const RED = "#aa0000";

function formatPrice(price: number | null, currency: string | null) {
  if (!price) return "Consultar";
  return `${currency === "USD" ? "USD " : "$"}${price.toLocaleString("es-AR")}`;
}

function fichaScore(prop: any) {
  const missing: string[] = [];
  if (prop.photosCount < 15) missing.push(`fotos (${prop.photosCount}/15)`);
  if (!prop.hasBlueprint) missing.push("plano");
  if (!prop.hasVideo && !prop.hasTour360) missing.push("video o tour 360");
  const stale = prop.daysSinceUpdate !== null && prop.daysSinceUpdate > 30;
  return { complete: missing.length === 0 && !stale, missing };
}

export default function CarteraPage() {
  const { status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "incomplete" | "stale">("all");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/tokko-portfolio", { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [status]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  })();

  if (loading) return (
    <AppLayout><div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}><div style={{ fontSize: 13, color: "#9ca3af" }}>Cargando cartera...</div></div></AppLayout>
  );

  if (!data?.connected) return (
    <AppLayout greeting={greeting}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 12 }}>
        <div style={{ fontSize: 32 }}>🏠</div>
        <div style={{ fontSize: 16, fontWeight: 500, color: "#111827" }}>Tokko no está conectado</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>Conectá tu API Key para ver tu cartera acá</div>
        <button onClick={() => router.push("/tokko-setup")} style={{ background: RED, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
          Conectar Tokko →
        </button>
      </div>
    </AppLayout>
  );

  const { stats, properties } = data;
  const available = properties.filter((p: any) => p.status === 2);

  const filtered = filter === "incomplete"
    ? available.filter((p: any) => !fichaScore(p).complete)
    : filter === "stale"
    ? available.filter((p: any) => p.daysSinceUpdate !== null && p.daysSinceUpdate > 30)
    : available;

  const cartHealth = stats.incomplete === 0 ? "green" : stats.incomplete <= stats.active * 0.3 ? "amber" : "red";
  const cartColor = cartHealth === "green" ? "#16a34a" : cartHealth === "amber" ? "#d97706" : "#dc2626";

  return (
    <AppLayout greeting={greeting}>
      <Head><title>Cartera Tokko — InmoCoach</title></Head>

      <style>{`
        .ct-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .ct-filters { display: flex; gap: 8px; flex-wrap: wrap; }
        @media (max-width: 767px) { .ct-kpis { grid-template-columns: repeat(2, 1fr); } }
      `}</style>

      <div style={{ padding: "24px 24px 60px" }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => router.push("/")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#9ca3af", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>← Inicio</button>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 500, color: "#111827", fontFamily: "Georgia, serif" }}>Cartera Tokko</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Estado de tus propiedades publicadas</div>
            </div>
            <a href="https://www.tokkobroker.com" target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6b7280", background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "7px 12px", textDecoration: "none" }}>
              Abrir Tokko <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {/* KPIs */}
        <div className="ct-kpis" style={{ marginBottom: 16 }}>
          {[
            { label: "Disponibles", value: stats.active, color: cartColor },
            { label: "Fichas OK", value: stats.complete, color: "#16a34a" },
            { label: "Por mejorar", value: stats.incomplete, color: stats.incomplete > 0 ? "#dc2626" : "#9ca3af" },
            { label: "Sin actualizar", value: stats.stale, color: stats.stale > 0 ? "#d97706" : "#9ca3af" },
          ].map(k => (
            <div key={k.label} style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderTop: `3px solid ${k.color}`, borderRadius: "0 0 12px 12px", padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{k.label}</div>
              <div style={{ fontSize: 36, fontWeight: 500, fontFamily: "Georgia, serif", color: k.color, lineHeight: 1 }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Alertas */}
        {stats.incomplete > 0 && (
          <div style={{ background: "#FEF2F2", border: "1px solid #fecaca", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#991b1b" }}>{stats.incomplete} ficha{stats.incomplete !== 1 ? "s" : ""} necesitan atención</div>
              <div style={{ fontSize: 12, color: "#b91c1c" }}>Mejorá las fichas para aumentar las chances de cierre</div>
            </div>
            <button onClick={() => setFilter("incomplete")} style={{ marginLeft: "auto", fontSize: 12, color: RED, background: "none", border: `0.5px solid ${RED}`, borderRadius: 7, padding: "5px 10px", cursor: "pointer" }}>
              Ver fichas
            </button>
          </div>
        )}
        {stats.stale > 0 && (
          <div style={{ background: "#FFFBEB", border: "0.5px solid #fcd34d", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🕐</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#92400e" }}>{stats.stale} propiedad{stats.stale !== 1 ? "es" : ""} sin actualizar hace más de 30 días</div>
              <div style={{ fontSize: 12, color: "#b45309" }}>Una ficha desactualizada pierde posicionamiento y atención</div>
            </div>
            <button onClick={() => setFilter("stale")} style={{ marginLeft: "auto", fontSize: 12, color: "#d97706", background: "none", border: "0.5px solid #fcd34d", borderRadius: 7, padding: "5px 10px", cursor: "pointer" }}>
              Ver fichas
            </button>
          </div>
        )}

        {/* Filtros */}
        <div className="ct-filters" style={{ marginBottom: 16 }}>
          {[
            { key: "all", label: `Todas (${stats.active})` },
            { key: "incomplete", label: `Por mejorar (${stats.incomplete})` },
            { key: "stale", label: `Sin actualizar (${stats.stale})` },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key as any)} style={{
              fontSize: 12, fontWeight: filter === f.key ? 500 : 400,
              background: filter === f.key ? "#111827" : "#fff",
              color: filter === f.key ? "#fff" : "#6b7280",
              border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "7px 14px", cursor: "pointer",
            }}>{f.label}</button>
          ))}
        </div>

        {/* Lista */}
        <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "40px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
              {filter === "incomplete" ? "🎉 Todas las fichas están completas" : filter === "stale" ? "🎉 Todas las propiedades están actualizadas" : "Sin propiedades"}
            </div>
          ) : filtered.map((prop: any, idx: number) => {
            const ficha = fichaScore(prop);
            return (
              <div key={prop.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", borderBottom: idx < filtered.length - 1 ? "0.5px solid #f3f4f6" : "none" }}>

                {/* Thumbnail */}
                <div style={{ width: 72, height: 60, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {prop.thumbnail
                    ? <img src={prop.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: 22 }}>🏠</span>}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Dirección + link */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <a href={prop.editUrl} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 14, fontWeight: 500, color: "#111827", textDecoration: "none", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {prop.address || prop.title || "Sin dirección"}
                    </a>
                    <a href={prop.editUrl} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0, color: "#d1d5db" }}>
                      <ExternalLink size={13} />
                    </a>
                  </div>

                  {/* Tipo + precio */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    {prop.type && <span style={{ fontSize: 12, color: "#6b7280" }}>{prop.type}</span>}
                    {prop.operationType && <span style={{ fontSize: 12, color: "#9ca3af" }}>· {prop.operationType}</span>}
                    {prop.price && <span style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>· {formatPrice(prop.price, prop.currency)}</span>}
                    {prop.referenceCode && <span style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>#{prop.referenceCode}</span>}
                  </div>

                  {/* Ficha status */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {ficha.complete ? (
                      <span style={{ fontSize: 11, fontWeight: 500, background: "#EAF3DE", color: "#3B6D11", borderRadius: 6, padding: "2px 8px" }}>✓ Ficha completa</span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 500, background: "#FEF2F2", color: "#dc2626", borderRadius: 6, padding: "2px 8px" }}>
                        ⚠ Falta: {ficha.missing.join(", ")}
                      </span>
                    )}
                    {prop.hasVideo && <span style={{ fontSize: 11, color: "#6b7280" }}>🎥</span>}
                    {prop.hasTour360 && <span style={{ fontSize: 11, color: "#6b7280" }}>🔄 360</span>}
                    {prop.hasBlueprint && <span style={{ fontSize: 11, color: "#6b7280" }}>📐</span>}
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>📷 {prop.photosCount}</span>
                    {prop.daysSinceUpdate !== null && (
                      <span style={{
                        fontSize: 11, fontWeight: 500, padding: "2px 7px", borderRadius: 6,
                        background: prop.daysSinceUpdate > 30 ? "#FEF2F2" : "#f0fdf4",
                        color: prop.daysSinceUpdate > 30 ? "#dc2626" : "#16a34a",
                      }} title={prop.daysSinceUpdate > 30 ? "Actualizá la descripción, precio, foto de portada o el video para mejorar el posicionamiento." : ""}>
                        {prop.daysSinceUpdate > 30 ? `⚠ Sin editar ${prop.daysSinceUpdate}d` : `✓ Editada hace ${prop.daysSinceUpdate}d`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length > 0 && (
          <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", marginTop: 12 }}>
            {filtered.length} propiedades · datos en tiempo real desde Tokko
          </div>
        )}
      </div>
    </AppLayout>
  );
}
