import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Head from "next/head";
import AppLayout from "../components/AppLayout";
import { ExternalLink, X, ChevronLeft, ChevronRight, User, Image as ImageIcon, Home } from "lucide-react";

const RED = "#aa0000";

function formatPrice(price: number | null, currency: string | null) {
  if (!price) return "Consultar";
  return `${currency === "USD" ? "USD " : "$"}${price.toLocaleString("es-AR")}`;
}

// ── Property Detail Modal ────────────────────────────────────────────────────
function PropertyModal({ propId, onClose }: { propId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [tab, setTab] = useState<"ficha" | "propietario">("ficha");

  useEffect(() => {
    fetch(`/api/tokko-property/${propId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setDetail(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [propId]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (lightbox) setLightbox(false); else onClose(); }
      if (e.key === "ArrowLeft") prevPhoto();
      if (e.key === "ArrowRight") nextPhoto();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, photoIdx, detail]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const photos = detail?.photos || [];
  const prevPhoto = () => setPhotoIdx(i => (i - 1 + photos.length) % photos.length);
  const nextPhoto = () => setPhotoIdx(i => (i + 1) % photos.length);

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, backdropFilter: "blur(2px)" }} />

      {/* Modal */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 101,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px", pointerEvents: "none",
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          background: "#fff", borderRadius: 18, width: "100%", maxWidth: 860,
          maxHeight: "92vh", display: "flex", flexDirection: "column",
          boxShadow: "0 24px 80px rgba(0,0,0,0.3)", pointerEvents: "all",
          overflow: "hidden",
        }}>

          {/* Modal header */}
          <div style={{ padding: "16px 20px", borderBottom: "0.5px solid #f3f4f6", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {loading ? "Cargando..." : detail?.address || detail?.title || "Propiedad"}
              </div>
              {detail?.referenceCode && (
                <div style={{ fontSize: 11, color: "#9ca3af" }}>Ref: {detail.referenceCode}</div>
              )}
            </div>
            {detail?.editUrl && (
              <a href={detail.editUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: RED, fontWeight: 500, textDecoration: "none", flexShrink: 0 }}>
                Editar en Tokko <ExternalLink size={12} />
              </a>
            )}
            <button onClick={onClose} style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <X size={16} color="#6b7280" />
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "0.5px solid #f3f4f6", flexShrink: 0 }}>
            {([["ficha", "🏠 Ficha"], ["propietario", "👤 Propietario"]] as const).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "10px 20px", fontSize: 13, fontWeight: tab === t ? 500 : 400,
                color: tab === t ? RED : "#6b7280",
                borderBottom: tab === t ? `2px solid ${RED}` : "2px solid transparent",
                background: "none", border: "none", borderBottom: tab === t ? `2px solid ${RED}` : "2px solid transparent",
                cursor: "pointer",
              }}>{label}</button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: "auto" }}>

            {loading && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "#9ca3af", fontSize: 13 }}>
                Cargando ficha...
              </div>
            )}

            {!loading && !detail && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "#9ca3af", fontSize: 13 }}>
                No se pudo cargar la propiedad.
              </div>
            )}

            {!loading && detail && tab === "ficha" && (
              <div>
                {/* Photo gallery */}
                {photos.length > 0 ? (
                  <div style={{ position: "relative", background: "#111", height: 320 }}>
                    <img
                      src={photos[photoIdx]?.url || photos[photoIdx]?.thumb}
                      alt=""
                      onClick={() => setLightbox(true)}
                      style={{ width: "100%", height: "100%", objectFit: "contain", cursor: "zoom-in" }}
                    />
                    {/* Blueprint badge */}
                    {photos[photoIdx]?.isBlueprint && (
                      <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 11, fontWeight: 500, borderRadius: 6, padding: "3px 10px" }}>
                        📐 Plano
                      </div>
                    )}
                    {/* Nav arrows */}
                    {photos.length > 1 && (
                      <>
                        <button onClick={prevPhoto} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <ChevronLeft size={20} color="#fff" />
                        </button>
                        <button onClick={nextPhoto} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <ChevronRight size={20} color="#fff" />
                        </button>
                        <div style={{ position: "absolute", bottom: 12, right: 12, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 12, borderRadius: 6, padding: "3px 10px" }}>
                          {photoIdx + 1} / {photos.length}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div style={{ height: 200, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 13 }}>
                    Sin fotos
                  </div>
                )}

                {/* Thumbnails */}
                {photos.length > 1 && (
                  <div style={{ display: "flex", gap: 6, padding: "10px 16px", overflowX: "auto", background: "#f9fafb", borderBottom: "0.5px solid #f3f4f6" }}>
                    {photos.map((ph: any, i: number) => (
                      <div key={i} onClick={() => setPhotoIdx(i)} style={{ position: "relative", flexShrink: 0, cursor: "pointer" }}>
                        <img src={ph.thumb || ph.url} alt="" style={{ width: 56, height: 42, objectFit: "cover", borderRadius: 6, border: i === photoIdx ? `2px solid ${RED}` : "2px solid transparent", opacity: i === photoIdx ? 1 : 0.7 }} />
                        {ph.isBlueprint && (
                          <div style={{ position: "absolute", bottom: 2, right: 2, background: "rgba(0,0,0,0.7)", borderRadius: 3, padding: "1px 3px", fontSize: 8, color: "#fff" }}>📐</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Info */}
                <div style={{ padding: "20px 20px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }} className="pm-grid">

                  {/* Left col */}
                  <div>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Datos de la propiedad</div>
                      {[
                        { label: "Tipo", value: detail.type },
                        { label: "Operación", value: detail.operationType },
                        { label: "Precio", value: detail.priceLabel },
                        { label: "Sucursal", value: detail.branch },
                        { label: "Días publicada", value: detail.daysOnline ? `${detail.daysOnline} días` : null },
                      ].filter(r => r.value).map(r => (
                        <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "0.5px solid #f9fafb" }}>
                          <span style={{ fontSize: 13, color: "#6b7280" }}>{r.label}</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{r.value}</span>
                        </div>
                      ))}
                    </div>

                    <div>
                      <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Superficies</div>
                      {[
                        { label: "Total", value: detail.totalSurface ? `${detail.totalSurface} m²` : null },
                        { label: "Cubierta", value: detail.coveredSurface ? `${detail.coveredSurface} m²` : null },
                        { label: "Semicubierta", value: detail.semiCoveredSurface ? `${detail.semiCoveredSurface} m²` : null },
                        { label: "Descubierta", value: detail.uncoveredSurface ? `${detail.uncoveredSurface} m²` : null },
                      ].filter(r => r.value).map(r => (
                        <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "0.5px solid #f9fafb" }}>
                          <span style={{ fontSize: 13, color: "#6b7280" }}>{r.label}</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{r.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right col */}
                  <div>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Ambientes</div>
                      {[
                        { label: "Ambientes", value: detail.rooms },
                        { label: "Dormitorios", value: detail.bedrooms },
                        { label: "Baños", value: detail.bathrooms },
                        { label: "Toilets", value: detail.toilets },
                        { label: "Cocheras", value: detail.parkingLots },
                        { label: "Piso", value: detail.floor },
                        { label: "Antigüedad", value: detail.age ? `${detail.age} años` : null },
                      ].filter(r => r.value !== null && r.value !== undefined).map(r => (
                        <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "0.5px solid #f9fafb" }}>
                          <span style={{ fontSize: 13, color: "#6b7280" }}>{r.label}</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{r.value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Media badges */}
                    <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Multimedia</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, background: photos.length >= 15 ? "#f0fdf4" : "#FEF2F2", color: photos.length >= 15 ? "#16a34a" : "#dc2626", borderRadius: 6, padding: "4px 10px", fontWeight: 500 }}>
                        📷 {photos.filter((p: any) => !p.isBlueprint).length} fotos
                      </span>
                      {detail.hasBlueprint && <span style={{ fontSize: 12, background: "#f0fdf4", color: "#16a34a", borderRadius: 6, padding: "4px 10px", fontWeight: 500 }}>📐 plano</span>}
                      {detail.hasVideo && <span style={{ fontSize: 12, background: "#f0fdf4", color: "#16a34a", borderRadius: 6, padding: "4px 10px", fontWeight: 500 }}>🎥 video</span>}
                      {detail.hasTour && <span style={{ fontSize: 12, background: "#f0fdf4", color: "#16a34a", borderRadius: 6, padding: "4px 10px", fontWeight: 500 }}>🔄 tour 360</span>}
                    </div>
                  </div>
                </div>

                {/* Description */}
                {detail.description && (
                  <div style={{ padding: "0 20px 20px" }}>
                    <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Descripción</div>
                    <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, margin: 0, whiteSpace: "pre-line" }}>{detail.description}</p>
                  </div>
                )}
              </div>
            )}

            {/* Propietario tab */}
            {!loading && detail && tab === "propietario" && (
              <div style={{ padding: 24 }}>
                {detail.owner ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 14, padding: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                        <div style={{ width: 44, height: 44, borderRadius: "50%", background: RED + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <User size={20} color={RED} />
                        </div>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 500, color: "#111827" }}>{detail.owner.name || "Propietario"}</div>
                          <div style={{ fontSize: 12, color: "#9ca3af" }}>Contacto de la propiedad</div>
                        </div>
                      </div>
                      {[
                        { label: "Email", value: detail.owner.email, href: detail.owner.email ? `mailto:${detail.owner.email}` : null },
                        { label: "Teléfono", value: detail.owner.phone, href: detail.owner.phone ? `tel:${detail.owner.phone}` : null },
                      ].filter(r => r.value).map(r => (
                        <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "0.5px solid #f3f4f6" }}>
                          <span style={{ fontSize: 13, color: "#6b7280" }}>{r.label}</span>
                          {r.href ? (
                            <a href={r.href} style={{ fontSize: 13, fontWeight: 500, color: RED, textDecoration: "none" }}>{r.value}</a>
                          ) : (
                            <span style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{r.value}</span>
                          )}
                        </div>
                      ))}
                    </div>
                    <a href={detail.editUrl} target="_blank" rel="noopener noreferrer"
                      style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", fontSize: 13, color: RED, fontWeight: 500, textDecoration: "none", padding: "10px 0" }}>
                      Ver datos completos en Tokko <ExternalLink size={13} />
                    </a>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "40px 20px" }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>👤</div>
                    <div style={{ fontSize: 14, color: "#374151", fontWeight: 500, marginBottom: 6 }}>Datos de propietario no disponibles</div>
                    <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 20 }}>Tokko no retornó datos de contacto para esta propiedad.</div>
                    <a href={detail.editUrl} target="_blank" rel="noopener noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: RED, fontWeight: 500, textDecoration: "none", background: "#fef2f2", borderRadius: 8, padding: "8px 16px" }}>
                      Ver en Tokko <ExternalLink size={13} />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && photos.length > 0 && (
        <div onClick={() => setLightbox(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img
            src={photos[photoIdx]?.url || photos[photoIdx]?.thumb}
            alt=""
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: "95vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 8 }}
          />
          {photos[photoIdx]?.isBlueprint && (
            <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 13, borderRadius: 8, padding: "5px 16px", backdropFilter: "blur(4px)" }}>
              📐 Plano
            </div>
          )}
          <button onClick={e => { e.stopPropagation(); prevPhoto(); }} style={{ position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 48, height: 48, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronLeft size={24} color="#fff" />
          </button>
          <button onClick={e => { e.stopPropagation(); nextPhoto(); }} style={{ position: "absolute", right: 20, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 48, height: 48, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronRight size={24} color="#fff" />
          </button>
          <button onClick={() => setLightbox(false)} style={{ position: "absolute", top: 20, right: 20, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 40, height: 40, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={18} color="#fff" />
          </button>
          <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
            {photoIdx + 1} / {photos.length}
          </div>
        </div>
      )}
    </>
  );
}

function fichaScore(prop: any) {
  const missing: string[] = [];
  if (prop.photosCount < 15) missing.push(`fotos (${prop.photosCount}/15)`);
  if (!prop.hasBlueprint) missing.push("plano");
  if (!prop.hasVideo && !prop.hasTour360) missing.push("video o tour 360");
  // Use daysOnline as fallback when daysSinceUpdate is null (Tokko last_update field often null)
  const ageDays = prop.daysSinceUpdate ?? prop.daysOnline;
  const stale = ageDays !== null && ageDays > 90;
  return { complete: missing.length === 0 && !stale, missing };
}

export default function CarteraPage() {
  const { status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "incomplete" | "stale">("all");
  const [selectedPropId, setSelectedPropId] = useState<string | null>(null);

  // When broker views agent's portfolio from /equipo
  const agentEmail = router.query.agentEmail as string | undefined;
  const agentName = router.query.agentName as string | undefined;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const url = agentEmail
      ? `/api/tokko-portfolio?email=${encodeURIComponent(agentEmail)}`
      : "/api/tokko-portfolio";
    fetch(url, { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [status, agentEmail]);

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
    ? available.filter((p: any) => { const age = p.daysSinceUpdate ?? p.daysOnline; return age !== null && age > 90; })
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
              {agentName && (
                <button onClick={() => router.push("/equipo")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#9ca3af", marginBottom: 6, display: "flex", alignItems: "center", gap: 4, padding: 0 }}>
                  ← Mi equipo
                </button>
              )}
              <div style={{ fontSize: 22, fontWeight: 500, color: "#111827", fontFamily: "Georgia, serif" }}>
                {agentName ? `Cartera de ${agentName}` : "Cartera Tokko"}
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                {agentName ? `Propiedades publicadas de ${agentName}` : "Estado de tus propiedades publicadas"}
              </div>
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

                  {/* Foto grande — click abre modal */}
                  <div
                    onClick={() => setSelectedPropId(String(prop.id))}
                    style={{ position: "relative", height: 180, background: "#f3f4f6", overflow: "hidden", cursor: "pointer" }}>
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
                      {(() => { const age = prop.daysSinceUpdate ?? prop.daysOnline; return age !== null ? (
                        <span style={{
                          fontSize: 11, fontWeight: 500, padding: "2px 7px", borderRadius: 6,
                          background: age > 90 ? "#FEF2F2" : "#f0fdf4",
                          color: age > 90 ? "#dc2626" : "#16a34a",
                        }} title={age > 90 ? "Publicada hace más de 90 días — revisá precio y fotos." : ""}>
                          {age > 90 ? `⚠ +90 días online` : `✓ ${age}d online`}
                        </span>
                      ) : null; })()}
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

      {/* Property modal */}
      {selectedPropId && (
        <PropertyModal propId={selectedPropId} onClose={() => setSelectedPropId(null)} />
      )}

      <style>{`
        .pm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media (max-width: 600px) { .pm-grid { grid-template-columns: 1fr; } }
      `}</style>
    </AppLayout>
  );
}
