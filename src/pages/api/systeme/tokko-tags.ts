// GET /api/systeme/tokko-tags
// Trae las tags de Tokko agrupadas por categoría
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getEffectiveEmail } from "../../../lib/impersonation";

interface TokkoTag {
  id: number;
  name: string;
  group?: string;
  category?: string;
  tag_group?: string;
  tag_type?: string;
}

export interface TagGroup {
  group: string;
  tags: string[];
}

// Detectar grupo por patrones cuando el API no devuelve categoría
function detectGroup(name: string): string {
  const n = name.toLowerCase();
  if (n.startsWith("argentina |") || n.startsWith("g.b.a") || n.includes("zona oeste") ||
      n.includes("zona norte") || n.includes("zona sur") || n.includes("capital federal") ||
      n.includes("ituzaingó") || n.includes("castelar") || n.includes("morón") ||
      n.includes("haedo") || n.includes("padua") || n.includes("merlo") ||
      n.includes("moreno") || n.includes("luján") || n.includes("san miguel") ||
      n.includes("villa") || n.includes("barrio") || n.includes("parque")) {
    return "Ubicación";
  }
  if (n.includes("alquiler") || n.includes("venta") || n.includes("temporal") ||
      n.includes("permuta") || n.includes("arrend")) {
    return "Tipo de operación";
  }
  if (n.includes("departamento") || n.includes("casa") || n.includes("duplex") ||
      n.includes("ph ") || n.includes("local") || n.includes("oficina") ||
      n.includes("terreno") || n.includes("lote") || n.includes("galpón") ||
      n.includes("cochera") || n.includes("deposito") || n.includes("campo") ||
      n.includes("edificio") || n.includes("complejo") || n.includes("condo") ||
      n.includes("propiedad") || n.includes("inmueble")) {
    return "Tipo de inmueble";
  }
  if (n.includes("propietario") || n.includes("vendedor") || n.includes("interesado") ||
      n.includes("comprador") || n.includes("inquilino") || n.includes("locatario") ||
      n.includes("inversor") || n.includes("posible") || n.includes("is_owner") ||
      n.includes("dueño")) {
    return "Perfil del contacto";
  }
  if (n.includes("activo") || n.includes("cerrado") || n.includes("perdido") ||
      n.includes("suspendido") || n.includes("solicita") || n.includes("crédito") ||
      n.includes("estado")) {
    return "Estado";
  }
  if (n.includes("whatsapp") || n.includes("instagram") || n.includes("facebook") ||
      n.includes("web") || n.includes("portal") || n.includes("zonaprop") ||
      n.includes("argenprop") || n.includes("mercado") || n.includes("redes") ||
      n.includes("referido") || n.includes("contacto por")) {
    return "Origen / Canal";
  }
  if (n.includes("galas") || n.includes("inmocoach") || n.includes("red tokko") ||
      n.includes("inmobiliaria")) {
    return "Inmobiliaria";
  }
  return "Otras";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });
  const email = getEffectiveEmail(req, session);

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, team_role")
    .eq("email", email)
    .single();

  if (!sub?.team_id) return res.status(403).json({ error: "Sin equipo" });
  if (sub.team_role !== "owner" && sub.team_role !== "team_leader") {
    return res.status(403).json({ error: "Sin permiso" });
  }

  // Integraciones: solo GALAS
  if (sub.team_id !== "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93") {
    return res.status(403).json({ error: "Feature no disponible" });
  }

  const { data: team } = await supabaseAdmin
    .from("teams")
    .select("tokko_api_key")
    .eq("id", sub.team_id)
    .single();

  if (!team?.tokko_api_key) return res.status(400).json({ error: "No hay API key de Tokko configurada" });

  try {
    const allTags: TokkoTag[] = [];
    let url: string | null = `https://tokkobroker.com/api/v1/contact_tag/?key=${team.tokko_api_key}&format=json`;

    while (url) {
      const r: Response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) return res.status(502).json({ error: `Tokko respondió con error ${r.status}` });
      const data = await r.json();
      const objects: TokkoTag[] = data?.objects ?? [];
      allTags.push(...objects);
      const next: string | undefined = data?.meta?.next;
      url = next ? `https://tokkobroker.com${next}` : null;
    }

    // Agrupar: usar campo nativo del API si existe, sino detectar por patrones
    const groupMap: Record<string, string[]> = {};

    for (const tag of allTags) {
      if (!tag.name?.trim()) continue;
      const name = tag.name.trim();
      // Intentar usar campo nativo de categoría
      const nativeGroup = tag.group || tag.category || tag.tag_group || tag.tag_type || "";
      const group = nativeGroup.trim() || detectGroup(name);

      if (!groupMap[group]) groupMap[group] = [];
      if (!groupMap[group].includes(name)) groupMap[group].push(name);
    }

    // Ordenar tags dentro de cada grupo y grupos entre sí
    // Grupos predefinidos primero, "Otras" siempre al final
    const ORDER = ["Ubicación", "Tipo de operación", "Tipo de inmueble", "Perfil del contacto", "Estado", "Origen / Canal", "Inmobiliaria"];
    const groups: TagGroup[] = Object.entries(groupMap)
      .map(([group, tags]) => ({ group, tags: tags.sort((a, b) => a.localeCompare(b, "es")) }))
      .sort((a, b) => {
        const ia = ORDER.indexOf(a.group);
        const ib = ORDER.indexOf(b.group);
        if (ia === -1 && ib === -1) return a.group === "Otras" ? 1 : b.group === "Otras" ? -1 : a.group.localeCompare(b.group, "es");
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });

    // Agregar al final grupo especial con campos booleanos de Tokko que se convierten en tags
    groups.push({
      group: "Campos especiales Tokko",
      tags: ["is_owner"],
    });

    return res.json({ groups, total: allTags.length });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return res.status(502).json({ error: `No se pudo conectar con Tokko: ${message}` });
  }
}
