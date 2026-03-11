import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Head from "next/head";
import { Loader2 } from "lucide-react";

const RED = "#aa0000";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [status, router]);

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="animate-spin" size={24} style={{ color: RED }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <Head><title>Ingresar — InmoCoach</title></Head>
      <div className="h-0.5 fixed top-0 left-0 right-0" style={{ background: RED }} />

      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black tracking-tight mb-1" style={{ fontFamily: "Georgia, serif" }}>
            Inmo<span style={{ color: RED }}>Coach</span>
          </h1>
          <p className="text-sm text-gray-400">Tu coach inmobiliario siempre activo</p>
        </div>

        <div className="border border-gray-100 rounded-2xl p-7 shadow-sm bg-white">
          <h2 className="font-bold text-lg text-gray-900 mb-1">Bienvenido</h2>
          <p className="text-sm text-gray-400 mb-6">
            Ingresá con tu cuenta Gmail para sincronizar tu Google Calendar automáticamente.
          </p>

          {router.query.error && (
            <div className="mb-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-red-600">
                {router.query.error === "AccessDenied"
                  ? "Acceso denegado. Verificá que tu cuenta sea del dominio autorizado."
                  : "Error al iniciar sesión. Intentá de nuevo."}
              </p>
            </div>
          )}

          <button
            onClick={async () => { setLoading(true); await signIn("google", { callbackUrl: "/" }); }}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl font-semibold text-sm border border-gray-200 bg-white hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            {loading ? <Loader2 size={15} className="animate-spin text-gray-400" /> : (
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            <span className="text-gray-700">{loading ? "Conectando..." : "Continuar con Google"}</span>
          </button>
        </div>

        <p className="text-center text-xs text-gray-300 mt-6">
          Al ingresar autorizás la lectura de tu Google Calendar.<br />No almacenamos ni modificamos tus eventos.
        </p>
        <div className="flex justify-center gap-4 mt-4">
          <a href="/privacidad" className="text-xs text-gray-400 hover:text-gray-600">Privacidad</a>
          <a href="/terminos" className="text-xs text-gray-400 hover:text-gray-600">Términos</a>
          <a href="/home" className="text-xs text-gray-400 hover:text-gray-600">¿Qué es InmoCoach?</a>
        </div>
      </div>
    </div>
  );
}
