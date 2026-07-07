import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../lib/supabase";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Solo GALAS (super admin)
    if (req.query.admin !== "galas") {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Traer API key de GALAS
    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("tokko_api_key")
      .eq("id", "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93")
      .single();

    if (!team?.tokko_api_key) {
      return res.status(400).json({ error: "No API key found" });
    }

    // Traer TODAS las propiedades
    let allProps: any[] = [];
    let nextUrl: string | null = `https://www.tokkobroker.com/api/v1/property/?key=${team.tokko_api_key}&format=json&lang=es_ar&limit=500`;
    
    while (nextUrl) {
      const r = await fetch(nextUrl);
      if (!r.ok) throw new Error(`Tokko ${r.status}`);
      const d: any = await r.json();
      allProps = allProps.concat(d.objects || []);
      nextUrl = d.meta?.next 
        ? `https://www.tokkobroker.com${d.meta.next}` 
        : null;
    }

    // Filtrar por status=3 (reservadas)
    const reserved = allProps.filter(
      (p: any) => p.status === 3 || p.status === "3"
    );

    res.status(200).json({
      success: true,
      summary: {
        total_properties: allProps.length,
        status_2_published: allProps.filter(
          (p: any) => p.status === 2 || p.status === "2"
        ).length,
        status_3_reserved: reserved.length,
      },
      reserved_properties: reserved.slice(0, 50).map((p: any) => ({
        id: p.id,
        address: p.address,
        reference_code: p.reference_code,
        status: p.status,
        producer: p.producer?.name,
        producer_email: p.producer?.email,
        photos: (p.photos || []).length,
        branch: p.branch?.name,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
