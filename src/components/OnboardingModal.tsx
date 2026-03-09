import { useState } from "react";
import { X, Calendar, Target, Zap, Users, CheckCircle, BarChart2, TrendingUp, Search } from "lucide-react";

const RED = "#aa0000";
const GREEN = "#16a34a";
const PURPLE = "#7c3aed";

const STEPS = [
  {
    icon: <Zap size={36} style={{ color: RED }} />,
    title: "Bienvenido a InmoCoach",
    content: (
      <div className="space-y-3 text-base text-gray-600 leading-relaxed">
        <p>
          InmoCoach es tu coach de productividad inmobiliaria. Conecta con tu Google Calendar
          y mide automáticamente tu actividad comercial real.
        </p>
        <p>
          No necesitás cargar nada manualmente — solo agendá tus reuniones como siempre
          y el sistema hace el resto.
        </p>
        <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-4 mt-2">
          <div className="text-center">
            <p className="font-black text-2xl text-gray-900" style={{ fontFamily: "Georgia, serif" }}>📅</p>
            <p className="text-xs text-gray-400 mt-1">Tu calendar</p>
          </div>
          <div className="text-gray-300 text-lg">→</div>
          <div className="text-center">
            <p className="font-black text-2xl text-gray-900" style={{ fontFamily: "Georgia, serif" }}>🤖</p>
            <p className="text-xs text-gray-400 mt-1">InmoCoach analiza</p>
          </div>
          <div className="text-gray-300 text-lg">→</div>
          <div className="text-center">
            <p className="font-black text-2xl text-gray-900" style={{ fontFamily: "Georgia, serif" }}>📊</p>
            <p className="text-xs text-gray-400 mt-1">Tu IAC en tiempo real</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: <Calendar size={36} style={{ color: GREEN }} />,
    title: "Qué es un evento verde",
    content: (
      <div className="space-y-3 text-base text-gray-600 leading-relaxed">
        <p>
          Un <strong style={{ color: GREEN }}>evento verde</strong> es toda reunión cara a cara
          que genera dinero: tasaciones, visitas, propuestas, firmas, reuniones con clientes.
        </p>
        <p>El sistema los detecta automáticamente si el título contiene palabras como:</p>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {["Tasación", "Visita", "Reunión", "Propuesta", "Firma", "Captación", "Primera visita", "Cliente"].map(k => (
            <span key={k} className="text-sm font-bold px-3 py-1.5 rounded-lg"
              style={{ background: "#f0fdf4", color: GREEN }}>
              {k}
            </span>
          ))}
        </div>
        <div className="bg-gray-50 rounded-xl p-3 flex items-start gap-3 mt-1">
          <span className="text-base">💡</span>
          <p className="text-sm text-gray-500">
            También podés pintar el evento de <strong style={{ color: GREEN }}>verde</strong> en Google Calendar
            para que el sistema lo cuente aunque no tenga esas palabras.
          </p>
        </div>
      </div>
    ),
  },
  {
    icon: <Target size={36} style={{ color: RED }} />,
    title: "El objetivo: IAC 100%",
    content: (
      <div className="space-y-3 text-base text-gray-600 leading-relaxed">
        <p>
          El <strong>Índice de Actividad Comercial</strong> mide tu nivel de actividad
          comparado con lo esperable para un Top Producer.
        </p>
        <div className="rounded-xl overflow-hidden border border-gray-100 mt-2">
          <div className="flex justify-between items-center px-5 py-3.5 bg-gray-50 border-b border-gray-100">
            <span className="text-sm font-bold text-gray-700">IAC 100%</span>
            <span className="text-sm font-black" style={{ color: GREEN }}>15 reuniones / semana</span>
          </div>
          <div className="flex justify-between items-center px-5 py-3.5 bg-gray-50 border-b border-gray-100">
            <span className="text-sm font-bold text-gray-700">Meta diaria</span>
            <span className="text-sm font-black" style={{ color: RED }}>3 por día · lunes a viernes</span>
          </div>
          <div className="flex justify-between items-center px-5 py-3.5 bg-gray-50 border-b border-gray-100">
            <span className="text-sm font-bold text-gray-700">Procesos nuevos</span>
            <span className="text-sm font-black text-gray-500">3 captaciones / semana</span>
          </div>
          <div className="flex justify-between items-center px-4 py-3 bg-gray-50">
            <span className="text-sm font-bold text-gray-700">Efectividad de mercado</span>
            <span className="text-sm font-black text-gray-500">6 procesos = 1 operación</span>
          </div>
        </div>
        <p className="text-sm text-gray-400">
          Tu dashboard ya tiene datos de tu calendario. Revisá tu IAC actual y
          establecé el hábito de las 15 reuniones semanales.
        </p>
      </div>
    ),
  },
  {
    icon: <Users size={36} style={{ color: PURPLE }} />,
    title: "¿Sos broker? Gestioná tu equipo",
    content: (
      <div className="space-y-3 text-base text-gray-600 leading-relaxed">
        <p>
          Con el <strong style={{ color: PURPLE }}>Plan Teams</strong> tenés un dashboard completo
          para gestionar la productividad de todos tus agentes en tiempo real.
        </p>
        <div className="space-y-2 mt-1">
          <div className="flex items-start gap-3 bg-purple-50 rounded-xl px-5 py-4">
            <BarChart2 size={18} style={{ color: PURPLE }} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-gray-800">Métricas individuales</p>
              <p className="text-sm text-gray-500">Ves el IAC, reuniones y actividad de cada agente por separado.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-purple-50 rounded-xl px-5 py-4">
            <TrendingUp size={18} style={{ color: PURPLE }} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-gray-800">Ranking del equipo</p>
              <p className="text-sm text-gray-500">Sabés quiénes están en racha y quiénes necesitan apoyo esta semana.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-purple-50 rounded-xl px-5 py-4">
            <Search size={18} style={{ color: PURPLE }} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-gray-800">Decisiones basadas en datos</p>
              <p className="text-sm text-gray-500">Enfocá tu coaching donde más impacto tiene, no por intuición.</p>
            </div>
          </div>
        </div>
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
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
        style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>

        {/* Progress bar top */}
        <div className="h-1.5 w-full flex gap-0.5 p-0">
          {STEPS.map((_, i) => (
            <div key={i} className="flex-1 transition-all duration-300"
              style={{ background: i <= step ? RED : "#e5e7eb",
                borderRadius: i === 0 ? "4px 0 0 0" : i === STEPS.length - 1 ? "0 4px 0 0" : "0" }} />
          ))}
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-10 pt-8 pb-3">
          <div className="flex items-center gap-3">
            {current.icon}
            <h2 className="font-black text-2xl text-gray-900" style={{ fontFamily: "Georgia, serif" }}>
              {current.title}
            </h2>
          </div>
          <button onClick={() => onClose(dontShow)}
            className="text-gray-300 hover:text-gray-500 transition-colors mt-1 ml-2 shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-10 py-5 min-h-[280px]">
          {current.content}
        </div>

        {/* Footer */}
        <div className="px-10 pb-8 pt-4 border-t border-gray-50">

          {/* Dots */}
          <div className="flex justify-center gap-1.5 mb-4">
            {STEPS.map((_, i) => (
              <button key={i} onClick={() => setStep(i)}
                className="rounded-full transition-all duration-200"
                style={{
                  width: i === step ? 20 : 8,
                  height: 8,
                  background: i === step ? RED : "#e5e7eb"
                }} />
            ))}
          </div>

          {/* Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer mb-4 select-none justify-center">
            <div onClick={() => setDontShow(!dontShow)}
              className="w-4 h-4 rounded border-2 flex items-center justify-center transition-all cursor-pointer flex-shrink-0"
              style={{ borderColor: dontShow ? RED : "#d1d5db", background: dontShow ? RED : "white" }}>
              {dontShow && <CheckCircle size={10} color="white" />}
            </div>
            <span className="text-sm text-gray-400">No volver a mostrar</span>
          </label>

          {/* Buttons */}
          <div className="flex items-center justify-between">
            {step > 0 ? (
              <button onClick={() => setStep(s => s - 1)}
                className="px-4 py-3 rounded-xl text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors">
                ← Anterior
              </button>
            ) : <div />}
            <button
              onClick={() => isLast ? onClose(dontShow) : setStep(s => s + 1)}
              className="px-6 py-2.5 rounded-xl text-base font-black text-white transition-all hover:opacity-90 shadow-sm"
              style={{ background: RED }}>
              {isLast ? "¡Empezar ahora!" : "Siguiente →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
