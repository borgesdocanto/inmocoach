import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [status, router]);

  const handleLogin = async () => {
    setLoading(true);
    await signIn("google", { callbackUrl: "/" });
  };

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-galas-red" size={32} style={{ color: "#aa0000" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      {/* Barra superior */}
      <div className="fixed top-0 left-0 right-0 h-1"
        style={{ background: "linear-gradient(90deg, #aa0000, #6b0000, #aa0000)" }} />

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white font-black text-2xl shadow-xl"
            style={{ background: "linear-gradient(135deg, #aa0000, #6b0000)" }}
          >G</div>
          <h1 className="font-display text-4xl font-black tracking-tight" style={{ color: "#aa0000" }}>
            GALAS
          </h1>
          <p className="text-slate-400 font-semibold text-sm mt-1 tracking-widest uppercase">
            Management System
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
          <h2 className="font-black text-xl text-slate-800 mb-1">Bienvenido</h2>
          <p className="text-slate-400 text-sm font-medium mb-6">
            Ingresá con tu cuenta Gmail para sincronizar tu calendario automáticamente.
          </p>

          {router.query.error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
              <p className="text-red-700 text-xs font-bold">
                {router.query.error === "AccessDenied"
                  ? "Acceso denegado. Verificá que tu cuenta sea del dominio autorizado."
                  : "Error al iniciar sesión. Intentá de nuevo."}
              </p>
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl font-bold text-sm border-2 border-slate-200 hover:border-slate-300 bg-white transition-all hover:shadow-md disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            <span className="text-slate-700">
              {loading ? "Conectando..." : "Continuar con Google"}
            </span>
          </button>
        </div>

        <p className="text-center text-xs text-slate-300 font-medium mt-6">
          Al ingresar autorizás la lectura de tu Google Calendar.<br />
          No almacenamos ni modificamos tus eventos.
        </p>
      </div>
    </div>
  );
}
