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
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 bg-gray-900 text-white text-xs rounded-xl px-3 py-2 leading-relaxed shadow-xl pointer-events-none">
          {text}
        </span>
      )}
    </span>
  );
}

export default function StreakBadge({ current, best, todayActive, minGreens = 1, shields = 0 }: Props) {
  const isAlive = current > 0;
  const isOnFire = current >= 5;
  const isBest = current > 0 && current === best && best >= 3;

  const emoji = isOnFire ? "🔥" : isAlive ? "⚡" : "💤";
  const bg = isOnFire ? "#fff7ed" : isAlive ? "#fef2f2" : "#f9fafb";
  const color = isOnFire ? "#ea580c" : isAlive ? "#aa0000" : "#9ca3af";
  const border = isOnFire ? "#fed7aa" : isAlive ? "#fecaca" : "#e5e7eb";

  const reunionWord = minGreens === 1 ? "reunión verde" : "reuniones verdes";
  const msgInactivo = `Agendá al menos ${minGreens} ${reunionWord} hoy para arrancar la racha`;
  const msgMantener = `Agendá al menos ${minGreens} ${reunionWord} hoy para mantenerla`;
  const msgActivo = `Hoy ya sumaste — seguí así`;

  const nextShieldAt = (Math.floor(current / 10) + 1) * 10;
  const daysToShield = nextShieldAt - current;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">

      {/* Título con tooltip */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Racha de actividad</span>
        <Tooltip text={`La racha cuenta los días hábiles (lun–vie) consecutivos en los que agendaste al menos ${minGreens} ${reunionWord}. Si perdés un día, la racha se reinicia. Los sábados y domingos no cuentan.`}>
          <span className="w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center text-gray-400 cursor-default text-xs font-bold">?</span>
        </Tooltip>
      </div>

      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black" style={{ fontFamily: "Georgia, serif", color }}>
              {current}
            </span>
            <span className="text-sm text-gray-400 mb-1">días</span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {current === 0 ? msgInactivo : todayActive ? msgActivo : msgMantener}
          </div>
        </div>
        <div className="text-4xl">{emoji}</div>
      </div>

      {/* Barra de hoy */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: todayActive ? "100%" : "0%", background: isOnFire ? "#ea580c" : "#aa0000" }} />
        </div>
        <span className="text-xs font-bold" style={{ color: todayActive ? "#16a34a" : "#9ca3af" }}>
          {todayActive ? "Hoy ✓" : "Hoy pendiente"}
        </span>
      </div>

      {/* Meta diaria */}
      <div className="text-xs text-gray-300 mb-4">
        Meta diaria: <span className="font-semibold text-gray-400">{minGreens} {reunionWord}</span> para sumar un día
      </div>

      {/* Récord personal — más visible */}
      {best > 0 && (
        <div className="flex items-center gap-3 py-3 px-3 rounded-xl mb-3"
          style={{ background: isBest ? "#fff7ed" : "#f9fafb" }}>
          <span className="text-2xl">🚀</span>
          <div className="flex-1">
            <div className="text-xs text-gray-400 font-medium">Récord personal</div>
            <div className="text-lg font-black" style={{ fontFamily: "Georgia, serif", color: isBest ? "#ea580c" : "#374151" }}>
              {best} días {isBest && <span className="text-base">🏆</span>}
            </div>
          </div>
          {isBest && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
              style={{ background: "#fed7aa", color: "#ea580c" }}>actual</span>
          )}
        </div>
      )}

      {/* Protectores de racha */}
      <div className="flex items-start gap-2 py-3 border-t border-gray-50">
        <div className="flex items-center gap-1.5 flex-1">
          <span className="text-base">🛡️</span>
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-gray-700">
                {shields > 0 ? `${shields} protector${shields !== 1 ? "es" : ""} de racha` : "Sin protectores"}
              </span>
              <Tooltip text="Un protector de racha te salva automáticamente si perdés un día hábil sin eventos verdes. Se consume solo y recibís un aviso. Ganás uno por cada 10 días de racha consecutiva.">
                <span className="w-3.5 h-3.5 rounded-full border border-gray-300 flex items-center justify-center text-gray-400 cursor-default text-xs font-bold" style={{ fontSize: "9px" }}>?</span>
              </Tooltip>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {shields === 0
                ? `Ganá uno llegando a ${nextShieldAt} días con al menos ${minGreens} ${reunionWord} cada día (faltan ${daysToShield})`
                : `Próximo protector en ${daysToShield} día${daysToShield !== 1 ? "s" : ""} más · se usan automáticamente`}
            </div>
          </div>
        </div>
        {shields > 0 && (
          <div className="flex gap-0.5 mt-0.5">
            {Array.from({ length: Math.min(shields, 5) }).map((_, i) => (
              <span key={i} className="text-sm">🛡️</span>
            ))}
            {shields > 5 && <span className="text-xs font-bold text-gray-400 self-center ml-1">+{shields - 5}</span>}
          </div>
        )}
      </div>

      {/* Milestones */}
      {current > 0 && (
        <div className="flex gap-1.5 mt-3 pt-3 border-t border-gray-50 flex-wrap">
          {[1, 5, 10, 20, 30, 50].map(milestone => (
            <div key={milestone}
              className="text-xs px-2 py-0.5 rounded-lg font-bold transition-all"
              style={{
                background: current >= milestone ? bg : "#f9fafb",
                color: current >= milestone ? color : "#d1d5db",
                border: `1px solid ${current >= milestone ? border : "#f3f4f6"}`,
              }}>
              {milestone}d
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
