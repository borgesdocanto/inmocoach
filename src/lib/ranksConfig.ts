// Cliente-safe — sin imports de Supabase

export interface Rank {
  slug: string;
  label: string;
  icon: string;
  minWeeks: number;
  minIacAvg: number;
  minStreak?: number;
  description: string;
}

export const RANKS: Rank[] = [
  { slug: "junior",       label: "Agente Junior",     icon: "🏠", minWeeks: 0,  minIacAvg: 0,  description: "Recién arrancaste. Conocé el sistema y empezá a cargar tus reuniones." },
  { slug: "corredor",     label: "Corredor",           icon: "🚶", minWeeks: 4,  minIacAvg: 30, description: "4 semanas activo con IAC promedio ≥ 30%. Estás tomando el hábito." },
  { slug: "asesor",       label: "Asesor Comercial",   icon: "📋", minWeeks: 8,  minIacAvg: 50, description: "8 semanas activo con IAC promedio ≥ 50%. Tu actividad es consistente." },
  { slug: "senior",       label: "Senior",             icon: "⭐", minWeeks: 12, minIacAvg: 70, description: "12 semanas activo con IAC promedio ≥ 70%. Sos un referente de actividad." },
  { slug: "top_producer", label: "Top Producer",       icon: "🔥", minWeeks: 20, minIacAvg: 85, description: "20 semanas activo con IAC promedio ≥ 85%. Estás en la élite." },
  { slug: "master_broker",label: "Master Broker",      icon: "👑", minWeeks: 30, minIacAvg: 90, minStreak: 20, description: "30 semanas activo, IAC promedio ≥ 90% y racha máxima ≥ 20 días. El nivel más alto." },
];

export function getRankBySlug(slug: string): Rank {
  return RANKS.find(r => r.slug === slug) ?? RANKS[0];
}

export function getNextRank(currentSlug: string): Rank | null {
  const idx = RANKS.findIndex(r => r.slug === currentSlug);
  return idx < RANKS.length - 1 ? RANKS[idx + 1] : null;
}

export function calcRank(activeWeeks: number, iacAvg: number, bestStreak: number): Rank {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    const r = RANKS[i];
    if (activeWeeks >= r.minWeeks && iacAvg >= r.minIacAvg && (r.minStreak === undefined || bestStreak >= r.minStreak)) {
      return r;
    }
  }
  return RANKS[0];
}
