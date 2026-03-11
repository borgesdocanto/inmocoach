import { supabaseAdmin } from "./supabase";
import { getPlanById, isVipEmail, PlanId } from "./plans";
import { FREEMIUM_DAYS, SUPER_ADMIN_EMAIL } from "./brand";

function isSuperAdmin(email: string) {
  return email === SUPER_ADMIN_EMAIL;
}

export interface Subscription {
  email: string;
  name?: string;
  plan: PlanId;
  status: "active" | "cancelled" | "past_due" | "expired";
  currentPeriodEnd?: string;
  createdAt: string;
  teamId?: string;
  teamRole?: string;
  isVip: boolean;
}

export async function getOrCreateSubscription(
  email: string,
  name?: string,
  avatar?: string
): Promise<Subscription> {
  const vip = isVipEmail(email);
  const superAdmin = isSuperAdmin(email);

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("email", email)
    .single();

  if (data && !error) {
    // Super admin — siempre teams owner
    if (superAdmin && (data.plan !== "teams" || data.team_role !== "owner")) {
      await ensureSuperAdminTeam(email, name);
      return { ...mapSub(data), plan: "teams", status: "active", teamRole: "owner", isVip: true };
    }
    // VIP domain — siempre individual activo
    if (vip && data.plan === "free") {
      await supabaseAdmin
        .from("subscriptions")
        .update({ plan: "individual", status: "active" })
        .eq("email", email);
      return { ...mapSub(data), plan: "individual", status: "active", isVip: true };
    }
    return { ...mapSub(data), isVip: vip };
  }

  // Primera vez
  if (superAdmin) {
    await ensureSuperAdminTeam(email, name);
    return { email, name, plan: "teams", status: "active", createdAt: new Date().toISOString(), teamRole: "owner", isVip: true };
  }

  const plan = vip ? "individual" : "free";
  await supabaseAdmin
    .from("subscriptions")
    .insert({ email, name, avatar, plan, status: "active" });

  return { email, name, plan, status: "active", createdAt: new Date().toISOString(), isVip: vip };
}

async function ensureSuperAdminTeam(email: string, name?: string) {
  // Crear o recuperar el equipo con max_agents ilimitado
  const { data: existingTeam } = await supabaseAdmin
    .from("teams")
    .select("id")
    .eq("owner_email", email)
    .single();

  let teamId: string;
  if (existingTeam) {
    teamId = existingTeam.id;
    // Asegurar que max_agents sea ilimitado (9999)
    await supabaseAdmin.from("teams").update({ max_agents: 9999 }).eq("id", teamId);
  } else {
    const { data: newTeam } = await supabaseAdmin
      .from("teams")
      .insert({ name: `Equipo ${name || email.split("@")[0]}`, owner_email: email, max_agents: 9999 })
      .select()
      .single();
    teamId = newTeam!.id;
  }

  await supabaseAdmin
    .from("subscriptions")
    .upsert({
      email,
      name,
      plan: "teams",
      status: "active",
      team_id: teamId,
      team_role: "owner",
    }, { onConflict: "email" });
}

function mapSub(data: any): Subscription {
  return {
    email: data.email,
    name: data.name,
    plan: data.plan,
    status: data.status,
    currentPeriodEnd: data.current_period_end,
    createdAt: data.created_at,
    teamId: data.team_id,
    teamRole: data.team_role,
    isVip: isVipEmail(data.email),
  };
}

// Verifica si el freemium expiró (más de FREEMIUM_DAYS desde created_at)
export function isFreemiumExpired(sub: Subscription): boolean {
  if (sub.plan !== "free") return false;
  if (sub.isVip) return false;
  const created = new Date(sub.createdAt);
  const now = new Date();
  const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays > FREEMIUM_DAYS;
}

// Verifica si el equipo del broker está expirado (cancelado y paid_until vencido)
export async function getTeamStatus(teamId: string): Promise<{
  status: "active" | "paused" | "expired";
  paidUntil: Date | null;
  brokerName: string;
  brokerEmail: string;
}> {
  const { data: team } = await supabaseAdmin
    .from("teams")
    .select("status, paid_until, owner_email")
    .eq("id", teamId)
    .single();

  const { data: broker } = await supabaseAdmin
    .from("subscriptions")
    .select("name, email")
    .eq("email", team?.owner_email)
    .single();

  const paidUntil = team?.paid_until ? new Date(team.paid_until) : null;
  const isPaidPeriodOver = !paidUntil || paidUntil < new Date();

  let status: "active" | "paused" | "expired" = "active";
  if (team?.status === "paused") {
    status = isPaidPeriodOver ? "expired" : "paused";
  }

  return {
    status,
    paidUntil,
    brokerName: broker?.name || team?.owner_email || "",
    brokerEmail: team?.owner_email || "",
  };
}

// Verifica si un agente fue removido y aún tiene días free
export async function getRemovedAgentFreeUntil(email: string): Promise<Date | null> {
  // Si tiene plan free y no tiene team_id, verificar si tiene free_until vigente
  const { data } = await supabaseAdmin
    .from("team_removals")
    .select("free_until")
    .eq("removed_email", email)
    .order("removed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.free_until) return null;
  const freeUntil = new Date(data.free_until);
  return freeUntil > new Date() ? freeUntil : null;
}

export async function upgradePlan(
  email: string,
  plan: PlanId,
  mpSubscriptionId?: string,
  mpPayerId?: string
) {
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  await supabaseAdmin
    .from("subscriptions")
    .upsert({
      email,
      plan,
      status: "active",
      mp_subscription_id: mpSubscriptionId,
      mp_payer_id: mpPayerId,
      current_period_start: new Date().toISOString(),
      current_period_end: periodEnd.toISOString(),
    }, { onConflict: "email" });
}

// Trae todos los usuarios activos para el cron de mail
export async function getAllActiveSubscriptions(): Promise<Subscription[]> {
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .in("status", ["active"]);
  if (!data) return [];
  return data
    .filter(s => !isFreemiumExpired(mapSub(s)))
    .map(mapSub);
}
