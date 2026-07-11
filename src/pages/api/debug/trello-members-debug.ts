import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { getSession } from "next-auth/react";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let userEmail: string | undefined = req.query.email as string;
    
    if (!userEmail) {
      try {
        const session = await getSession({ req });
        userEmail = session?.user?.email || undefined;
      } catch (e) {
        userEmail = (req.headers["x-user-email"] as string) || undefined;
      }
    }

    if (!userEmail) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("team_id, team_role")
      .eq("email", userEmail)
      .single();

    if (!sub) {
      return res.status(403).json({ error: "User not found" });
    }

    const isGalasTeam = sub.team_id === "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93";
    const isAuthorized = (sub.team_role === "owner" || sub.team_role === "team_leader") && isGalasTeam;

    if (!isAuthorized) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { refCode } = req.query;
    if (!refCode || typeof refCode !== "string") {
      return res.status(400).json({ error: "Missing refCode" });
    }

    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("tokko_api_key")
      .eq("id", sub.team_id)
      .single();

    if (!team?.tokko_api_key) {
      return res.status(400).json({ error: "No Tokko API key" });
    }

    // Obtener default members
    const { data: configData } = await supabaseAdmin
      .from("trello_default_members")
      .select("emails")
      .eq("team_id", sub.team_id)
      .single();

    const defaultMembers = configData?.emails || [
      "leandro@galas.com.ar",
      "luciana@galas.com.ar",
    ];

    // Buscar propiedad
    const searchData = {
      filters: [["reference_code", "", refCode]],
      only_available: "undefined",
      only_reserved: "checked",
      only_to_be_cotized: "undefined",
      only_not_available: "undefined",
      with_tags: [],
      without_tags: [],
      with_custom_tags: [],
      with_or_custom_tags: [],
      without_custom_tags: [],
      listing_edition_review: "undefined",
      division_filters: [],
      state_filters: [],
      current_localization_id: "0",
      current_localization_type: "",
      network: [660],
      exclude_my_properties: false,
      price_from: "0",
      price_to: "9999999999",
      operation_types: [],
      property_types: [],
      currency: "USD",
      bounding_box: [],
    };

    const searchUrl = new URL("https://www.tokkobroker.com/api/v1/property/search/");
    searchUrl.searchParams.append("key", team.tokko_api_key);
    searchUrl.searchParams.append("format", "json");
    searchUrl.searchParams.append("lang", "es_ar");
    searchUrl.searchParams.append("data", JSON.stringify(searchData));
    searchUrl.searchParams.append("limit", "500");

    const searchResp = await fetch(searchUrl.toString());
    if (!searchResp.ok) {
      return res.status(400).json({ 
        error: `Tokko error: ${searchResp.status}`,
        url: searchUrl.toString().substring(0, 100),
      });
    }

    let tokkoData;
    try {
      tokkoData = await searchResp.json();
    } catch (e) {
      const text = await searchResp.text();
      return res.status(400).json({ 
        error: "Invalid JSON from Tokko",
        response: text.substring(0, 200),
      });
    }

    const property = tokkoData.objects?.[0];

    if (!property) {
      return res.status(404).json({ error: `Property ${refCode} not found` });
    }

    // Extraer asesores
    const captacionEmail = property.producer?.email;
    const ventaEmail = property.internal_data?.key_agent_user?.email;

    // Armar membersToAdd como lo hace syncReservedToTrello
    const membersToAdd = Array.from(
      new Set([
        ...defaultMembers,
        captacionEmail,
        ventaEmail,
      ])
    ).filter(Boolean) as string[];

    res.status(200).json({
      success: true,
      refCode,
      defaultMembers,
      property_producer_email: captacionEmail,
      property_producer_name: property.producer?.name,
      property_ventaEmail: ventaEmail,
      property_venta_name: property.internal_data?.key_agent_user?.name,
      membersToAdd,
      membersToAdd_count: membersToAdd.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
