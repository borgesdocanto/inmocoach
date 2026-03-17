import { useState } from "react";
import { useRouter } from "next/router";

const RED = "#aa0000";

interface Rank {
  slug: string; label: string; icon: string; sortOrder: number;
  minIacUp: number; minIacKeep: number; description: string;
}

interface RankStats {
  rank: Rank; nextRank: Rank | null; activeWeeks: number; iacAvg: number;
  bestStreak: number; status: string; weeksToUp: number; weeksToDown: number;
  weeksOnTrack: number; ranks: Rank[];
}

function Tip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center ml-1">
      <button onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        onTouchStart={() => setShow(s => !s)}
        className="w-3.5 h-3.5 rounded-full border border-gray-300 text-gray-400 flex items-center justify-center hover:border-gray-500 transition-colors"
        style={{ fontSize: 8, fontWeight: 900 }}>?</button>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 w-56 bg-gray-900 text-white text-xs rounded-xl px-3 py-2 leading-relaxed shadow-xl pointer-events-none">
          {text}
        </span>
      )}
    </span>
  );
}

export default function RankBadge({ stats }: { stats: RankStats }) {
  const router = useRouter();
  const { rank, nextRank, iacAvg, status, weeksToUp, weeksToDown, weeksOnTrack, ranks } = stats;
  const sorted = [...ranks].sort((a, b) => a.sortOrder - b.sortOrder);
  const currentIdx = sorted.findIndex(r => r.slug === rank.slug);

  // Mensaje de estado motivador
  const statusMsg = (() => {
    if (status === "up") return { text: `🚀 ¡Subiste a ${rank.label}! Seguí así para mantenerlo.`, color: "#16a34a", bg: "#f0fdf4" };
    if (status === "at_risk") return { text: `⚠️ Tu rango está en riesgo — subí tu actividad esta semana para no bajar.`, color: "#d97706", bg: "#fffbeb" };
    if (status === "down") return { text: `📉 Bajaste un nivel. Dos semanas seguidas de baja actividad. ¡Volvé al ruedo!`, color: RED, bg: "#fef2f2" };
    if (nextRank && weeksOnTrack > 0) return { text: `🔥 ${weeksOnTrack}/${weeksToUp} semanas en camino a ${nextRank.label} — ¡no pares!`, color: "#ea580c", bg: "#fff7ed" };
    if (nextRank) return { text: `Necesitás ${weeksToUp} semanas seguidas con IAC ≥ ${nextRank.minIacUp}% para subir a ${nextRank.label}.`, color: "#6b7280", bg: "#f9fafb" };
    return { text: "👑 Nivel máximo. El desafío ahora es mantenerse.", color: "#d97706", bg: "#fffbeb" };
  })();

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">

      {/* Header con rango actual — grande, como juego */}
      <div className="px-5 pt-6 pb-4" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}>
        <div className="flex items-start justify-between mb-4">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tu rango</div>
          <button onClick={() => router.push("/rangos")}
            className="text-xs font-bold px-3 py-1.5 rounded-xl border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-all">
            Ver todos
          </button>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-7xl leading-none" style={{ filter: "drop-shadow(0 4px 12px rgba(255,255,255,0.2))" }}>
            {rank.icon}
          </div>
          <div>
            <div className="text-3xl font-black text-white" style={{ fontFamily: "Georgia, serif" }}>
              {rank.label}
            </div>
            <div className="text-xs text-gray-400 mt-1 max-w-xs">{rank.description}</div>
          </div>
        </div>
      </div>

      {/* Escalera de rangos */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-1">
          {sorted.map((r, i) => (
            <div key={r.slug} className="flex items-center gap-1 flex-1">
              <div className="flex flex-col items-center flex-1 relative group">
                <div className="relative">
                  <div className="flex items-center justify-center rounded-full transition-all"
                    style={{
                      width: i === currentIdx ? 44 : 32,
                      height: i === currentIdx ? 44 : 32,
                      background: i < currentIdx ? "#16a34a" : i === currentIdx ? RED : "#f3f4f6",
                      boxShadow: i === currentIdx ? `0 0 0 3px ${RED}33` : "none",
                    }}>
                    <span style={{ fontSize: i === currentIdx ? 22 : 16, filter: i > currentIdx ? "grayscale(1) opacity(0.35)" : "none" }}>
                      {r.icon}
                    </span>
                  </div>
                  {i < currentIdx && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white" style={{ fontSize: 8 }}>✓</span>
                    </div>
                  )}
                </div>
                <div className="text-center mt-1 leading-tight hidden sm:block" style={{ fontSize: 8, color: i === currentIdx ? RED : "#9ca3af", fontWeight: i === currentIdx ? 700 : 400 }}>
                  {r.label.split(" ")[0]}
                </div>
                {/* Tooltip al hover */}
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-50 w-40 bg-gray-900 text-white text-xs rounded-xl px-2 py-1.5 text-center shadow-xl pointer-events-none">
                  {r.label}<br/>
                  <span className="text-gray-400">IAC ≥ {r.minIacUp}% para subir</span>
                </div>
              </div>
              {i < sorted.length - 1 && (
                <div className="h-0.5 flex-1 rounded-full mb-5 transition-all"
                  style={{ background: i < currentIdx ? "#16a34a" : "#e5e7eb" }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Mensaje de estado */}
      <div className="mx-5 my-3 px-3 py-2.5 rounded-xl text-xs font-medium"
        style={{ background: statusMsg.bg, color: statusMsg.color }}>
        {statusMsg.text}
      </div>

      {/* Progreso hacia el próximo rango */}
      {nextRank && (
        <div className="px-5 pb-5">
          <div className="bg-gray-50 rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
                Próximo: <span className="text-base ml-1">{nextRank.icon}</span> {nextRank.label}
              </span>
              <span className="text-xs font-black px-2 py-0.5 rounded-lg"
                style={{ background: weeksOnTrack > 0 ? "#fff7ed" : "#f3f4f6", color: weeksOnTrack > 0 ? "#ea580c" : "#9ca3af" }}>
                {weeksOnTrack}/{weeksToUp} sem.
              </span>
            </div>

            {/* Barra de semanas en racha */}
            <div className="flex gap-1 mb-3">
              {Array.from({ length: weeksToUp }).map((_, i) => (
                <div key={i} className="flex-1 h-2 rounded-full transition-all"
                  style={{ background: i < weeksOnTrack ? "#ea580c" : "#e5e7eb" }} />
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="text-xs flex items-center gap-0.5"
                style={{ color: iacAvg >= nextRank.minIacUp ? "#16a34a" : "#9ca3af" }}>
                {iacAvg >= nextRank.minIacUp ? "✓ " : ""}IAC prom. {iacAvg}% / {nextRank.minIacUp}%
                <Tip text={`Tu IAC promedio reciente vs el mínimo para subir a ${nextRank.label}. IAC 100% = ${stats.activeWeeks > 0 ? "meta semanal" : "meta semanal"} completa.`} />
              </div>
              <div className="text-xs flex items-center gap-0.5 text-gray-400">
                Mantener: IAC ≥ {rank.minIacKeep}%
                <Tip text={`Si tu IAC cae bajo ${rank.minIacKeep}% por ${weeksToDown} semanas seguidas, bajás un nivel. Así funciona el sistema.`} />
              </div>
              {(nextRank as any).minStreak && (
                <div className="text-xs col-span-2"
                  style={{ color: stats.bestStreak >= (nextRank as any).minStreak ? "#16a34a" : "#9ca3af" }}>
                  {stats.bestStreak >= (nextRank as any).minStreak ? "✓ " : ""}Racha máx. {stats.bestStreak}/{(nextRank as any).minStreak} días
                  <Tip text="La racha más larga que tuviste. Se necesita para alcanzar Master Broker." />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!nextRank && (
        <div className="px-5 pb-5">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center">
            <div className="text-2xl mb-1">👑</div>
            <div className="text-sm font-black text-yellow-700">Nivel máximo — Master Broker</div>
            <div className="text-xs text-yellow-600 mt-1">El desafío ahora es mantenerse. IAC ≥ {rank.minIacKeep}% sostenido.</div>
          </div>
        </div>
      )}
    </div>
  );
}
