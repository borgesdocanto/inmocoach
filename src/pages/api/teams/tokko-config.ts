// Permite a brokers/owners configurar su API key de Tokko
// Soporte multitenant: si el usuario no tiene equipo, se crea automáticamente al conectar Tokko
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { isSuperAdmin } from "../../../lib/adminGuard";
import { supabaseAdmin } from "../../../lib/supabase";

// Obtiene el nombre de la agencia desde la API de Tokko (primera branch disponible)
async function getAgencyNameFromTokko(apiKey: string): Promise<string | null> {
  try {
    const r = await fetch(
      `https://www.tokkobroker.com/api/v1/branch/?key=${apiKey}&format=json&limit=1`
    );
    if (!r.ok) return null;
    const d = await r.json();
    const branch = d.objects?.[0];
    // branch.display_name o branch.name
    return branch?.display_name || branch?.name || null;
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).end();

  const email = session.user.email;

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, team_role, name")
    .eq("email", email)
    .single();

  if (!sub) return res.status(404).json({ error: "Usuario no encontrado" });

  // Un usuario sin equipo que intenta configurar Tokko = broker de una nueva inmobiliaria
  // Solo bloqueamos si tiene equipo pero NO es owner (es decir, es member/team_leader de otro)
  const hasTeam = !!sub.team_id;
  const isOwner = sub.team_role === "owner" || isSuperAdmin(email);

  if (hasTeam && !isOwner) {
    return res.status(403).json({ error: "Solo el broker puede configurar Tokko" });
  }

  // ── GET: estado de conexión ──
  if (req.method === "GET") {
    if (!hasTeam) {
      // Sin equipo todavía: no conectado
      return res.status(200).json({ hasKey: false, keyPreview: null });
    }

    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("tokko_api_key")
      .eq("id", sub.team_id)
      .single();

    const key = team?.tokko_api_key;
    return res.status(200).json({
      hasKey: !!key,
      keyPreview: key ? `${"•".repeat(Math.max(0, key.length - 4))}${key.slice(-4)}` : null,
    });
  }

  // ── POST: guardar / remover API key ──
  if (req.method === "POST") {
    const { apiKey, remove } = req.body;

    if (remove) {
      if (!hasTeam) return res.status(200).json({ ok: true });
      await supabaseAdmin.from("teams").update({ tokko_api_key: null }).eq("id", sub.team_id!);
      return res.status(200).json({ ok: true });
    }

    if (!apiKey || typeof apiKey !== "string" || apiKey.length < 10) {
      return res.status(400).json({ error: "API key inválida" });
    }

    // Verificar la key contra Tokko antes de guardar
    const testRes = await fetch(
      `https://www.tokkobroker.com/api/v1/property/?key=${apiKey}&format=json&limit=1`
    );
    if (!testRes.ok) {
      return res.status(200).json({ ok: false, error: "API key inválida — verificá en Tokko → Mi empresa → Permisos" });
    }

    // Verificar que la API key no esté ya en uso por ningún equipo
    const { data: existingTeam } = await supabaseAdmin
      .from("teams")
      .select("id, owner_email")
      .eq("tokko_api_key", apiKey)
      .maybeSingle();

    if (existingTeam) {
      // Buscar el nombre del owner para mostrarlo en el mensaje
      const { data: ownerSub } = await supabaseAdmin
        .from("subscriptions")
        .select("name")
        .eq("email", existingTeam.owner_email)
        .single();

      const ownerName = ownerSub?.name || existingTeam.owner_email;

      return res.status(200).json({
        ok: false,
        error: `Esta API key de Tokko ya está vinculada a la cuenta de ${ownerName}. Contactá con esa persona para coordinar el acceso.`,
      });
    }

    let teamId = sub.team_id;

    // Si el usuario aún no tiene equipo, crearlo ahora
    if (!teamId) {
      const agencyName = await getAgencyNameFromTokko(apiKey);
      const ownerName = sub.name || email.split("@")[0];
      const displayName = agencyName || `Inmobiliaria de ${ownerName}`;

      const { data: newTeam, error: teamErr } = await supabaseAdmin
        .from("teams")
        .insert({
          name: displayName,
          agency_name: agencyName || null,
          owner_email: email,
          status: "active",
          max_agents: 9999,
          tokko_api_key: apiKey,
        })
        .select("id")
        .single();

      if (teamErr || !newTeam) {
        console.error("Error creando equipo:", teamErr);
        return res.status(500).json({ error: "Error al crear el equipo" });
      }

      teamId = newTeam.id;

      // Actualizar la subscription: owner del nuevo equipo, plan individual
      await supabaseAdmin
        .from("subscriptions")
        .update({
          team_id: teamId,
          team_role: "owner",
          plan: "individual",
        })
        .eq("email", email);

    } else {
      // Ya tiene equipo: solo actualizar la API key
      await supabaseAdmin
        .from("teams")
        .update({ tokko_api_key: apiKey })
        .eq("id", teamId);
    }

    // Sync sincrónico — DEBE completar antes de responder (Vercel mata background work)
    try {
      await fetch(`${process.env.NEXTAUTH_URL}/api/admin/tokko-sync-team`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cookie": req.headers.cookie || "" },
        body: JSON.stringify({ teamId }),
      });
    } catch { /* no crítico, el cron nocturno lo completa */ }

    return res.status(200).json({ ok: true, message: "Conectado con Tokko — sincronizando..." });
  }

  return res.status(405).end();
}
