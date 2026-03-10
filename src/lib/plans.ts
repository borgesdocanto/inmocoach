export type PlanId = "free" | "individual" | "teams";

export interface Plan {
  id: PlanId;
  name: string;
  price: number;      // precio en ARS (lo que se cobra por MP)
  priceARS: number;   // mismo valor, para compatibilidad
  period: "mes" | "gratis";
  description: string;
  badge?: string;
  features: string[];
  limits: {
    historyDays: number;
    coachMessages: number;
    agents: number;
    weeklyEmail: boolean;
    teamsAccess: boolean;
  };
  highlight?: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    priceARS: 0,
    period: "gratis",
    description: "7 días completos para que vivas la experiencia",
    badge: "7 días gratis",
    features: [
      "Sync completo con Google Calendar",
      "Inmo Coach ilimitado",
      "Dashboard de productividad",
      "Informe semanal por email",
      "Todo desbloqueado por 7 días",
    ],
    limits: { historyDays: -1, coachMessages: -1, agents: -1, weeklyEmail: true, teamsAccess: false },
  },
  individual: {
    id: "individual",
    name: "Individual",
    price: 10500,
    priceARS: 10500,
    period: "mes",
    description: "Para el inmobiliario que quiere escalar",
    highlight: true,
    features: [
      "Todo del plan Free para siempre",
      "Inmo Coach ilimitado",
      "Historial completo sin límite",
      "Informe semanal personalizado",
      "Soporte prioritario",
    ],
    limits: { historyDays: -1, coachMessages: -1, agents: -1, weeklyEmail: true, teamsAccess: false },
  },
  teams: {
    id: "teams",
    name: "Teams",
    price: 10500,   // precio base por agente — el total se calcula en pricing.ts por volumen
    priceARS: 10500,
    period: "mes",
    description: "Para brokers — precio por agente con descuento por volumen",
    badge: "Desde -20% por volumen",
    features: [
      "Todo del plan Individual por agente",
      "Dashboard unificado del broker",
      "Invitación de agentes por email",
      "Informe semanal de todo el equipo",
      "2–4 agentes: $10.500/agente",
      "5–9 agentes: $8.400/agente (-20%)",
      "10–19 agentes: $7.350/agente (-30%)",
      "20+ agentes: $6.300/agente (-40%)",
    ],
    limits: { historyDays: -1, coachMessages: -1, agents: 9999, weeklyEmail: true, teamsAccess: true },
  },
};

export function getPlanById(id: string): Plan {
  return PLANS[id as PlanId] ?? PLANS.free;
}

export function isVipEmail(email: string): boolean {
  return email.toLowerCase().endsWith("@galas.com.ar");
}

// Formatea precio ARS: $ 10.500/mes
export function formatPrice(plan: Plan): string {
  if (plan.price === 0) return "Gratis";
  return `$ ${plan.priceARS.toLocaleString("es-AR")} / mes`;
}
