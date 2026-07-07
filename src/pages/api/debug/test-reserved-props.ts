import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const apiKey = "44b438c60bbde9a6e02e62afda4ef2e86f15aa1d";

    console.log("🔄 Trayendo propiedades de Tokko...");

    let allProps: any[] = [];
    let nextUrl: string | null = `https://www.tokkobroker.com/api/v1/property/?key=${apiKey}&format=json&lang=es_ar&limit=500`;
    let pages = 0;

    while (nextUrl && pages < 20) {
      const r = await fetch(nextUrl);
      if (!r.ok) throw new Error(`Tokko ${r.status}`);
      const d: any = await r.json();
      const props = d.objects || [];
      console.log(`✓ Página ${pages + 1}: ${props.length} propiedades`);

      allProps = allProps.concat(props);
      pages++;
      nextUrl = d.meta?.next 
        ? `https://www.tokkobroker.com${d.meta.next}` 
        : null;
    }

    console.log(`✓ Total: ${allProps.length} propiedades`);

    // Contar por status
    const byStatus: Record<string, number> = {};
    allProps.forEach((p: any) => {
      const st = String(p.status || "null");
      byStatus[st] = (byStatus[st] || 0) + 1;
    });

    // Filtrar status=3
    const reserved = allProps.filter(
      (p: any) => p.status === 3 || p.status === "3"
    );

    res.status(200).json({
      success: true,
      summary: {
        total_properties: allProps.length,
        pages_fetched: pages,
        by_status: byStatus,
        reserved_count: reserved.length,
      },
      reserved_first_20: reserved.slice(0, 20).map((p: any) => ({
        id: p.id,
        address: p.address,
        reference_code: p.reference_code,
        status: p.status,
        producer_name: p.producer?.name,
        producer_email: p.producer?.email,
        branch: p.branch?.name,
        photos_count: (p.photos || []).length,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
