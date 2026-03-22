import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";

const RED = "#aa0000";

interface Property {
  id: number;
  referenceCode: string | null;
  title: string;
  address: string | null;
  type: string | null;
  operationType: string | null;
  price: number | null;
  currency: string | null;
  status: number;
  photosCount: number;
  hasVideo: boolean;
  hasTour360: boolean;
  daysOnline: number | null;
  daysSinceUpdate: number | null;
  thumbnail: string | null;
  editUrl: string;
  branch: string | null;
}

// Ficha completa = más de 15 fotos + (video o tour360) + actualizada hace menos de 30 días
function fichaScore(prop: Property): { complete: boolean; missing: string[] } {
  const missing: string[] = [];
  if (prop.photosCount < 15) missing.push(`fotos (${prop.photosCount}/15)`);
  if (!prop.hasVideo && !prop.hasTour360) missing.push("video o tour 360");
  if (prop.daysSinceUpdate !== null && prop.daysSinceUpdate > 30) missing.push(`actualización (${prop.daysSinceUpdate}d)`);
  return { complete: missing.length === 0, missing };
}

interface PortfolioData {
  connected: boolean;
  reason?: string;
  properties: Property[];
  stats: {
    total: number;
    active: number;
    reserved: number;
    complete: number;
    incomplete: number;
    stale: number;
    avgDaysOnline: number;
  };
}

function weekLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function formatPrice(price: number | null, currency: string | null): string {
  if (!price) return "Consultar";
  const sym = currency === "USD" ? "USD " : "$";
  return `${sym}${price.toLocaleString("es-AR")}`;
}

function statusLabel(status: number): { label: string; color: string; bg: string } {
  if (status === 2) return { label: "Disponible", color: "#15803d", bg: "#f0fdf4" };
  if (status === 3) return { label: "Reservada", color: "#d97706", bg: "#fffbeb" };
  if (status === 1) return { label: "A cotizar", color: "#6366f1", bg: "#eef2ff" };
  if (status === 4) return { label: "No disponible", color: "#9ca3af", bg: "#f3f4f6" };
  return { label: "Disponible", color: "#15803d", bg: "#f0fdf4" };
}

