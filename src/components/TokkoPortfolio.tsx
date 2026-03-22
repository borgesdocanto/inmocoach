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
  daysOnline: number | null;
  daysSinceUpdate: number | null;
  thumbnail: string | null;
  branch: string | null;
}

interface PortfolioData {
  connected: boolean;
  reason?: string;
  properties: Property[];
  stats: {
    total: number;
    active: number;
    reserved: number;
    withPhotos: number;
    stale: number;
    avgDaysOnline: number;
  };
}

function formatPrice(price: number | null, currency: string | null): string {
  if (!price) return "Consultar";
  const sym = currency === "USD" ? "USD " : "$";
  return `${sym}${price.toLocaleString("es-AR")}`;
}

function statusLabel(status: number): { label: string; color: string; bg: string } {
  if (status === 1) return { label: "Publicada", color: "#15803d", bg: "#f0fdf4" };
  if (status === 2) return { label: "Reservada", color: "#d97706", bg: "#fffbeb" };
  if (status === 3) return { label: "Vendida", color: "#6b7280", bg: "#f9fafb" };
  return { label: "No publicada", color: "#9ca3af", bg: "#f3f4f6" };
}

export default function TokkoPortfolio() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "stale">("active");

  useEffect(() => {
    fetch("/api/tokko-portfolio")
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!data?.connected) return null; // No mostrar nada si no hay Tokko conectado

  const { stats, properties } = data;

  const filtered = properties.filter(p => {
    if (filter === "active") return p.status === 1;
    if (filter === "stale") return p.status === 1 && (p.daysSinceUpdate || 0) > 30;
    return true;
  });

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
            <div className="text-xs text-gray-400 mb-0.5">Publicadas</div>
            <div className="text-3xl font-black text-white" style={{ fontFamily: "Georgia, serif" }}>{stats.active}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Reservadas</div>
            <div className="text-3xl font-black" style={{ fontFamily: "Georgia, serif", color: "#fbbf24" }}>{stats.reserved}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Con fotos ≥5</div>
            <div className="text-3xl font-black" style={{ fontFamily: "Georgia, serif", color: stats.withPhotos >= stats.active * 0.8 ? "#4ade80" : "#fb923c" }}>{stats.withPhotos}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Sin actualizar</div>
            <div className="text-3xl font-black" style={{ fontFamily: "Georgia, serif", color: stats.stale > 0 ? "#f87171" : "#4ade80" }}>{stats.stale}</div>
          </div>
        </div>

        {/* Alertas */}
        {stats.stale > 0 && (
          <div className="mt-3 text-xs font-medium" style={{ color: "#fca5a5" }}>
            ⚠️ {stats.stale} propiedad{stats.stale !== 1 ? "es" : ""} sin actualizar hace más de 30 días
          </div>
        )}
        {stats.withPhotos < stats.active && (
          <div className="mt-1 text-xs font-medium" style={{ color: "#fcd34d" }}>
            📷 {stats.active - stats.withPhotos} propiedad{stats.active - stats.withPhotos !== 1 ? "es" : ""} con pocas fotos
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="px-5 py-3 border-b border-gray-100 flex gap-2">
        {[
          { key: "active", label: `Publicadas (${stats.active})` },
          { key: "stale", label: `Sin actualizar (${stats.stale})` },
          { key: "all", label: `Todas (${stats.total})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key as any)}
            className="text-xs font-bold px-3 py-1.5 rounded-xl transition-all"
            style={{
              background: filter === f.key ? RED : "#f3f4f6",
              color: filter === f.key ? "white" : "#9ca3af",
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-5 py-6 text-center text-xs text-gray-400">
            {filter === "stale" ? "No hay propiedades sin actualizar 🎉" : "Sin propiedades en este filtro"}
          </div>
        ) : filtered.slice(0, 20).map(prop => {
          const st = statusLabel(prop.status);
          return (
            <div key={prop.id} className="px-5 py-3 flex items-center gap-3">
              {/* Thumbnail */}
              <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-gray-100 flex items-center justify-center">
                {prop.thumbnail
                  ? <img src={prop.thumbnail} alt="" className="w-full h-full object-cover" />
                  : <span className="text-lg">🏠</span>}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold text-gray-700 truncate">{prop.title}</span>
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-lg shrink-0"
                    style={{ background: st.bg, color: st.color }}>{st.label}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  {prop.type && <span>{prop.type}</span>}
                  {prop.operationType && <span>· {prop.operationType}</span>}
                  {prop.price && <span className="font-semibold text-gray-600">· {formatPrice(prop.price, prop.currency)}</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-300">
                  <span>📷 {prop.photosCount} fotos</span>
                  {prop.daysOnline !== null && <span>· {prop.daysOnline}d online</span>}
                  {prop.daysSinceUpdate !== null && prop.daysSinceUpdate > 30 && (
                    <span style={{ color: "#f87171" }}>· sin actualizar {prop.daysSinceUpdate}d</span>
                  )}
                </div>
              </div>

              {prop.referenceCode && (
                <span className="text-xs text-gray-300 shrink-0 font-mono">{prop.referenceCode}</span>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length > 20 && (
        <div className="px-5 py-3 text-center text-xs text-gray-400 border-t border-gray-50">
          Mostrando 20 de {filtered.length} — abrí Tokko para ver todas
        </div>
      )}
    </div>
  );
}
