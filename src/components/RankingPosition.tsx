import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

const RED = "#aa0000";

interface RankingData {
  globalRank: number;
  globalTotal: number;
  teamRank: number;
  teamTotal: number;
  teamName: string;
  hasTeam: boolean;
  mode: string;
}

const MODES = [
  {
    value: "iac_week",
    label: "IAC esta semana",
    desc: "Reuniones cara a cara de esta semana (lunes a hoy)",
    tooltip: "Tu posición según la cantidad de reuniones cara a cara que tuviste esta semana vs el resto de los agentes. Se actualiza cada vez que sincronizás.",
  },
  {
    value: "iac_avg",
    label: "IAC promedio",
    desc: "Promedio de las últimas 12 semanas activas",
    tooltip: "Tu posición según tu IAC promedio histórico. Refleja tu consistencia a lo largo del tiempo — no solo esta semana.",
  },
  {
    value: "rank",
    label: "Rango",
    desc: "Por nivel: Junior → Master Broker",
    tooltip: "Tu posición según tu rango actual. Subís de rango siendo consistente semana a semana.",
  },
];

function ordinalES(n: number): string { return `${n}°`; }

function podiumEmoji(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "";
}

function positionColor(rank: number, total: number): string {
  const pct = rank / total;
  if (rank <= 3) return "#d97706";
  if (pct <= 0.25) return "#16a34a";
  if (pct <= 0.6) return "#d97706";
  return RED;
}

function motivationalMsg(rank: number, total: number): string {
  if (rank === 1) return "Líder 🔥 Mantené el ritmo";
  if (rank === 2) return "A un paso del liderazgo 💪";
  if (rank <= 3) return "Top 3 — seguí así";
  const pct = rank / total;
  if (pct <= 0.25) return `Top ${Math.round(pct * 100)}% — en la élite`;
  if (pct <= 0.5) return "Mitad superior — podés llegar más arriba";
  return "El equipo te espera arriba — subí tu actividad";
}

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center ml-1" style={{ zIndex: show ? 9999 : "auto" }}>
      <button onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        onTouchStart={() => setShow(s => !s)}
        className="w-4 h-4 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors"
        style={{ fontSize: 9, fontWeight: 900, border: "1px solid rgba(255,255,255,0.3)" }}>?</button>
      {show && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%",
          transform: "translateX(-50%)", zIndex: 9999, width: 220,
          background: "#111827", color: "white", fontSize: 11,
          borderRadius: 10, padding: "8px 12px", lineHeight: 1.5,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)", pointerEvents: "none",
          whiteSpace: "normal",
        }}>
          {text}
        </span>
      )}
    </span>
  );
}

function PositionCard({ label, rank, total, emoji }: { label: string; rank: number; total: number; emoji?: string }) {
  const color = positionColor(rank, total);
  const barWidth = Math.max(4, 100 - ((rank - 1) / Math.max(total, 1)) * 100);
  const pod = podiumEmoji(rank);

  return (
    <div className="flex-1 px-6 py-5">
      <div className="text-xs font-bold text-gray-300 uppercase tracking-widest mb-4 flex items-center gap-1.5">
        {emoji} {label}
      </div>
      <div className="flex items-end gap-3 mb-2">
        <span className="font-black leading-none" style={{ fontFamily: "Georgia, serif", fontSize: 64, color, lineHeight: 1 }}>
          {ordinalES(rank)}
        </span>
        {pod && <span className="text-4xl mb-1">{pod}</span>}
      </div>
      <div className="text-sm text-gray-300 mb-4">
        de <span className="font-black text-white">{total}</span> agentes
      </div>
      {/* Barra */}
      <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden mb-2">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${barWidth}%`, background: color }} />
      </div>
      <div className="text-xs font-medium" style={{ color: color === RED ? "#fca5a5" : color === "#d97706" ? "#fcd34d" : "#86efac" }}>
        {motivationalMsg(rank, total)}
      </div>
    </div>
  );
}

export default function RankingPosition() {
  const [mode, setMode] = useState("iac_week");
  const [data, setData] = useState<RankingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/ranking?mode=${mode}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [mode]);

  const currentMode = MODES.find(m => m.value === mode)!;

  return (
    <div className="rounded-2xl border border-gray-100"
      style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>

      {/* Header oscuro */}
      <div className="rounded-2xl" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}>
        <div className="px-5 pt-5 pb-4">
          {/* Título + modos */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">Tu posición</span>
              <Tooltip text="Comparate con los demás agentes de la plataforma y de tu equipo. Cambiá el modo para ver distintas formas de medir la actividad." />
            </div>
            <div className="flex items-center gap-1">
              {MODES.map(m => (
                <button key={m.value} onClick={() => setMode(m.value)}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl transition-all whitespace-nowrap"
                  style={{ background: mode === m.value ? RED : "rgba(255,255,255,0.08)", color: mode === m.value ? "white" : "#9ca3af" }}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Descripción del modo */}
          <div className="flex items-center gap-1 text-xs text-gray-300">
            <span>{currentMode.desc}</span>
            <Tooltip text={currentMode.tooltip} />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={18} className="animate-spin" style={{ color: "#4b5563" }} />
          </div>
        ) : !data ? (
          <div className="px-5 pb-8 text-center text-sm text-gray-400">No se pudo cargar el ranking.</div>
        ) : data.globalTotal <= 1 ? (
          <div className="px-5 pb-8 text-center">
            <div className="text-4xl mb-2">🚀</div>
            <div className="text-sm font-bold text-white">Sos el primero en la plataforma</div>
            <div className="text-xs text-gray-400 mt-1">A medida que más agentes se sumen vas a ver tu posición.</div>
          </div>
        ) : (
          <div className={`flex divide-x divide-white/10 pb-2`}>
            <PositionCard
              label="InmoCoach global"
              rank={data.globalRank}
              total={data.globalTotal}
              emoji="🌐"
            />
            {data.hasTeam && (
              <PositionCard
                label={data.teamName}
                rank={data.teamRank}
                total={data.teamTotal}
                emoji="👥"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
