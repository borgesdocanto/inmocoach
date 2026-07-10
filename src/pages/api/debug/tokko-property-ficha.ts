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
    // Obtener email
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
      return res.status(401).json({ error: "Unauthorized - provide ?email=your@email.com" });
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
    const isAuthorized = (sub.team_role === "owner" || sub.team_role === "team_leader") && isGalasTeam;

    if (!isAuthorized) {
      return res.status(403).json({ error: "Forbidden - Not GALAS owner/team_leader" });
    }

    const { refCode } = req.query;
    if (!refCode || typeof refCode !== "string") {
      return res.status(400).json({ error: "Missing refCode query parameter" });
    }

    // Obtener Tokko API key
    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("tokko_api_key")
      .eq("id", sub.team_id)
      .single();

    if (!team?.tokko_api_key) {
      return res.status(400).json({ error: "No Tokko API key" });
    }

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

    const response = await fetch(searchUrl.toString());
    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: `Tokko error: ${response.status}` });
    }

    const data = await response.json();
    const prop = data.objects?.[0];

    if (!prop) {
      return res.status(404).json({ error: `Property ${refCode} not found` });
    }

    // Extraer y formatear datos principales
    const ficha = {
      "📌 PROPIEDAD": {
        "Referencia": prop.reference_code,
        "Dirección": prop.address,
        "Tipo": prop.type?.name,
        "Rama": prop.branch?.name,
        "Status": prop.status,
      },
      "💰 VALORES": {
        "Precio Operación": prop.operations?.[0]?.amount
          ? `${prop.operations[0].amount} ${prop.operations[0].currency}`
          : "N/A",
        "Precio de Reserva": prop.price_reserved
          ? `${prop.price_reserved}`
          : "No especificado",
        "Monto Operación": prop.amount_operation || "N/A",
      },
      "👥 PARTES": {
        "Propietario": prop.owner?.name || prop.owner?.email || "No asignado",
        "Propietario Email": prop.owner?.email || "N/A",
        "Propietario Teléfono": prop.owner?.phone || "N/A",
        "Comprador": prop.client?.name || prop.client?.email || "No asignado",
        "Comprador Email": prop.client?.email || "N/A",
        "Comprador Teléfono": prop.client?.phone || "N/A",
      },
      "👤 AGENTES": {
        "Producer (Captación)": prop.producer?.name || "N/A",
        "Producer Email": prop.producer?.email || "N/A",
        "Producer Teléfono": prop.producer?.cellphone || prop.producer?.phone || "N/A",
        "Creado Por": prop.created_by?.name || prop.created_by?.email || "N/A",
      },
      "📅 FECHAS": {
        "Fecha Creación": prop.creation_date || prop.created_at || "N/A",
        "Fecha Reserva": prop.reservation_date || "N/A",
        "Fecha Firma Estimada": prop.signature_date_estimated || "N/A",
      },
      "🏢 ESCRIBANÍA": {
        "Escribanía": prop.notary?.name || "No asignada",
        "Escribanía Email": prop.notary?.email || "N/A",
        "Escribanía Teléfono": prop.notary?.phone || "N/A",
      },
      "🏦 BANCO": {
        "Banco": prop.bank?.name || "No asignado",
        "Banco Email": prop.bank?.email || "N/A",
        "Banco Teléfono": prop.bank?.phone || "N/A",
      },
      "📝 DATOS ADICIONALES": {
        "Duración Reserva": prop.reservation_duration || "15 días",
        "Fotos": prop.photos?.length || 0,
        "Descripción": prop.description?.substring(0, 100) || "N/A",
      },
    };

    res.status(200).json({
      message: `FICHA COMPLETA DE ${refCode}`,
      ficha,
      raw: prop,
    });
  } catch (error: any) {
    console.error("[tokko-property-ficha] Error:", error);
    res.status(500).json({ error: error.message });
  }
}
