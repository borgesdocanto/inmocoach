import { useEffect } from 'react';

/**
 * Hook que ejecuta health check de Agent Cards al cargar la app
 * Asegura que Storage bucket existe antes de intentar operaciones
 */
export function useAgentCardsInit() {
  useEffect(() => {
    // Solo ejecutar una vez en el cliente
    const initAgentCards = async () => {
      try {
        const res = await fetch('/api/health/agent-cards');
        if (!res.ok) {
          console.warn('[AgentCards] Health check failed:', res.status);
        } else {
          const health = await res.json();
          if (health.status === 'healthy') {
            console.log('[AgentCards] ✅ Initialization successful');
          } else {
            console.warn('[AgentCards] ⚠️ System degraded:', health);
          }
        }
      } catch (error) {
        console.error('[AgentCards] Init error:', error);
      }
    };

    // Ejecutar con delay para no bloquear render
    const timer = setTimeout(initAgentCards, 1000);
    return () => clearTimeout(timer);
  }, []);
}
