import { useState } from "react";

interface Props {
  current: number;
  best: number;
  todayActive: boolean;
  minGreens?: number;
  shields?: number;
}

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
          transform: "translateX(-50%)", zIndex: 9999, width: 220,
          background: "#111827", color: "white", fontSize: 11,
          borderRadius: 10, padding: "8px 12px", lineHeight: 1.5,
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)", pointerEvents: "none",
          whiteSpace: "normal",
        }}>
          {text}
        </span>
      )}
    </span>
  );
}

const MILESTONES = [1, 5, 10, 20, 30, 50];

export default function StreakBadge({ current, best, todayActive, minGreens = 1, shields = 0 }: Props) {
  const isOnFire = current >= 10;
  const isAlive = current > 0;
  const isBest = current > 0 && current === best && best >= 3;

  const emoji = current >= 20 ? "🔥" : current >= 10 ? "⚡" : current >= 5 ? "💪" : isAlive ? "🌱" : "💤";
  const headerGradient = isOnFire
    ? "linear-gradient(135deg, #431407 0%, #7c2d12 100%)"
    : isAlive
      ? "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)"
      : "linear-gradient(135deg, #1f2937 0%, #111827 100%)";

  const accentColor = isOnFire ? "#fb923c" : isAlive ? "#aa0000" : "#6b7280";
  const reunionWord = minGreens === 1 ? "reunión verde" : "reuniones verdes";
  const nextShieldAt = (Math.floor(current / 10) + 1) * 10;
  const daysToShield = nextShieldAt - current;

  // Progreso hasta el próximo milestone
  const nextMilestone = MILESTONES.find(m => m > current) ?? 50;
  const prevMilestone = [...MILESTONES].reverse().find(m => m <= current) ?? 0;
  const milestoneProgress = nextMilestone === prevMilestone ? 100 : Math.round(((current - prevMilestone) / (nextMilestone - prevMilestone)) * 100);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl">

      {/* Header oscuro — mismo estilo que RankBadge */}
      <div className="px-5 pt-6 pb-5" style={{ background: headerGradient }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Racha de actividad</span>
            <Tooltip text={`La racha cuenta los días hábiles (lun–vie) consecutivos con al menos ${minGreens} ${reunionWord}. Si perdés un día se reinicia. Sáb y dom no cuentan.`}>
              <span className="w-4 h-4 rounded-full border border-gray-600 flex items-center justify-center text-gray-500 cursor-default font-bold" style={{ fontSize: 9 }}>?</span>
            </Tooltip>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-xl"
            style={{ background: todayActive ? "#14532d" : "#374151", color: todayActive ? "#86efac" : "#9ca3af" }}>
            {todayActive ? "Hoy ✓" : "Hoy pendiente"}
          </span>
        </div>

        <div className="flex items-end justify-between">
          {/* Izquierda: emoji + días actuales */}
          <div className="flex items-end gap-4">
            <div style={{ fontSize: 64, lineHeight: 1, filter: "drop-shadow(0 4px 12px rgba(255,255,255,0.15))" }}>
              {emoji}
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-black text-white" style={{ fontSize: 72, fontFamily: "Georgia, serif", lineHeight: 1 }}>
                  {current}
                </span>
                <span className="text-gray-400 text-lg mb-2">días</span>
              </div>
              <div className="text-sm mt-1" style={{ color: accentColor }}>
                {current === 0
                  ? `Agendá ${minGreens} ${reunionWord} hoy`
                  : todayActive
                    ? "Seguí así — ya sumaste hoy"
                    : `Agendá ${minGreens} ${reunionWord} hoy`}
              </div>
            </div>
          </div>

          {/* Derecha: récord personal */}
          {best > 0 && (
            <div className="text-right">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">🚀 Récord</div>
              <div className="font-black text-white" style={{ fontSize: 36, fontFamily: "Georgia, serif", lineHeight: 1, color: isBest ? "#fb923c" : "white" }}>
                {best}
                <span className="text-base font-normal text-gray-400 ml-1">días</span>
              </div>
              {isBest && <div className="text-xs font-bold mt-1" style={{ color: "#fb923c" }}>actual 🏆</div>}
            </div>
          )}
        </div>
      </div>

      {/* Barra de progreso hacia próximo milestone */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400 font-medium">
            {current < nextMilestone
              ? `Próximo hito: ${nextMilestone} días (faltan ${nextMilestone - current})`
              : `¡Llegaste a ${current} días!`}
          </span>
          <span className="text-xs font-bold" style={{ color: accentColor }}>{milestoneProgress}%</span>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: nextMilestone - prevMilestone }).map((_, i) => (
            <div key={i} className="flex-1 h-2 rounded-full transition-all"
              style={{ background: i < (current - prevMilestone) ? accentColor : "#e5e7eb" }} />
          ))}
        </div>
      </div>

      {/* Milestones desbloqueados */}
      <div className="px-5 py-3 border-b border-gray-100">
        <div className="flex gap-2 flex-wrap">
          {MILESTONES.map(m => (
            <div key={m}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all"
              style={{
                background: current >= m ? (isOnFire && m >= 10 ? "#431407" : "#1a1a2e") : "#f3f4f6",
                color: current >= m ? (isOnFire && m >= 10 ? "#fb923c" : "#93c5fd") : "#d1d5db",
                border: `1px solid ${current >= m ? "transparent" : "#e5e7eb"}`,
              }}>
              {current >= m ? "✓" : "○"} {m}d
            </div>
          ))}
        </div>
      </div>

      {/* Protectores de racha */}
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 flex-1">
            <span className="text-xl mt-0.5">🛡️</span>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold text-gray-800">
                  {shields > 0 ? `${shields} protector${shields !== 1 ? "es" : ""}` : "Sin protectores"}
                </span>
                <Tooltip text="Un protector te salva automáticamente si perdés un día sin eventos verdes. Se consume solo y recibís una notificación. Ganás uno cada 10 días de racha.">
                  <span className="w-3.5 h-3.5 rounded-full border border-gray-300 flex items-center justify-center text-gray-400 cursor-default font-bold" style={{ fontSize: 9 }}>?</span>
                </Tooltip>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {shields === 0
                  ? `Ganá uno llegando a ${nextShieldAt} días · faltan ${daysToShield}`
                  : `Próximo en ${daysToShield} día${daysToShield !== 1 ? "s" : ""} · se usan automáticamente`}
              </div>
            </div>
          </div>
          {shields > 0 && (
            <div className="flex gap-0.5">
              {Array.from({ length: Math.min(shields, 5) }).map((_, i) => (
                <span key={i} className="text-lg">🛡️</span>
              ))}
              {shields > 5 && <span className="text-xs font-bold text-gray-400 self-center ml-1">+{shields - 5}</span>}
            </div>
          )}
        </div>

        {/* Meta diaria */}
        <div className="mt-3 pt-3 border-t border-gray-50 text-xs text-gray-400">
          Meta diaria: <span className="font-semibold text-gray-600">{minGreens} {reunionWord}</span> para sumar un día a la racha
        </div>
      </div>
    </div>
  );
}
