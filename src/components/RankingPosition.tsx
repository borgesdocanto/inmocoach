import { useState, useEffect } from "react";
import { Loader2, Trophy } from "lucide-react";

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
  { value: "iac_week",  label: "IAC esta semana",   desc: "Reuniones cara a cara en los últimos 7 días", tooltip: "Ranking según tu IAC de esta semana (lunes a hoy). IAC 100% = 15 reuniones cara a cara. Se actualiza cada vez que sincronizás tu calendario." },
  { value: "iac_avg",   label: "IAC promedio",       desc: "Promedio de las últimas 12 semanas activas",  tooltip: "Ranking según tu IAC promedio de las últimas 12 semanas con actividad. Refleja tu consistencia a lo largo del tiempo, no solo esta semana." },
  { value: "rank",      label: "Rango",              desc: "Por nivel: Junior → Master Broker",           tooltip: "Ranking según tu rango actual: Junior → Corredor → Asesor → Senior → Top Producer → Master Broker. El rango sube con semanas activas y IAC promedio." },
];

function ordinalES(n: number): string {
  if (n === 1) return "1°";
  if (n === 2) return "2°";
  if (n === 3) return "3°";
  return `${n}°`;
}

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

export default function RankingPosition() {
  const [mode, setMode] = useState("iac_week");
  const [data, setData] = useState<RankingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/ranking?mode=${mode}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [mode]);

  const currentMode = MODES.find(m => m.value === mode)!;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden"
      style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>

      {/* Header con selector */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Trophy size={13} className="text-gray-400" />
          <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Tu posición</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          {MODES.map(m => (
            <button key={m.value} onClick={() => setMode(m.value)}
              className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all whitespace-nowrap"
              style={{ background: mode === m.value ? RED : "#f3f4f6", color: mode === m.value ? "white" : "#9ca3af" }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Descripción del modo + tooltip */}
      <div className="px-5 pt-3 pb-0 flex items-start gap-1.5">
        <p className="text-xs text-gray-400">{currentMode.desc}</p>
        <div className="relative shrink-0 mt-0.5">
          <button
            onMouseEnter={() => setTooltip(currentMode.tooltip)}
            onMouseLeave={() => setTooltip("")}
            onTouchStart={() => setTooltip(t => t ? "" : currentMode.tooltip)}
            className="w-3.5 h-3.5 rounded-full border border-gray-300 text-gray-400 flex items-center justify-center hover:border-gray-500 hover:text-gray-600 transition-colors"
            style={{ fontSize: 8, fontWeight: 900, lineHeight: 1 }}>?</button>
          {tooltip && (
            <div className="absolute left-0 top-full mt-1.5 z-50 w-64 bg-gray-900 text-white text-xs rounded-xl px-3 py-2.5 leading-relaxed shadow-xl pointer-events-none">
              {tooltip}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={18} className="animate-spin text-gray-300" />
        </div>
      ) : !data ? (
        <div className="px-5 py-8 text-center text-sm text-gray-400">No se pudo cargar el ranking.</div>
      ) : data.globalTotal <= 1 ? (
        <div className="px-5 py-8 text-center">
          <div className="text-3xl mb-2">🚀</div>
          <div className="text-sm font-bold text-gray-700">Sos el primero en el ranking</div>
          <div className="text-xs text-gray-400 mt-1">A medida que más agentes se sumen vas a ver tu posición.</div>
        </div>
      ) : (
        <div className={`grid ${data.hasTeam ? "grid-cols-2" : "grid-cols-1"} gap-px bg-gray-100 mt-3`}>

          {/* Posición global */}
          <div className="bg-white px-6 py-5">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              🌐 InmoCoach global
            </div>
            <div className="flex items-end gap-2">
              <span className="font-black leading-none" style={{
                fontFamily: "Georgia, serif",
                fontSize: 52,
                color: positionColor(data.globalRank, data.globalTotal),
              }}>
                {ordinalES(data.globalRank)}
              </span>
              {podiumEmoji(data.globalRank) && (
                <span className="text-3xl mb-1">{podiumEmoji(data.globalRank)}</span>
              )}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              de <span className="font-black text-gray-600">{data.globalTotal}</span> agentes
            </div>
            {/* Barra de posición */}
            <div className="mt-3 w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(4, 100 - ((data.globalRank - 1) / Math.max(data.globalTotal, 1)) * 100)}%`,
                  background: positionColor(data.globalRank, data.globalTotal)
                }} />
            </div>
            <div className="text-xs text-gray-400 mt-1.5">
              Top {Math.max(1, Math.round((data.globalRank / Math.max(data.globalTotal, 1)) * 100))}% de la plataforma
            </div>
          </div>

          {/* Posición en equipo */}
          {data.hasTeam && (
            <div className="bg-white px-6 py-5">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 truncate">
                👥 {data.teamName}
              </div>
              <div className="flex items-end gap-2">
                <span className="font-black leading-none" style={{
                  fontFamily: "Georgia, serif",
                  fontSize: 52,
                  color: positionColor(data.teamRank, data.teamTotal),
                }}>
                  {ordinalES(data.teamRank)}
                </span>
                {podiumEmoji(data.teamRank) && (
                  <span className="text-3xl mb-1">{podiumEmoji(data.teamRank)}</span>
                )}
              </div>
              <div className="text-sm text-gray-400 mt-1">
                de <span className="font-black text-gray-600">{data.teamTotal}</span> en el equipo
              </div>
              <div className="mt-3 w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(4, 100 - ((data.teamRank - 1) / Math.max(data.teamTotal, 1)) * 100)}%`,
                    background: positionColor(data.teamRank, data.teamTotal)
                  }} />
              </div>
              <div className="text-xs text-gray-400 mt-1.5">
                {data.teamRank === 1 ? "¡Líder del equipo esta semana! 🔥" :
                 data.teamRank === 2 ? "A un paso del liderazgo 💪" :
                 data.teamRank <= Math.ceil(data.teamTotal / 2) ? "En la mitad superior del equipo" :
                 "Podés subir — el equipo te espera arriba"}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
