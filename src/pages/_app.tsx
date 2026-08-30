import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import { useAgentCardsInit } from "@/hooks/useAgentCardsInit";
import { useRouter } from "next/router";
import "../styles/globals.css";

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  const router = useRouter();
  
  // Rutas públicas que no necesitan inicialización
  const isPublicRoute = router.pathname.startsWith('/card') || router.pathname === '/agents' || router.pathname.startsWith('/agents/');
  
  // Inicializar Agent Cards solo en rutas autenticadas
  if (!isPublicRoute) {
    useAgentCardsInit();
  }
  
  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
    </SessionProvider>
  );
}
