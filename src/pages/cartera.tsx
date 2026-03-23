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
  const cartHealth = stats.incomplete === 0 ? "green" : stats.incomplete <= stats.active * 0.3 ? "amber" : "red";
  const cartColor = cartHealth === "green" ? "#16a34a" : cartHealth === "amber" ? "#d97706" : "#dc2626";

  const filtered = filter === "incomplete"
    ? available.filter((p: any) => !fichaScore(p).complete)
    : filter === "stale"
    ? available.filter((p: any) => p.daysSinceUpdate !== null && p.daysSinceUpdate > 30)
    : available;

  return (
    <AppLayout greeting={greeting}>
      <Head><title>Cartera Tokko — InmoCoach</title></Head>

      <style>{`
        .ct-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .ct-props { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
        @media (max-width: 767px) {
          .ct-kpis { grid-template-columns: repeat(2, 1fr); }
          .ct-props { grid-template-columns: 1fr; }
        }
      `}</style>

      <div style={{ padding: "24px 24px 60px" }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
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

        {/* KPIs — alertas integradas adentro */}
        <div className="ct-kpis" style={{ marginBottom: 20 }}>

          {/* Disponibles */}
          <div
            onClick={() => setFilter("all")}
            style={{ background: filter === "all" ? "#f9fafb" : "#fff", border: `0.5px solid ${cartColor}20`, borderTop: `3px solid ${cartColor}`, borderRadius: "0 0 12px 12px", padding: 16, cursor: "pointer" }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Disponibles</div>
            <div style={{ fontSize: 36, fontWeight: 500, fontFamily: "Georgia, serif", color: cartColor, lineHeight: 1 }}>{stats.active}</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
              <span style={{ fontWeight: 500, textDecoration: "underline" }}>{filter === "all" ? "mostrando todas" : "ver todas →"}</span>
            </div>
          </div>

          {/* Fichas OK */}
          <div
            onClick={() => setFilter("all")}
            style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderTop: "3px solid #16a34a", borderRadius: "0 0 12px 12px", padding: 16, cursor: "pointer" }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Fichas OK</div>
            <div style={{ fontSize: 36, fontWeight: 500, fontFamily: "Georgia, serif", color: "#16a34a", lineHeight: 1 }}>{stats.complete}</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
              {stats.complete === stats.active
                ? <span style={{ color: "#16a34a", fontWeight: 500 }}>Cartera al día ✓</span>
                : <span>{stats.complete} de {stats.active} completas</span>}
            </div>
          </div>

          {/* Por mejorar — con alerta integrada */}
          <div
            onClick={() => setFilter(f => f === "incomplete" ? "all" : "incomplete")}
            style={{ background: stats.incomplete > 0 ? "#FEF2F2" : "#fff", border: stats.incomplete > 0 ? "1px solid #fecaca" : "0.5px solid #e5e7eb", borderTop: `3px solid ${stats.incomplete > 0 ? "#dc2626" : "#e5e7eb"}`, borderRadius: "0 0 12px 12px", padding: 16, cursor: stats.incomplete > 0 ? "pointer" : "default" }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: stats.incomplete > 0 ? "#991b1b" : "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Por mejorar</div>
            <div style={{ fontSize: 36, fontWeight: 500, fontFamily: "Georgia, serif", color: stats.incomplete > 0 ? "#dc2626" : "#9ca3af", lineHeight: 1 }}>{stats.incomplete}</div>
            <div style={{ fontSize: 11, color: stats.incomplete > 0 ? "#b91c1c" : "#9ca3af", marginTop: 6 }}>
              {stats.incomplete > 0
                ? <>Fotos, plano o video faltante · <span style={{ fontWeight: 500, textDecoration: "underline" }}>{filter === "incomplete" ? "mostrando" : "ver fichas →"}</span></>
                : <span style={{ color: "#16a34a", fontWeight: 500 }}>Todas completas ✓</span>
              }
            </div>
          </div>

          {/* Sin actualizar — con alerta integrada */}
          <div
            onClick={() => setFilter(f => f === "stale" ? "all" : "stale")}
            style={{ background: stats.stale > 0 ? "#FFFBEB" : "#fff", border: stats.stale > 0 ? "0.5px solid #fcd34d" : "0.5px solid #e5e7eb", borderTop: `3px solid ${stats.stale > 0 ? "#d97706" : "#e5e7eb"}`, borderRadius: "0 0 12px 12px", padding: 16, cursor: stats.stale > 0 ? "pointer" : "default" }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: stats.stale > 0 ? "#92400e" : "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Sin actualizar</div>
            <div style={{ fontSize: 36, fontWeight: 500, fontFamily: "Georgia, serif", color: stats.stale > 0 ? "#d97706" : "#9ca3af", lineHeight: 1 }}>{stats.stale}</div>
            <div style={{ fontSize: 11, color: stats.stale > 0 ? "#b45309" : "#9ca3af", marginTop: 6 }}>
              {stats.stale > 0
                ? <>Más de 30 días sin editar · <span style={{ fontWeight: 500, textDecoration: "underline" }}>{filter === "stale" ? "mostrando" : "ver fichas →"}</span></>
                : <span style={{ color: "#16a34a", fontWeight: 500 }}>Todo al día ✓</span>
              }
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
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

        {/* Grid de propiedades */}
        {filtered.length === 0 ? (
          <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, padding: "48px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
            {filter === "incomplete" ? "🎉 Todas las fichas están completas" : filter === "stale" ? "🎉 Todas las propiedades están actualizadas" : "Sin propiedades"}
          </div>
        ) : (
          <div className="ct-props">
            {filtered.map((prop: any) => {
              const ficha = fichaScore(prop);
              return (
                <div key={prop.id} style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>

                  {/* Foto grande */}
                  <div style={{ position: "relative", height: 180, background: "#f3f4f6", overflow: "hidden" }}>
                    {prop.thumbnail
                      ? <img src={prop.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>🏠</div>}
                    {/* Badge estado ficha sobre la foto */}
                    <div style={{ position: "absolute", top: 10, left: 10 }}>
                      {ficha.complete
                        ? <span style={{ fontSize: 11, fontWeight: 500, background: "#EAF3DE", color: "#3B6D11", borderRadius: 6, padding: "3px 8px" }}>✓ Ficha completa</span>
                        : <span style={{ fontSize: 11, fontWeight: 500, background: "rgba(220,38,38,0.9)", color: "#fff", borderRadius: 6, padding: "3px 8px" }}>⚠ Ficha incompleta</span>
                      }
                    </div>
                    {/* Fotos count */}
                    <div style={{ position: "absolute", bottom: 10, right: 10, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 11, borderRadius: 6, padding: "2px 8px" }}>
                      📷 {prop.photosCount}
                    </div>
                  </div>

                  {/* Info */}
                  <div style={{ padding: "14px 14px 12px" }}>
                    {/* Dirección */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, marginBottom: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "#111827", lineHeight: 1.3 }}>
                        {prop.address || prop.title || "Sin dirección"}
                      </div>
                      <a href={prop.editUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#9ca3af", flexShrink: 0, marginTop: 2 }}>
                        <ExternalLink size={13} />
                      </a>
                    </div>

                    {/* Tipo + precio */}
                    <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
                      {prop.type && <span style={{ fontSize: 12, color: "#6b7280" }}>{prop.type}</span>}
                      {prop.operationType && <span style={{ fontSize: 12, color: "#9ca3af" }}>· {prop.operationType}</span>}
                      {prop.price && <span style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>· {formatPrice(prop.price, prop.currency)}</span>}
                    </div>

                    {/* Badges */}
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {!ficha.complete && ficha.missing.length > 0 && (
                        <span style={{ fontSize: 11, background: "#FEF2F2", color: "#dc2626", borderRadius: 6, padding: "2px 7px" }}>
                          Falta: {ficha.missing.join(", ")}
                        </span>
                      )}
                      {prop.hasVideo && <span style={{ fontSize: 11, background: "#f3f4f6", color: "#374151", borderRadius: 6, padding: "2px 7px" }}>🎥 video</span>}
                      {prop.hasTour360 && <span style={{ fontSize: 11, background: "#f3f4f6", color: "#374151", borderRadius: 6, padding: "2px 7px" }}>🔄 360</span>}
                      {prop.hasBlueprint && <span style={{ fontSize: 11, background: "#f3f4f6", color: "#374151", borderRadius: 6, padding: "2px 7px" }}>📐 plano</span>}
                      {prop.daysSinceUpdate !== null && (
                        <span style={{
                          fontSize: 11, fontWeight: 500, padding: "2px 7px", borderRadius: 6,
                          background: prop.daysSinceUpdate > 30 ? "#FEF2F2" : "#f0fdf4",
                          color: prop.daysSinceUpdate > 30 ? "#dc2626" : "#16a34a",
                        }} title={prop.daysSinceUpdate > 30 ? "Actualizá la foto, descripción, precio o el video." : ""}>
                          {prop.daysSinceUpdate > 30 ? `⚠ Sin editar ${prop.daysSinceUpdate}d` : `✓ Editada hace ${prop.daysSinceUpdate}d`}
                        </span>
                      )}
                      {prop.referenceCode && <span style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>#{prop.referenceCode}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filtered.length > 0 && (
          <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", marginTop: 16 }}>
            {filtered.length} propiedades · datos en tiempo real desde Tokko
          </div>
        )}
      </div>
    </AppLayout>
  );
}
