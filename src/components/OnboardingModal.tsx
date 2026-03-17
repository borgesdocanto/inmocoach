import { useState } from "react";
import { X, CheckCircle } from "lucide-react";

const RED = "#aa0000";
const GREEN = "#16a34a";

interface Props {
  onClose: (dontShow: boolean) => void;
  weeklyGoal?: number;
}

export default function OnboardingModal({ onClose, weeklyGoal = 15 }: Props) {
  const [step, setStep] = useState(0);
  const [dontShow, setDontShow] = useState(false);

  const dailyGoal = Math.round(weeklyGoal / 5);

  const STEPS = [
    {
      emoji: "👋",
      bg: "linear-gradient(135deg, #aa0000 0%, #7f0000 100%)",
      title: "Bienvenido a InmoCoach",
      subtitle: "Tu coach de productividad inmobiliaria",
      content: (
        <div className="space-y-4">
          <p className="text-gray-600 leading-relaxed">
            InmoCoach conecta con tu Google Calendar y mide automáticamente tu actividad comercial real. <strong>No cargás nada manualmente</strong> — solo agendá tus reuniones como siempre.
          </p>
          <div className="flex items-center justify-center gap-3 py-4">
            {[["📅", "Tu calendar"], ["→", ""], ["🤖", "InmoCoach analiza"], ["→", ""], ["📊", "Tu IAC"]].map(([icon, label], i) => (
              label === "" ? (
                <span key={i} className="text-2xl text-gray-300">→</span>
              ) : (
                <div key={i} className="text-center">
                  <div className="text-3xl">{icon}</div>
                  <div className="text-xs text-gray-400 mt-1 font-medium">{label}</div>
                </div>
              )
            ))}
          </div>
          <div className="bg-red-50 rounded-xl p-4 border border-red-100">
            <p className="text-sm text-red-700 font-medium">💡 El sistema actualiza tus datos automáticamente cada vez que entrás. También podés forzar una sincronización con el botón "Actualizar".</p>
          </div>
        </div>
      ),
    },
    {
      emoji: "🟢",
      bg: "linear-gradient(135deg, #15803d 0%, #14532d 100%)",
      title: "¿Qué es un evento verde?",
      subtitle: "La unidad de medida del negocio",
      content: (
        <div className="space-y-4">
          <p className="text-gray-600 leading-relaxed">
            Un <strong style={{ color: GREEN }}>evento verde</strong> es toda reunión cara a cara que genera dinero. El sistema los detecta automáticamente por palabras clave en el título:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[["🏠", "Tasación / Captación"], ["👁️", "Visita / Primera visita"], ["🤝", "Reunión / Cliente"], ["📄", "Propuesta / Presentación"], ["✍️", "Firma / Cierre"], ["📸", "Fotos y video"]].map(([icon, label]) => (
              <div key={label} className="flex items-center gap-2 bg-green-50 rounded-xl px-3 py-2.5">
                <span>{icon}</span>
                <span className="text-sm font-semibold text-green-800">{label}</span>
              </div>
            ))}
          </div>
          <div className="bg-gray-50 rounded-xl p-3 flex items-start gap-2">
            <span>💡</span>
            <p className="text-sm text-gray-500">También podés pintar el evento de <strong>verde</strong> en Google Calendar para que cuente aunque no tenga esas palabras.</p>
          </div>
        </div>
      ),
    },
    {
      emoji: "📊",
      bg: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
      title: "El IAC — tu termómetro",
      subtitle: "Índice de Actividad Comercial",
      content: (
        <div className="space-y-4">
          <p className="text-gray-600 leading-relaxed">
            El <strong>IAC</strong> mide qué tan activo estás comparado con lo que necesitás para generar ingresos predecibles.
          </p>
          <div className="rounded-xl overflow-hidden border border-gray-100">
            <div className="flex justify-between items-center px-4 py-3 bg-green-50 border-b border-gray-100">
              <span className="text-sm font-bold text-gray-700">IAC 100% =</span>
              <span className="text-sm font-black" style={{ color: GREEN }}>{weeklyGoal} reuniones / semana</span>
            </div>
            <div className="flex justify-between items-center px-4 py-3 bg-gray-50 border-b border-gray-100">
              <span className="text-sm font-bold text-gray-700">Meta diaria</span>
              <span className="text-sm font-black" style={{ color: RED }}>{dailyGoal} por día · lun a vie</span>
            </div>
            <div className="flex justify-between items-center px-4 py-3 bg-gray-50 border-b border-gray-100">
              <span className="text-sm font-bold text-gray-700">Captaciones necesarias</span>
              <span className="text-sm font-black text-gray-500">3 por semana</span>
            </div>
            <div className="flex justify-between items-center px-4 py-3 bg-gray-50">
              <span className="text-sm font-bold text-gray-700">6 captaciones →</span>
              <span className="text-sm font-black text-gray-500">1 operación</span>
            </div>
          </div>
          <p className="text-sm text-gray-400">El lunes recibís por mail el análisis de tu semana con consejos concretos del Coach.</p>
        </div>
      ),
    },
    {
      emoji: "🔥",
      bg: "linear-gradient(135deg, #431407 0%, #7c2d12 100%)",
      title: "Rachas y rangos",
      subtitle: "El juego de la productividad",
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-orange-50 rounded-xl p-4">
              <div className="text-2xl mb-2">🔥</div>
              <div className="font-bold text-gray-800 text-sm mb-1">Racha</div>
              <div className="text-xs text-gray-500 leading-relaxed">Días hábiles consecutivos con al menos 1 reunión verde. Si perdés un día, se reinicia. Ganás protectores cada 10 días.</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="text-2xl mb-2">🏆</div>
              <div className="font-bold text-gray-800 text-sm mb-1">Rangos</div>
              <div className="text-xs text-gray-500 leading-relaxed">Subís de Junior a Master Broker según tu consistencia. 4 semanas sobre el umbral y subís. 2 semanas abajo y bajás.</div>
            </div>
          </div>
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
            {[["🏠", "Junior"], ["🚶", "Corredor"], ["📋", "Asesor"], ["⭐", "Senior"], ["🔥", "Top"], ["👑", "Master"]].map(([icon, label], i, arr) => (
              <div key={label} className="flex items-center gap-1">
                <div className="text-center">
                  <div className="text-xl">{icon}</div>
                  <div className="text-gray-400 mt-0.5" style={{ fontSize: 9 }}>{label}</div>
                </div>
                {i < arr.length - 1 && <span className="text-gray-300 text-xs mx-0.5">›</span>}
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-400">Tu ranking semanal muestra tu posición en el equipo y en toda la plataforma.</p>
        </div>
      ),
    },
  ];

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>

        {/* Header coloreado */}
        <div className="px-8 pt-8 pb-6 relative" style={{ background: current.bg }}>
          <button onClick={() => onClose(dontShow)}
            className="absolute top-4 right-4 text-white/40 hover:text-white/80 transition-colors">
            <X size={18} />
          </button>
          <div className="text-5xl mb-3">{current.emoji}</div>
          <div className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">{current.subtitle}</div>
          <h2 className="text-2xl font-black text-white" style={{ fontFamily: "Georgia, serif" }}>{current.title}</h2>

          {/* Progress dots */}
          <div className="flex gap-1.5 mt-4">
            {STEPS.map((_, i) => (
              <button key={i} onClick={() => setStep(i)}
                className="rounded-full transition-all duration-200"
                style={{ width: i === step ? 20 : 8, height: 8, background: i === step ? "white" : "rgba(255,255,255,0.3)" }} />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6 min-h-[280px]">
          {current.content}
        </div>

        {/* Footer */}
        <div className="px-8 pb-7 pt-2 border-t border-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button onClick={() => setStep(s => s - 1)}
                  className="text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors px-2">
                  ← Atrás
                </button>
              )}
              {step === 0 && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div onClick={() => setDontShow(!dontShow)}
                    className="w-4 h-4 rounded border-2 flex items-center justify-center transition-all cursor-pointer flex-shrink-0"
                    style={{ borderColor: dontShow ? RED : "#d1d5db", background: dontShow ? RED : "white" }}>
                    {dontShow && <CheckCircle size={10} color="white" />}
                  </div>
                  <span className="text-xs text-gray-400">No mostrar más</span>
                </label>
              )}
            </div>
            <button
              onClick={() => isLast ? onClose(dontShow) : setStep(s => s + 1)}
              className="px-6 py-2.5 rounded-xl text-sm font-black text-white transition-all hover:opacity-90"
              style={{ background: RED }}>
              {isLast ? "¡Empezar ahora! 🚀" : "Siguiente →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
