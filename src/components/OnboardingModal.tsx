import { useState } from "react";
import { X, Calendar, Target, Zap, CheckCircle } from "lucide-react";

const RED = "#aa0000";
const GREEN = "#16a34a";

const STEPS = [
  {
    icon: <Zap size={28} style={{ color: RED }} />,
    title: "Bienvenido a InstaCoach",
    content: (
      <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
        <p>
          InstaCoach es tu coach de productividad inmobiliaria. Conecta con tu Google Calendar
          y mide automáticamente tu actividad comercial real.
        </p>
        <p>
          No necesitás cargar nada manualmente — solo agendá tus reuniones como siempre
          y el sistema hace el resto.
        </p>
      </div>
    ),
  },
  {
    icon: <Calendar size={28} style={{ color: GREEN }} />,
    title: "Qué es un evento verde",
    content: (
      <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
        <p>
          Un <strong style={{ color: GREEN }}>evento verde</strong> es toda reunión cara a cara
          que genera dinero: tasaciones, visitas, propuestas, firmas, reuniones con clientes.
        </p>
        <p>El sistema los detecta automáticamente si el título contiene palabras como:</p>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {["Tasación", "Visita", "Reunión", "Propuesta", "Firma", "Captación", "Primera visita"].map(k => (
            <span key={k} className="text-xs font-bold px-2 py-1 rounded-lg"
              style={{ background: "#f0fdf4", color: GREEN }}>
              {k}
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-400">
          También podés pintar el evento de verde en Google Calendar para que el sistema lo cuente.
        </p>
      </div>
    ),
  },
  {
    icon: <Target size={28} style={{ color: RED }} />,
    title: "El objetivo: IAC 100%",
    content: (
      <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
        <p>
          El <strong>Índice de Actividad Comercial</strong> mide tu nivel de actividad
          comparado con lo esperable para un Top Producer.
        </p>
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-xs font-bold">
            <span>IAC 100%</span>
            <span style={{ color: GREEN }}>15 / semana · 3 por día</span>
          </div>
          <div className="flex justify-between text-xs font-bold">
            <span>Procesos nuevos</span>
            <span style={{ color: RED }}>3 captaciones / semana</span>
          </div>
          <div className="flex justify-between text-xs font-bold">
            <span>Efectividad</span>
            <span className="text-gray-500">6 procesos = 1 operación</span>
          </div>
        </div>
        <p>
          Tu dashboard ya tiene datos de tu calendario. Revisá tu IAC actual y
          establecé el hábito de las 15 reuniones semanales.
        </p>
      </div>
    ),
  },
];

interface Props {
  onClose: (dontShow: boolean) => void;
}

export default function OnboardingModal({ onClose }: Props) {
  const [step, setStep] = useState(0);
  const [dontShow, setDontShow] = useState(false);

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>

        {/* Progress bar */}
        <div className="h-1 w-full flex">
          {STEPS.map((_, i) => (
            <div key={i} className="flex-1 mx-0.5 rounded-full transition-all duration-300"
              style={{ background: i <= step ? RED : "#e5e7eb" }} />
          ))}
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-2">
          <div className="flex items-center gap-3">
            {current.icon}
            <h2 className="font-black text-lg text-gray-900" style={{ fontFamily: "Georgia, serif" }}>
              {current.title}
            </h2>
          </div>
          <button onClick={() => onClose(dontShow)}
            className="text-gray-300 hover:text-gray-500 transition-colors mt-0.5">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 min-h-[180px]">
          {current.content}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-2 border-t border-gray-50">
          <label className="flex items-center gap-2 cursor-pointer mb-4 select-none">
            <div onClick={() => setDontShow(!dontShow)}
              className="w-4 h-4 rounded border-2 flex items-center justify-center transition-all cursor-pointer flex-shrink-0"
              style={{ borderColor: dontShow ? RED : "#d1d5db", background: dontShow ? RED : "white" }}>
              {dontShow && <CheckCircle size={10} color="white" />}
            </div>
            <span className="text-xs text-gray-400">No volver a mostrar</span>
          </label>

          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {STEPS.map((_, i) => (
                <button key={i} onClick={() => setStep(i)}
                  className="w-2 h-2 rounded-full transition-all"
                  style={{ background: i === step ? RED : "#e5e7eb" }} />
              ))}
            </div>
            <div className="flex gap-2">
              {step > 0 && (
                <button onClick={() => setStep(s => s - 1)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors">
                  Anterior
                </button>
              )}
              <button
                onClick={() => isLast ? onClose(dontShow) : setStep(s => s + 1)}
                className="px-5 py-2 rounded-xl text-xs font-black text-white transition-all hover:opacity-90"
                style={{ background: RED }}>
                {isLast ? "Empezar" : "Siguiente"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
