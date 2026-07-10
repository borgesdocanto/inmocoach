import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Head from "next/head";
import AppLayout from "../../components/AppLayout";
import { CheckCircle2, AlertCircle, Loader2, RefreshCw, Clock } from "lucide-react";

const BRAND = "#0ea5e9";

interface TrelloSync {
  id: number;
  team_id: string;
  status: "running" | "completed" | "failed";
  properties_found: number;
  cards_created: number;
  started_at: string;
  completed_at?: string;
  errors: string[];
}

const STATUS_LABEL: Record<string, { label: string; color: string; icon: any }> = {
  completed: { label: "Completada", color: "#16a34a", icon: CheckCircle2 },
  failed: { label: "Error", color: "#dc2626", icon: AlertCircle },
  running: { label: "Sincronizando...", color: "#0ea5e9", icon: Loader2 },
};

export default function TrelloPage() {
  const router = useRouter();
  const { status, data: session } = useSession();

  const [loading, setLoading] = useState(true);
  const [isGalas, setIsGalas] = useState(false);
  const [logs, setLogs] = useState<TrelloSync[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    const checkGalas = async () => {
      try {
        const r = await fetch("/api/subscription", { credentials: "include" });
        if (!r.ok) throw new Error("No subscription");
        
        const data = await r.json();
        const teamId = data.subscription?.teamId;
        const role = data.subscription?.teamRole;
        
        // Solo owner o team_leader de GALAS
        const isGalasTeam = teamId === "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93";
        const isAuthorized = (role === "owner" || role === "team_leader") && isGalasTeam;
        
        if (isAuthorized) {
          setIsGalas(true);
          loadLogs();
        } else {
          router.replace("/");
        }
      } catch {
        router.replace("/");
      }
      setLoading(false);
    };
    if (status === "authenticated") {
      checkGalas();
    }
  }, [status, router]);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const r = await fetch("/api/trello/logs", {
        credentials: "include",
        headers: {
          "x-user-email": session?.user?.email || "",
        },
      });
      if (r.ok) {
        const data = await r.json();
        setLogs(data.logs || []);
      }
    } catch {
      //
    }
    setLogsLoading(false);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg("");
    try {
      const r = await fetch("/api/trello/sync-now", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": session?.user?.email || "",
        },
        body: JSON.stringify({ branchId: 62 }),
      });
      const data = await r.json();
      if (r.ok) {
        setSyncMsg(`✅ ${data.created} tarjetas sincronizadas`);
        loadLogs();
      } else {
        setSyncMsg(`❌ ${data.error}`);
      }
    } catch (e: any) {
      setSyncMsg(`❌ ${e.message}`);
    }
    setSyncing(false);
  };

  if (loading || !isGalas) {
    return (
      <AppLayout>
        <Head>
          <title>Integraciones - Trello</title>
        </Head>
        <div className="p-8 text-center">Acceso restringido</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Head>
        <title>Integraciones - Trello</title>
      </Head>

      <div className="p-8 max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">📌 Integraciones Trello</h1>
          <p className="text-gray-600">
            Sincroniza propiedades reservadas a tu tablero de Trello automáticamente
          </p>
        </div>

        <div
          className="p-6 rounded-lg border mb-8"
          style={{ borderColor: BRAND, backgroundColor: `${BRAND}08` }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold mb-1">Sincronización Manual</h2>
              <p className="text-sm text-gray-600">
                Sincroniza ahora las propiedades reservadas (Ituzaingó) a Trello
              </p>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-4 py-2 rounded-lg font-semibold flex items-center gap-2"
              style={{
                backgroundColor: BRAND,
                color: "white",
                opacity: syncing ? 0.6 : 1,
              }}
            >
              {syncing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Sincronizar Ahora
                </>
              )}
            </button>
          </div>
          {syncMsg && (
            <div className="mt-4 p-3 rounded text-sm" style={{ color: BRAND }}>
              {syncMsg}
            </div>
          )}
        </div>

        <div className="p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">Historial de Sincronizaciones</h2>

          {logsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: BRAND }} />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-2 opacity-30" />
              No hay sincronizaciones registradas
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const status = STATUS_LABEL[log.status];
                const Icon = status.icon;
                const startTime = new Date(log.started_at);
                const endTime = log.completed_at ? new Date(log.completed_at) : new Date();
                const durationMs = endTime.getTime() - startTime.getTime();
                const durationS = Math.round(durationMs / 1000);

                return (
                  <div
                    key={log.id}
                    className="p-4 rounded-lg border flex items-center justify-between hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <Icon
                        className="w-5 h-5 flex-shrink-0"
                        style={{ color: status.color }}
                      />
                      <div>
                        <div className="font-semibold text-sm">{status.label}</div>
                        <div className="text-xs text-gray-500">
                          {startTime.toLocaleString("es-AR")}
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-sm">
                      <div>
                        <span className="font-semibold">{log.cards_created}</span> tarjetas
                      </div>
                      <div className="text-xs text-gray-500">
                        de {log.properties_found} propiedades
                      </div>
                      {durationS > 0 && (
                        <div className="text-xs text-gray-400">{durationS}s</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
