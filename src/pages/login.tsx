import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Head from "next/head";
import { Loader2 } from "lucide-react";

const RED = "#aa0000";

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [status, router]);

  if (status === "loading" || status === "authenticated") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f5f7" }}>
        <Loader2 className="animate-spin" size={24} style={{ color: RED }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f4f5f7", display: "flex", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <Head><title>Ingresar — InmoCoach</title></Head>

      {/* Left panel — branding */}
      <div style={{ flex: 1, background: "#111827", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px", minHeight: "100vh" }} className="ic-login-left">
        <div style={{ maxWidth: 400, width: "100%" }}>
          <div style={{ fontSize: 36, fontWeight: 500, color: "#fff", fontFamily: "Georgia, serif", marginBottom: 16 }}>
            Inmo<span style={{ color: RED }}>Coach</span>
          </div>
          <div style={{ fontSize: 20, color: "rgba(255,255,255,0.7)", fontFamily: "Georgia, serif", marginBottom: 32, lineHeight: 1.4 }}>
            Tu coach inmobiliario siempre activo
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { icon: "◈", text: "Índice de Actividad Comercial en tiempo real" },
              { icon: "✦", text: "Racha de productividad y sistema de rangos" },
              { icon: "🏠", text: "Estado de cartera conectado con Tokko Broker" },
              { icon: "✧", text: "Análisis semanal con IA personalizado para vos" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{ color: RED, fontSize: 16, marginTop: 1, flexShrink: 0 }}>{item.icon}</span>
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{ width: 420, background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 40px", minHeight: "100vh" }} className="ic-login-right">
        <div style={{ width: "100%", maxWidth: 340 }}>

          {/* Logo mobile */}
          <div style={{ fontSize: 24, fontWeight: 500, fontFamily: "Georgia, serif", color: "#111827", marginBottom: 32, textAlign: "center", display: "none" }} className="ic-login-mobile-logo">
            Inmo<span style={{ color: RED }}>Coach</span>
          </div>

          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 22, fontWeight: 500, color: "#111827", fontFamily: "Georgia, serif", marginBottom: 6 }}>
              Bienvenido
            </div>
            <div style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6 }}>
              Ingresá con tu cuenta Gmail para sincronizar tu Google Calendar automáticamente.
            </div>
          </div>

          {router.query.error && (
            <div style={{ background: "#FEF2F2", border: "0.5px solid #fecaca", borderRadius: 10, padding: "10px 14px", marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "#dc2626" }}>
                {router.query.error === "AccessDenied"
                  ? "Acceso denegado. Verificá que tu cuenta sea del dominio autorizado."
                  : "Error al iniciar sesión. Intentá de nuevo."}
              </div>
            </div>
          )}

          <button
            onClick={async () => { setLoading(true); await signIn("google", { callbackUrl: "/" }); }}
            disabled={loading}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
              padding: "13px 20px", borderRadius: 12, fontSize: 14, fontWeight: 500,
              border: "0.5px solid #e5e7eb", background: loading ? "#f9fafb" : "#fff",
              color: "#374151", cursor: loading ? "default" : "pointer",
              transition: "background 0.15s", marginBottom: 20,
            }}>
            {loading ? <Loader2 size={16} style={{ color: "#9ca3af" }} className="animate-spin" /> : (
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {loading ? "Conectando..." : "Continuar con Google"}
          </button>

          <div style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", lineHeight: 1.7, marginBottom: 24 }}>
            Al ingresar autorizás la lectura de tu Google Calendar.<br />
            No almacenamos ni modificamos tus eventos.
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 20 }}>
            {[["Privacidad", "/privacidad"], ["Términos", "/terminos"], ["¿Qué es InmoCoach?", "/home"]].map(([label, href]) => (
              <a key={href} href={href} style={{ fontSize: 12, color: "#9ca3af", textDecoration: "none" }}>{label}</a>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .ic-login-left { display: none !important; }
          .ic-login-right { width: 100% !important; }
          .ic-login-mobile-logo { display: block !important; }
        }
      `}</style>
    </div>
  );
}
