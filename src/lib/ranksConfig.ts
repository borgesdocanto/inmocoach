// Cliente-safe — sin imports de Supabase

export interface Rank {
  slug: string;
  label: string;
  icon: string;
  sortOrder: number;
  minWeeks: number;
  minIacUp: number;    // IAC mínimo para SUBIR a este rango
  minIacKeep: number;  // IAC mínimo para MANTENER este rango
  minStreak?: number;
  description: string;
}

// Defaults hardcodeados — se sobreescriben con datos de DB cuando están disponibles
export const DEFAULT_RANKS: Rank[] = [
  { slug: "junior",        label: "Agente Junior",    icon: "🏠", sortOrder: 0, minWeeks: 0,  minIacUp: 0,  minIacKeep: 0,  description: "Recién arrancaste. Empezá a cargar tus reuniones y vas a subir rápido." },
  { slug: "corredor",      label: "Corredor",          icon: "🚶", sortOrder: 1, minWeeks: 4,  minIacUp: 30, minIacKeep: 20, description: "4 semanas con IAC ≥ 30%. Estás tomando el hábito — mantené el ritmo." },
  { slug: "asesor",        label: "Asesor Comercial",  icon: "📋", sortOrder: 2, minWeeks: 8,  minIacUp: 50, minIacKeep: 35, description: "8 semanas con IAC ≥ 50%. Tu actividad es consistente y genera resultados." },
  { slug: "senior",        label: "Senior",            icon: "⭐", sortOrder: 3, minWeeks: 12, minIacUp: 70, minIacKeep: 50, description: "12 semanas con IAC ≥ 70%. Sos un referente de actividad en el equipo." },
  { slug: "top_producer",  label: "Top Producer",      icon: "🔥", sortOrder: 4, minWeeks: 20, minIacUp: 85, minIacKeep: 65, description: "20 semanas con IAC ≥ 85%. Estás en la élite de producción." },
  { slug: "master_broker", label: "Master Broker",     icon: "👑", sortOrder: 5, minWeeks: 30, minIacUp: 90, minIacKeep: 75, minStreak: 20, description: "El nivel más alto. 30 semanas, IAC ≥ 90% sostenido y racha ≥ 20 días." },
];

export function getRankBySlug(slug: string, ranks: Rank[] = DEFAULT_RANKS): Rank {
  return ranks.find(r => r.slug === slug) ?? ranks[0];
}

export function getNextRank(currentSlug: string, ranks: Rank[] = DEFAULT_RANKS): Rank | null {
  const sorted = [...ranks].sort((a, b) => a.sortOrder - b.sortOrder);
  const idx = sorted.findIndex(r => r.slug === currentSlug);
  return idx < sorted.length - 1 ? sorted[idx + 1] : null;
}

export function getPrevRank(currentSlug: string, ranks: Rank[] = DEFAULT_RANKS): Rank | null {
  const sorted = [...ranks].sort((a, b) => a.sortOrder - b.sortOrder);
  const idx = sorted.findIndex(r => r.slug === currentSlug);
  return idx > 0 ? sorted[idx - 1] : null;
}

// Calcula el rango basado en historial de semanas recientes
export function calcRankFromHistory(
  recentWeeks: number[],   // IAC de últimas N semanas, más reciente primero
  currentSlug: string,
  weeksToUp: number,
  weeksToDown: number,
  ranks: Rank[] = DEFAULT_RANKS
): { rank: Rank; status: "up" | "down" | "stable" | "at_risk" } {
  const sorted = [...ranks].sort((a, b) => a.sortOrder - b.sortOrder);
  const currentRank = getRankBySlug(currentSlug, ranks);
  const currentIdx = sorted.findIndex(r => r.slug === currentSlug);
  const nextRank = currentIdx < sorted.length - 1 ? sorted[currentIdx + 1] : null;
  const prevRank = currentIdx > 0 ? sorted[currentIdx - 1] : null;

  // Verificar subida: últimas weeksToUp semanas todas sobre el umbral del próximo rango
  if (nextRank && recentWeeks.length >= weeksToUp) {
    const upWindow = recentWeeks.slice(0, weeksToUp);
    const avgUp = upWindow.reduce((s, v) => s + v, 0) / upWindow.length;
    if (avgUp >= nextRank.minIacUp) {
      return { rank: nextRank, status: "up" };
    }
  }

  // Verificar bajada: últimas weeksToDown semanas bajo el umbral de mantenimiento
  if (prevRank && recentWeeks.length >= weeksToDown) {
    const downWindow = recentWeeks.slice(0, weeksToDown);
    const avgDown = downWindow.reduce((s, v) => s + v, 0) / downWindow.length;
    if (avgDown < currentRank.minIacKeep) {
      return { rank: prevRank, status: "down" };
    }
    // En riesgo: 1 semana bajo el umbral
    if (recentWeeks[0] < currentRank.minIacKeep) {
      return { rank: currentRank, status: "at_risk" };
    }
  }

  return { rank: currentRank, status: "stable" };
}
