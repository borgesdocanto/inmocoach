import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import { useAgentCardsInit } from "@/hooks/useAgentCardsInit";
import "../styles/globals.css";

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  // Inicializar Agent Cards (Storage bucket, etc)
  useAgentCardsInit();
  
  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
    </SessionProvider>
  );
}
