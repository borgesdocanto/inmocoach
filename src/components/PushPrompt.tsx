import { Bell, BellOff, X } from "lucide-react";
import { useState } from "react";
import { usePushNotifications } from "../hooks/usePushNotifications";

const RED = "#aa0000";

export default function PushPrompt() {
  const { status, subscribe, unsubscribe } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [justEnabled, setJustEnabled] = useState(false);

  // No mostrar si está cargando, no soportado, ya concedido, denegado, o si lo cerró
  if (status === "loading" || status === "unsupported" || status === "denied" || dismissed) return null;

  if (status === "granted") {
    if (!justEnabled) return null;
    // Confirmar activación por 3 segundos
    return (
      <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-5 py-3"
        style={{ fontFamily: "'Helvetica Neue', sans-serif" }}>
        <Bell size={15} className="text-green-600 shrink-0" />
        <p className="text-sm font-semibold text-green-700 flex-1">
          ✅ Notificaciones activadas — te avisamos si tu racha está en riesgo
        </p>
      </div>
    );
  }

  const handleEnable = async () => {
    setLoading(true);
    const ok = await subscribe();
    setLoading(false);
    if (ok) setJustEnabled(true);
  };

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-2xl px-5 py-4 flex items-start gap-3"
      style={{ fontFamily: "'Helvetica Neue', sans-serif" }}>
      <div className="text-2xl shrink-0">🔥</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-orange-900">Activá las notificaciones de racha</p>
        <p className="text-xs text-orange-700 mt-0.5 leading-relaxed">
          Te avisamos a las 6pm si tu racha está en riesgo — directo en el celu, sin abrir la app.
        </p>
        <div className="flex items-center gap-2 mt-3">
          <button onClick={handleEnable} disabled={loading}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl text-white disabled:opacity-60 hover:opacity-90 transition-all"
            style={{ background: RED }}>
            <Bell size={12} />
            {loading ? "Activando..." : "Activar notificaciones"}
          </button>
          <button onClick={() => setDismissed(true)}
            className="text-xs text-orange-400 hover:text-orange-600 transition-colors px-2 py-2">
            Ahora no
          </button>
        </div>
      </div>
      <button onClick={() => setDismissed(true)} className="text-orange-300 hover:text-orange-500 transition-colors shrink-0">
        <X size={14} />
      </button>
    </div>
  );
}
