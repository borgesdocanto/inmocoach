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

    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("tokko_api_key")
      .eq("id", sub.team_id)
      .single();

    if (!team?.tokko_api_key) {
      return res.status(400).json({ error: "No Tokko API key" });
    }

    // Buscar ambas propiedades SIN filtro de status (todas)
    const checkProperty = async (refCode: string) => {
      const searchData = {
        filters: [["reference_code", "", refCode]],
        only_available: "undefined",
        only_reserved: "undefined",  // SIN filtro de status
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

      const url = new URL("https://www.tokkobroker.com/api/v1/property/search/");
      url.searchParams.append("key", team.tokko_api_key);
      url.searchParams.append("format", "json");
      url.searchParams.append("lang", "es_ar");
      url.searchParams.append("data", JSON.stringify(searchData));
      url.searchParams.append("limit", "500");

      const response = await fetch(url.toString());
      const data = await response.json();
      const property = data.objects?.find((p: any) => p.reference_code === refCode);

      if (!property) {
        return { found: false };
      }

      // Map de status
      const statusMap: any = {
        1: "A Tasar",
        2: "Disponible",
        3: "Reservada",
        4: "No disponible",
      };

      return {
        found: true,
        reference_code: property.reference_code,
        address: property.address,
        status: property.status,
        status_name: statusMap[property.status] || "Desconocido",
        branch_id: property.branch?.id,
        branch_name: property.branch?.name,
      };
    };

    const soler = await checkProperty("EHO8463246");
    const mallorca = await checkProperty("EPH8463243");

    res.status(200).json({
      success: true,
      soler_1175: soler,
      mallorca_1431: mallorca,
      explanation: soler.found
        ? `Soler encontrada con status ${soler.status} (${soler.status_name}). Si no es 3, no se sincroniza.`
        : "Soler NO existe en Tokko",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
