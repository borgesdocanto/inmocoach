import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import { useAgentCardsInit } from "@/hooks/useAgentCardsInit";
import "../styles/globals.css";

function AppWrapper({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  // Inicializar Agent Cards (Storage bucket, etc)
  useAgentCardsInit();
  
  return <Component {...pageProps} />;
}

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <AppWrapper Component={Component} pageProps={{ session, ...pageProps }} />
    </SessionProvider>
  );
}
