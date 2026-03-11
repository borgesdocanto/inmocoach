import { supabaseAdmin } from "./supabase";

export type TeamRole = "owner" | "team_leader" | "member";

export interface TeamMember {
  email: string;
  name?: string;
  avatar?: string;
  plan: string;
  teamRole: TeamRole;
  teamId: string;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  agencyName?: string;
  ownerEmail: string;
  maxAgents: number;
  createdAt: string;
  showTeamLeaders?: boolean;  // mostrar TL en ranking del equipo (default true)
  showBroker?: boolean;       // mostrar broker en ranking del equipo (default true)
  anonymizeGlobal?: boolean;  // anonimizar agentes en ranking global (default false)
}

export async function updateTeamSettings(
  ownerEmail: string,
  settings: { showTeamLeaders?: boolean; showBroker?: boolean; anonymizeGlobal?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  const { supabaseAdmin } = await import("./supabase");
  const { data: team } = await supabaseAdmin
    .from("teams").select("id").eq("owner_email", ownerEmail).single();
  if (!team) return { ok: false, error: "Equipo no encontrado" };
  const update: any = {};
  if (settings.showTeamLeaders !== undefined) update.show_team_leaders = settings.showTeamLeaders;
  if (settings.showBroker !== undefined) update.show_broker = settings.showBroker;
  if (settings.anonymizeGlobal !== undefined) update.anonymize_global = settings.anonymizeGlobal;
  await supabaseAdmin.from("teams").update(update).eq("id", team.id);
  return { ok: true };
}

// Nombre de display del equipo: agencyName si existe, sino "Equipo de {ownerName}"
export function getDisplayName(team: Team, ownerName?: string): string {
  if (team.agencyName) return team.agencyName;
  return ownerName ? `Equipo de ${ownerName}` : "Tu equipo";
}

export async function getOrCreateTeam(ownerEmail: string, teamName: string): Promise<Team> {
  const { data } = await supabaseAdmin
    .from("teams")
    .select("*")
    .eq("owner_email", ownerEmail)
    .single();

  if (data) return mapTeam(data);

  const { data: newTeam } = await supabaseAdmin
    .from("teams")
    .insert({ name: teamName, owner_email: ownerEmail, max_agents: 10 })
    .select()
    .single();

  return mapTeam(newTeam!);
}

// Actualizar nombre de inmobiliaria
export async function updateAgencyName(ownerEmail: string, agencyName: string): Promise<{ ok: boolean; error?: string }> {
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, team_role")
    .eq("email", ownerEmail)
    .single();

  if (!sub?.team_id || sub.team_role !== "owner") {
    return { ok: false, error: "Solo el owner puede actualizar el nombre de la inmobiliaria" };
  }

  await supabaseAdmin
    .from("teams")
    .update({ agency_name: agencyName.trim() || null })
    .eq("id", sub.team_id);

  return { ok: true };
}

export async function inviteAgent(teamId: string, agentEmail: string, invitedBy: string): Promise<{ token: string }> {
  const { data: existing } = await supabaseAdmin
    .from("team_invitations")
    .select("*")
    .eq("team_id", teamId)
    .eq("email", agentEmail)
    .eq("status", "pending")
    .single();

  if (existing) return { token: existing.token };

  const { data } = await supabaseAdmin
    .from("team_invitations")
    .insert({ team_id: teamId, email: agentEmail, invited_by: invitedBy, status: "pending" })
    .select()
    .single();

  return { token: data!.token };
}

export async function acceptInvitation(token: string, agentEmail: string): Promise<{ ok: boolean; error?: string; ownerEmail?: string }> {
  const { data: inv } = await supabaseAdmin
    .from("team_invitations")
    .select("*, teams(*)")
    .eq("token", token)
    .eq("status", "pending")
    .single();

  if (!inv) return { ok: false, error: "Invitación inválida o ya usada" };
  if (inv.email !== agentEmail) return { ok: false, error: "Esta invitación no es para tu email" };

  // Verificar que el equipo sigue activo
  const teamData = inv.teams as any;
  if (teamData?.status === "paused" || teamData?.status === "cancelled") {
    return { ok: false, error: "El equipo ya no está activo. Contactá al broker." };
  }

  // Verificar que el equipo no llenó capacidad desde que se envió la invitación
  const { count: currentCount } = await supabaseAdmin
    .from("subscriptions")
    .select("email", { count: "exact", head: true })
    .eq("team_id", inv.team_id);

  if ((currentCount ?? 0) >= (teamData?.max_agents ?? 1)) {
    return { ok: false, error: "El equipo ya alcanzó su límite de agentes." };
  }

  const { data: brokerSub } = await supabaseAdmin
    .from("subscriptions")
    .select("plan, team_id")
    .eq("email", inv.teams.owner_email)
    .single();

  // No hacer downgrade si el agente ya tiene un plan pagado individualmente con MP real
  const { data: existingAgent } = await supabaseAdmin
    .from("subscriptions")
    .select("plan, mp_subscription_id")
    .eq("email", agentEmail)
    .maybeSingle();

  // Determinar plan del agente:
  // 1. Si el broker tiene teams activo → siempre teams (incluso VIP domain)
  // 2. Si el agente tiene individual con suscripción MP real → no hacer downgrade
  // 3. Caso base → free
  const brokerHasTeams = brokerSub?.plan === "teams" || (brokerSub?.team_id === inv.team_id);
  const agentHasPaidIndividual = existingAgent?.plan === "individual" && !!existingAgent?.mp_subscription_id;
  const agentPlan = brokerHasTeams ? "teams"
    : agentHasPaidIndividual ? "individual"
    : "free";

  await supabaseAdmin
    .from("subscriptions")
    .upsert({
      email: agentEmail,
      plan: agentPlan,
      status: "active",
      team_id: inv.team_id,
      team_role: "member",
    }, { onConflict: "email" });

  await supabaseAdmin
    .from("team_invitations")
    .update({ status: "accepted" })
    .eq("token", token);

  return { ok: true, ownerEmail: inv.teams.owner_email };
}

export async function updateMemberRole(
  ownerEmail: string,
  memberEmail: string,
  newRole: "team_leader" | "member"
): Promise<{ ok: boolean; error?: string }> {
  const { data: ownerSub } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, team_role")
    .eq("email", ownerEmail)
    .single();

  if (!ownerSub || ownerSub.team_role !== "owner") {
    return { ok: false, error: "Solo el owner puede cambiar roles" };
  }

  const { data: memberSub } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, team_role")
    .eq("email", memberEmail)
    .single();

  if (!memberSub || memberSub.team_id !== ownerSub.team_id) {
    return { ok: false, error: "El agente no pertenece a tu equipo" };
  }

  if (memberSub.team_role === "owner") {
    return { ok: false, error: "No podés cambiar el rol del owner" };
  }

  await supabaseAdmin
    .from("subscriptions")
    .update({ team_role: newRole })
    .eq("email", memberEmail);

  return { ok: true };
}

export async function getTeamMembers(requesterEmail: string): Promise<{ members: TeamMember[]; requesterRole: TeamRole | null }> {
  const { data: reqSub } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, team_role, plan")
    .eq("email", requesterEmail)
    .single();

  if (!reqSub?.team_id) return { members: [], requesterRole: null };

  const role = reqSub.team_role as TeamRole;

  if (role !== "owner" && role !== "team_leader") {
    return { members: [], requesterRole: role };
  }

  const { data: members } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("team_id", reqSub.team_id);

  return {
    members: (members || []).map(m => ({
      email: m.email,
      name: m.name,
      avatar: m.avatar,
      plan: m.plan,
      teamRole: m.team_role as TeamRole,
      teamId: m.team_id,
      createdAt: m.created_at,
    })),
    requesterRole: role,
  };
}

export async function getPendingInvitations(requesterEmail: string) {
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, team_role")
    .eq("email", requesterEmail)
    .single();

  if (!sub?.team_id) return [];
  if (sub.team_role !== "owner" && sub.team_role !== "team_leader") return [];

  const { data } = await supabaseAdmin
    .from("team_invitations")
    .select("*")
    .eq("team_id", sub.team_id)
    .eq("status", "pending");

  return data || [];
}

// Obtener datos del equipo incluyendo agency_name
export async function getTeamByOwner(ownerEmail: string): Promise<Team | null> {
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id")
    .eq("email", ownerEmail)
    .single();

  if (!sub?.team_id) return null;

  const { data } = await supabaseAdmin
    .from("teams")
    .select("*")
    .eq("id", sub.team_id)
    .single();

  return data ? mapTeam(data) : null;
}

function mapTeam(data: any): Team {
  return {
    id: data.id,
    name: data.name,
    agencyName: data.agency_name || undefined,
    showTeamLeaders: data.show_team_leaders ?? true,
    showBroker: data.show_broker ?? true,
    anonymizeGlobal: data.anonymize_global ?? false,
    ownerEmail: data.owner_email,
    maxAgents: data.max_agents,
    createdAt: data.created_at,
  };
}
