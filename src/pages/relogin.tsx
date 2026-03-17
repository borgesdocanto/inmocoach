import Head from "next/head";
import { signIn } from "next-auth/react";

const RED = "#aa0000";

export default function ReloginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4"
      style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <Head><title>Sesión expirada — InmoCoach</title></Head>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-2xl font-black text-gray-900 mb-2" style={{ fontFamily: "Georgia, serif" }}>
          Necesitamos que vuelvas a conectar tu calendario
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-6">
          Tu sesión de Google expiró o los permisos de calendario cambiaron. Es normal — pasa cuando actualizamos los permisos de la app. Solo necesitás volver a iniciar sesión.
        </p>
        <div className="bg-blue-50 rounded-xl p-4 mb-6 text-left">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-2">¿Qué pasa cuando hago click?</p>
          <ul className="text-sm text-blue-600 space-y-1">
            <li>✓ Google te pide confirmar los permisos</li>
            <li>✓ Volvés automáticamente al dashboard</li>
            <li>✓ Tus datos no se pierden</li>
          </ul>
        </div>
        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="w-full py-3 rounded-xl text-white font-black text-sm hover:opacity-90 transition-all"
          style={{ background: RED }}>
          Reconectar Google Calendar →
        </button>
        <p className="text-xs text-gray-300 mt-4">¿Problemas? Escribinos a hola@inmocoach.com.ar</p>
      </div>
    </div>
  );
}
