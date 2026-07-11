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

    const { refCode, branchId } = req.query;
    if (!refCode || typeof refCode !== "string") {
      return res.status(400).json({ error: "Missing refCode" });
    }

    const branch = branchId ? parseInt(branchId as string) : 62;

    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("tokko_api_key")
      .eq("id", sub.team_id)
      .single();

    if (!team?.tokko_api_key) {
      return res.status(400).json({ error: "No Tokko API key" });
    }

    // BÚSQUEDA 1: Por reference_code SIN filtro branch (ver si existe en CUALQUIER rama)
    const searchData1 = {
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

    const searchUrl1 = new URL("https://www.tokkobroker.com/api/v1/property/search/");
    searchUrl1.searchParams.append("key", team.tokko_api_key);
    searchUrl1.searchParams.append("format", "json");
    searchUrl1.searchParams.append("lang", "es_ar");
    searchUrl1.searchParams.append("data", JSON.stringify(searchData1));
    searchUrl1.searchParams.append("limit", "500");

    const searchResp1 = await fetch(searchUrl1.toString());
    const tokkoData1 = await searchResp1.json();
    const propertyAnyBranch = tokkoData1.objects?.find((p: any) => p.reference_code === refCode);

    // BÚSQUEDA 2: Con filtro branch específico
    const searchData2 = {
      filters: [["reference_code", "", refCode], ["branch_id", "", branch.toString()]],
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

    const searchUrl2 = new URL("https://www.tokkobroker.com/api/v1/property/search/");
    searchUrl2.searchParams.append("key", team.tokko_api_key);
    searchUrl2.searchParams.append("format", "json");
    searchUrl2.searchParams.append("lang", "es_ar");
    searchUrl2.searchParams.append("data", JSON.stringify(searchData2));
    searchUrl2.searchParams.append("limit", "500");

    const searchResp2 = await fetch(searchUrl2.toString());
    const tokkoData2 = await searchResp2.json();
    const propertyBranch = tokkoData2.objects?.find((p: any) => p.reference_code === refCode);

    res.status(200).json({
      success: true,
      refCode,
      branchId: branch,
      search_all_branches: {
        found: !!propertyAnyBranch,
        status: propertyAnyBranch?.status,
        branch_id: propertyAnyBranch?.branch?.id,
        branch_name: propertyAnyBranch?.branch?.name,
        address: propertyAnyBranch?.address,
        producer: propertyAnyBranch?.producer?.name,
      },
      search_branch_filtered: {
        found: !!propertyBranch,
        status: propertyBranch?.status,
        branch_id: propertyBranch?.branch?.id,
        branch_name: propertyBranch?.branch?.name,
        address: propertyBranch?.address,
        producer: propertyBranch?.producer?.name,
      },
      analysis: {
        exists_in_tokko: !!propertyAnyBranch,
        is_reserved: propertyAnyBranch?.status === 3,
        is_in_target_branch: !!propertyBranch,
        why_not_syncing: propertyAnyBranch
          ? !propertyBranch
            ? `Existe en Tokko pero NO en rama ${branch} (está en rama ${propertyAnyBranch.branch?.id})`
            : propertyAnyBranch.status !== 3
            ? `Status no es reservada (status=${propertyAnyBranch.status})`
            : "Debería estar sincronizándose, revisar logs"
          : `NO EXISTE en Tokko con reference_code ${refCode}`,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
