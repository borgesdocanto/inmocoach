import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const apiKey = "44b438c60bbde9a6e02e62afda4ef2e86f15aa1d";
    const searchAddress = req.query.address as string || "";

    console.log("🔄 Trayendo propiedades RESERVADAS (status=3) con payload correcto...");

    // Payload EXACTO del foro de Tokko - usando "undefined" como STRING
    const searchData = {
      with_custom_tags: [],
      current_localization_id: 0,
      current_localization_type: "country",
      price_from: 0,
      price_to: 999999999,
      operation_types: [1, 2, 3],
      property_types: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 24],
      currency: "ANY",
      filters: [],
      only_available: "undefined",      // STRING, no boolean
      only_reserved: "checked",          // STRING
      only_to_be_cotized: "undefined",   // STRING, no boolean
      only_not_available: "undefined",   // STRING, no boolean
    };

    const url = new URL("https://www.tokkobroker.com/api/v1/property/search/");
    url.searchParams.append("key", apiKey);
    url.searchParams.append("format", "json");
    url.searchParams.append("lang", "es_ar");
    url.searchParams.append("data", JSON.stringify(searchData));
    url.searchParams.append("limit", "500");

    console.log("🔄 Llamando API con payload documentado en foro de Tokko...");

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: `${response.status}: ${text}` });
    }

    const data = await response.json();
    let reserved = data.objects || [];

    console.log(`✅ Total traído: ${reserved.length} propiedades`);
    
    // Verificar status reales
    const statusCount: Record<number, number> = {};
    reserved.forEach((p: any) => {
      const st = p.status;
      statusCount[st] = (statusCount[st] || 0) + 1;
    });
    
    console.log(`Status encontrados:`, statusCount);

    if (searchAddress) {
      reserved = reserved.filter((p: any) => 
        p.address?.toLowerCase().includes(searchAddress.toLowerCase())
      );
    }

    res.status(200).json({
      success: true,
      count: reserved.length,
      status_breakdown: statusCount,
      total_in_api: data.meta?.total_count,
      first_20_reserved: reserved.slice(0, 20).map((p: any) => ({
        id: p.id,
        address: p.address,
        reference_code: p.reference_code,
        status: p.status,
        producer_name: p.producer?.name,
        producer_email: p.producer?.email,
        branch: p.branch?.name,
        photos_count: (p.photos || []).length,
        operation_type: p.type?.name,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
