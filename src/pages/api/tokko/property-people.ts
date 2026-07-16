import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const refCode = (req.query.ref as string) || "EHO374273";

    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("tokko_api_key")
      .eq("id", "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93")
      .single();

    if (!team?.tokko_api_key) {
      return res.status(400).json({ error: "No API key" });
    }

    const key = team.tokko_api_key;

    // Búsqueda por reference_code
    const searchData = {
      filters: [["reference_code", "", refCode]],
      network: [],
      exclude_my_properties: false,
      price_from: "0",
      price_to: "9999999999",
      operation_types: [],
      property_types: [],
      currency: "USD",
      bounding_box: [],
    };

    const url = new URL("https://www.tokkobroker.com/api/v1/property/search/");
    url.searchParams.append("key", key);
    url.searchParams.append("format", "json");
    url.searchParams.append("lang", "es_ar");
    url.searchParams.append("data", JSON.stringify(searchData));
    url.searchParams.append("limit", "500");

    const resp = await fetch(url.toString());
    const data = await resp.json();
    const property = data.objects?.[0];

    if (!property) {
      return res.status(404).json({ error: `Property ${refCode} not found` });
    }

    // Extraer SOLO datos de personas
    const people = {
      producer: property.producer,
      created_by: property.created_by,
      internal_data: {
        key_agent_user: property.internal_data?.key_agent_user,
        maintenance_user: property.internal_data?.maintenance_user,
        property_owners: property.internal_data?.property_owners,
      },
    };

    // Buscar otros campos que podrían tener personas
    const otherPeopleFields: any = {};
    for (const [key, value] of Object.entries(property)) {
      if (
        key.includes("buyer") ||
        key.includes("client") ||
        key.includes("interested") ||
        key.includes("contact") ||
        key.includes("agent") ||
        key.includes("owner") ||
        key.includes("person")
      ) {
        otherPeopleFields[key] = value;
      }
    }

    // Lo mismo para internal_data
    const otherInternalFields: any = {};
    if (property.internal_data) {
      for (const [key, value] of Object.entries(property.internal_data)) {
        if (
          key.includes("buyer") ||
          key.includes("client") ||
          key.includes("interested") ||
          key.includes("contact") ||
          key.includes("agent") ||
          key.includes("owner") ||
          key.includes("person")
        ) {
          otherInternalFields[key] = value;
        }
      }
    }

    res.status(200).json({
      reference_code: property.reference_code,
      address: property.address,
      status: property.status,
      branch: property.branch?.name,
      found_people_data: people,
      other_people_related_fields: otherPeopleFields,
      other_internal_people_fields: otherInternalFields,
      all_internal_data_keys: Object.keys(property.internal_data || {}),
      info: "Busca 'buyer', 'client', 'interested', 'contact', 'agent', 'owner', 'person' en claves",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
