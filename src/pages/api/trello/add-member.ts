import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { getSession } from "next-auth/react";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Obtener email
    let userEmail = null;
    try {
      const session = await getSession({ req });
      userEmail = session?.user?.email;
    } catch (e) {
      userEmail = req.headers["x-user-email"] as string;
    }

    if (!userEmail) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Verificar GALAS owner/team_leader
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("team_id, team_role")
      .eq("email", userEmail)
      .single();

    if (!sub) {
      return res.status(403).json({ error: "User not found" });
    }

    const isGalasTeam = sub.team_id === "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93";
    const isAuthorized =
      (sub.team_role === "owner" || sub.team_role === "team_leader") &&
      isGalasTeam;

    if (!isAuthorized) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { cardId, memberEmail } = req.body;
    if (!cardId || !memberEmail) {
      return res
        .status(400)
        .json({ error: "Missing cardId or memberEmail" });
    }

    // Credenciales Trello
    const trelloKey = process.env.TRELLO_API_KEY;
    const trelloToken = process.env.TRELLO_TOKEN;
    const trelloBoardId = process.env.TRELLO_BOARD_ID;

    if (!trelloKey || !trelloToken || !trelloBoardId) {
      return res.status(400).json({ error: "Trello credentials not configured" });
    }

    // 1. Obtener miembros del tablero
    const membersUrl = new URL(
      `https://api.trello.com/1/boards/${trelloBoardId}/members`
    );
    membersUrl.searchParams.append("key", trelloKey);
    membersUrl.searchParams.append("token", trelloToken);

    let response = await fetch(membersUrl.toString());
    if (!response.ok)
      throw new Error(`Trello members: ${response.status}`);

    const members = await response.json();
    const memberId = members.find(
      (m: any) => m.email?.toLowerCase() === memberEmail.toLowerCase()
    )?.id;

    if (!memberId) {
      return res.status(400).json({
        error: `Miembro ${memberEmail} no encontrado en el tablero`,
        hint: "Primero debe estar invitado al tablero Trello",
      });
    }

    // 2. Agregar miembro a tarjeta
    const cardUrl = new URL(`https://api.trello.com/1/cards/${cardId}`);
    cardUrl.searchParams.append("key", trelloKey);
    cardUrl.searchParams.append("token", trelloToken);
    cardUrl.searchParams.append("idMembers", memberId);

    response = await fetch(cardUrl.toString(), {
      method: "POST",
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({
        error: `Trello error: ${response.status}`,
        details: error.slice(0, 200),
      });
    }

    res.status(200).json({
      success: true,
      message: `${memberEmail} agregado a la tarjeta`,
    });
  } catch (error: any) {
    console.error("[add-member] Error:", error);
    res.status(500).json({ error: error.message });
  }
}
