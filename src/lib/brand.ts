export const BRAND = {
  name: "InmoCoach",
  tagline: "Tu coach inmobiliario siempre activo",
  description: "Sincronizá tu agenda, medí tu productividad y recibí coaching personalizado cada semana.",
  color: "#0ea5e9",
  colorDark: "#0369a1",
  colorLight: "#e0f2fe",
  colorAccent: "#38bdf8",
  vipDomain: "galas.com.ar",
} as const;

// Super admin — teams ilimitado, owner permanente, sin pagar
export const SUPER_ADMIN_EMAIL = "leandro@galas.com.ar";

export const PRODUCTIVITY_GOAL = 3;   // meta diaria: 3 eventos verdes por día
export const IAC_WEEKLY_GOAL = 15;    // meta semanal: 15 eventos verdes (3/día × 5 días)
export const FREEMIUM_DAYS = 7;

// Helper para calcular si un usuario free expiró, respetando trial_ends_at
export function isFreeExpired(u: { plan: string; created_at?: string | null; trial_ends_at?: string | null }): boolean {
  if (u.plan !== "free") return false;
  const now = Date.now();
  if (u.trial_ends_at) return now > new Date(u.trial_ends_at).getTime();
  const diffDays = (now - new Date(u.created_at || 0).getTime()) / (1000 * 60 * 60 * 24);
  return diffDays > FREEMIUM_DAYS;
}
