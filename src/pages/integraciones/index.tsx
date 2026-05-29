import { useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import AppLayout from "../../components/AppLayout";
import Head from "next/head";
import Link from "next/link";

export default function IntegracionesPage() {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  // Redirigir directo a tokko-setup (es la integración default)
  useEffect(() => {
    if (status === "authenticated") router.replace("/tokko-setup");
  }, [status, router]);

  return (
    <AppLayout>
      <Head><title>Integraciones — InmoCoach</title></Head>
      <div style={{ padding: "32px 24px", maxWidth: 640 }}>
        <p style={{ color: "#6b7280", fontSize: 14 }}>Redirigiendo...</p>
      </div>
    </AppLayout>
  );
}