export default function TokkoPortfolio({ agentEmail }: { agentEmail?: string }) {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showIncomplete, setShowIncomplete] = useState(false);

  useEffect(() => {
    const url = agentEmail
      ? `/api/tokko-portfolio?email=${encodeURIComponent(agentEmail)}`
      : "/api/tokko-portfolio";
    fetch(url, { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 text-center">
      <div className="text-xs text-gray-400 animate-pulse">Cargando cartera Tokko...</div>
    </div>
  );
  if (!data?.connected) return null; // No mostrar nada si no hay Tokko conectado

  const { stats, properties } = data;

  const base = properties.filter(p => p.status === 2 || p.status === 3);
  const filtered = showIncomplete
    ? base.filter(p => p.status === 2 && !fichaScore(p).complete)
    : base;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">

      {/* Header oscuro */}
      <div className="px-5 pt-5 pb-4" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cartera Tokko</div>
          <a href="https://www.tokkobroker.com" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors">
            Abrir Tokko <ExternalLink size={10} />
          </a>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3">
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Disponibles</div>
            <div className="text-3xl font-black text-white" style={{ fontFamily: "Georgia, serif" }}>{stats.active}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Reservadas</div>
            <div className="text-3xl font-black" style={{ fontFamily: "Georgia, serif", color: "#fbbf24" }}>{stats.reserved}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Fichas OK</div>
            <div className="text-3xl font-black" style={{ fontFamily: "Georgia, serif", color: stats.complete === stats.active ? "#4ade80" : "#fb923c" }}>{stats.complete}</div>
          </div>
          <button onClick={() => setShowIncomplete(s => !s)} className="text-left">
            <div className="text-xs mb-0.5" style={{ color: showIncomplete ? "#fbbf24" : "rgba(255,255,255,0.5)" }}>
              {showIncomplete ? "▼ Por actualizar" : "Por actualizar"}
            </div>
            <div className="text-3xl font-black" style={{ fontFamily: "Georgia, serif", color: stats.incomplete > 0 ? "#f87171" : "#4ade80" }}>{stats.incomplete}</div>
          </button>
        </div>

        {/* Alertas */}
        {stats.stale > 0 && (
          <div className="mt-3 text-xs font-medium" style={{ color: "#fca5a5" }}>
            ⚠️ {stats.stale} propiedad{stats.stale !== 1 ? "es" : ""} sin actualizar hace más de 30 días
          </div>
        )}
        {stats.incomplete > 0 && (
          <div className="mt-1 text-xs font-medium" style={{ color: "#fcd34d" }}>
            ⚠ {stats.incomplete} ficha{stats.incomplete !== 1 ? "s" : ""} por mejorar — tocá el número
          </div>
        )}
      </div>

      {/* Banner modo "por actualizar" */}
      {showIncomplete && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center justify-between">
          <span className="text-xs font-bold text-red-600">⚠ Mostrando {filtered.length} ficha{filtered.length !== 1 ? "s" : ""} por mejorar</span>
          <button onClick={() => setShowIncomplete(false)} className="text-xs text-red-400 hover:text-red-600">Ver todas ×</button>
        </div>
      )}

      {/* Lista */}
      <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-5 py-6 text-center text-xs text-gray-400">
            {showIncomplete ? "🎉 Todas las fichas están completas" : "Sin propiedades disponibles o reservadas"}
          </div>
        ) : filtered.slice(0, 30).map(prop => {
          const st = statusLabel(prop.status);
          const ficha = fichaScore(prop);
          return (
            <div key={prop.id} className="px-4 py-3 flex items-center gap-3">
              {/* Thumbnail */}
              <div className="w-16 h-14 rounded-xl overflow-hidden shrink-0 bg-gray-100 flex items-center justify-center">
                {prop.thumbnail
                  ? <img src={prop.thumbnail} alt="" className="w-full h-full object-cover" />
                  : <span className="text-xl">🏠</span>}
              </div>

              <div className="flex-1 min-w-0">
                {/* Dirección + link a Tokko */}
                <div className="flex items-center gap-1.5 mb-0.5">
                  <a href={prop.editUrl} target="_blank" rel="noopener noreferrer"
                    className="text-sm font-bold text-gray-800 truncate hover:underline">
                    {prop.address || prop.title || "Sin dirección"}
                  </a>
                  <a href={prop.editUrl} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 text-gray-300 hover:text-gray-500">
                    <ExternalLink size={11} />
                  </a>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-lg shrink-0"
                    style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  {prop.type && <span className="text-xs text-gray-400">{prop.type}</span>}
                  {prop.price && <span className="text-xs font-semibold text-gray-600">· {formatPrice(prop.price, prop.currency)}</span>}
                </div>

                {/* Indicador ficha */}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {ficha.complete ? (
                    <span className="text-xs font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-lg">✓ Ficha completa</span>
                  ) : (
                    <span className="text-xs font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-lg">
                      ⚠ Falta: {ficha.missing.join(", ")}
                    </span>
                  )}
                  {prop.hasVideo && <span className="text-xs text-gray-400">🎥</span>}
                  {prop.hasTour360 && <span className="text-xs text-gray-400">🔄 360</span>}
                  {prop.daysOnline !== null && <span className="text-xs text-gray-300">{prop.daysOnline}d online</span>}
                  {/* Fecha de última edición */}
                  {prop.daysSinceUpdate !== null && (
                    <span
                      title={prop.daysSinceUpdate > 30
                        ? "Hay algo que cambiar para poder vender esta propiedad: la foto de portada, la descripción, el título, el video o corregir el precio."
                        : `Actualizada hace ${prop.daysSinceUpdate} días`}
                      className="text-xs font-bold px-1.5 py-0.5 rounded-lg cursor-help"
                      style={{
                        background: prop.daysSinceUpdate > 30 ? "#fef2f2" : "#f0fdf4",
                        color: prop.daysSinceUpdate > 30 ? "#ef4444" : "#16a34a",
                      }}>
                      {prop.daysSinceUpdate > 30
                        ? `⚠ Sin editar ${prop.daysSinceUpdate}d`
                        : `✓ Editada hace ${prop.daysSinceUpdate}d`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length > 30 && (
        <div className="px-5 py-3 text-center text-xs text-gray-400 border-t border-gray-50">
          Mostrando 30 de {filtered.length} — abrí Tokko para ver todas
        </div>
      )}
    </div>
  );
}
