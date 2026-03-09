import { supabaseAdmin } from "./supabase";
import { getPricing, calcTeamsTotal, calcExtraAgentPrice } from "./pricing";

// Cuando broker agrega agente extra:
// - Sube max_agents inmediatamente (acceso ya disponible)
// - Guarda el nuevo monto pendiente
// - El próximo ciclo de MP se actualiza al monto correcto
export async function scheduleAgentUpgrade(ownerEmail: string, teamId: string, newTotalAgents: number): Promise<{
  ok: boolean;
  newAmount?: number;
  extraAgentPrice?: number;
  error?: string;
}> {
  try {
    const pricing = await getPricing();
    const newAmount = calcTeamsTotal(pricing, newTotalAgents);
    const extraAgentPrice = calcExtraAgentPrice(pricing);

    // Subir límite inmediatamente — agentes pueden entrar ya
    await supabaseAdmin
      .from("teams")
      .update({
        max_agents: newTotalAgents,
        pending_agents: newTotalAgents,
        pending_amount: newAmount,
      })
      .eq("id", teamId);

    return { ok: true, newAmount, extraAgentPrice };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

// Cuando llega el webhook del próximo cobro mensual:
// Si hay pending_amount, actualiza la suscripción en MP con el nuevo monto
export async function applyPendingUpgrade(ownerEmail: string): Promise<void> {
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("mp_subscription_id, team_id")
    .eq("email", ownerEmail)
    .single();

  if (!sub?.team_id) return;

  const { data: team } = await supabaseAdmin
    .from("teams")
    .select("pending_amount, pending_agents, max_agents")
    .eq("id", sub.team_id)
    .single();

  if (!team?.pending_amount || team.pending_amount === 0) return;

  // Crear nuevo plan en MP con el monto correcto
  const planRes = await fetch("https://api.mercadopago.com/preapproval_plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      reason: `InmoCoach — Teams (${team.pending_agents} agentes)`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: team.pending_amount,
        currency_id: "ARS",
      },
      payment_methods_allowed: {
        payment_types: [{ id: "credit_card" }, { id: "debit_card" }],
      },
      back_url: `${process.env.NEXTAUTH_URL}/pago/exito?plan=teams`,
      notification_url: `${process.env.NEXTAUTH_URL}/api/webhooks/mercadopago`,
    }),
  });

  const planData = await planRes.json();
  if (!planRes.ok || !planData.id) return;

  // Cancelar suscripción vieja si existe
  if (sub.mp_subscription_id) {
    await fetch(`https://api.mercadopago.com/preapproval/${sub.mp_subscription_id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ status: "cancelled" }),
    });
  }

  // Limpiar pendientes
  await supabaseAdmin
    .from("teams")
    .update({ pending_amount: 0, pending_agents: 0 })
    .eq("id", sub.team_id);

  await supabaseAdmin
    .from("subscriptions")
    .update({ mp_subscription_id: planData.id })
    .eq("email", ownerEmail);
}

export async function getActiveAgentCount(teamId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("team_id", teamId)
    .eq("status", "active");
  return count ?? 0;
}
