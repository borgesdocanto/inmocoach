import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';

// Cache simple para fotos de propiedades de Tokko (5 min TTL)
const photoCache = new Map<string, { [key: number]: string; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

async function getTokkoPropertyPhotos(apiKey: string, teamId: string): Promise<{ [key: number]: string }> {
  const cacheKey = `photos:${teamId}`;
  const cached = photoCache.get(cacheKey);
  
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    // Retornar copia sin timestamp
    const { ts, ...photos } = cached;
    return photos;
  }

  try {
    const photos: { [key: number]: string } = {};
    let nextUrl: string | null = 
      `https://www.tokkobroker.com/api/v1/property/?key=${apiKey}&format=json&lang=es_ar&limit=500`;
    
    while (nextUrl) {
      const r = await fetch(nextUrl, { signal: AbortSignal.timeout(10000) });
      if (!r.ok) throw new Error(`Tokko ${r.status}`);
      const d: any = await r.json();
      
      for (const prop of d.objects || []) {
        if (!photos[prop.id] && prop.photos?.length) {
          const firstPhoto = prop.photos.find((p: any) => !p.is_blueprint);
          if (firstPhoto?.thumb || firstPhoto?.url) {
            photos[prop.id] = firstPhoto.url || firstPhoto.thumb;
          }
        }
      }
      
      nextUrl = d.meta?.next ? `https://www.tokkobroker.com${d.meta.next}` : null;
    }
    
    photoCache.set(cacheKey, { ...photos, ts: Date.now() });
    return photos;
  } catch (err: any) {
    console.error('Error fetching Tokko photos:', err?.message);
    return {};
  }
}

type AgentProfile = {
  id: string;
  email: string;
  name: string;
  slug: string;
  photo_url: string | null;
  bio: string;
  phone: string;
  email_contact: string;
  instagram_url: string;
  linkedin_url: string;
  whatsapp_link: string;
  team_id: string;
};

type TokkoProperty = {
  id: string;
  tokko_id: number;
  title: string | null;
  address: string;
  price: number | null;
  currency: string;
  photos_count: number;
  status: number;
  days_since_update: number;
  producer_email: string;
  thumbnail?: string | null;
  propertyUrl?: string;
  photoUrl?: string;
  [key: string]: any;
};

type AgentCardResponse = {
  profile: AgentProfile;
  properties: TokkoProperty[];
  team_name?: string;
  broker_website?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AgentCardResponse | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { slug } = req.query;

    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({ error: 'slug is required' });
    }

    // Obtener perfil del agente desde agent_profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('agent_profiles')
      .select('*')
      .eq('slug', slug)
      .eq('is_visible', true)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Obtener datos del agente desde Tokko para nombre y foto fallback
    const { data: tokkoAgent } = await supabaseAdmin
      .from('tokko_agents')
      .select('name, picture, email, tokko_id')
      .eq('email', profile.email)
      .single();

    // Combinar: perfil + datos de Tokko
    const enrichedProfile: AgentProfile = {
      ...profile,
      name: profile.name || tokkoAgent?.name || profile.email.split('@')[0],
      photo_url: profile.photo_url || tokkoAgent?.picture || null,
    };

    // Obtener datos del equipo
    const { data: teamData } = await supabaseAdmin
      .from('teams')
      .select('name, id, tokko_api_key')
      .eq('id', profile.team_id)
      .single();

    // Obtener fotos de Tokko (con cache)
    let tokkoPhotos: { [key: number]: string } = {};
    if (teamData?.tokko_api_key) {
      tokkoPhotos = await getTokkoPropertyPhotos(teamData.tokko_api_key, profile.team_id);
    }

    // Obtener propiedades del agente DIRECTO de Tokko API (más completo que Supabase sync)
    let properties: TokkoProperty[] = [];
    try {
      if (teamData?.tokko_api_key) {
        // Fetch directo de Tokko para obtener TODAS las propiedades (no solo las sincronizadas)
        let allTokkoProps: any[] = [];
        let nextUrl: string | null = 
          `https://www.tokkobroker.com/api/v1/property/?key=${teamData.tokko_api_key}&format=json&limit=500&lang=es_ar`;
        
        while (nextUrl) {
          const r = await fetch(nextUrl, { signal: AbortSignal.timeout(10000) });
          if (!r.ok) throw new Error(`Tokko ${r.status}`);
          const d: any = await r.json();
          allTokkoProps = allTokkoProps.concat(d.objects || []);
          nextUrl = d.meta?.next ? `https://www.tokkobroker.com${d.meta.next}` : null;
        }

        // Filtrar propiedades de este agente
        const agentTokkoId = tokkoAgent?.tokko_id;
        const agentProps = agentTokkoId
          ? allTokkoProps.filter((p: any) => p.producer?.id === agentTokkoId)
          : [];

        // Construir URLs correctas para propiedades
        properties = (agentProps || []).map((prop: any) => {
          // Slugify: convertir "Casa en Venta en..." a "Casa-en-Venta-en-..."
          const slugify = (text: string) => {
            return text
              .toLowerCase()
              .replace(/[áéíóú]/g, a => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' }[a] || a))
              .replace(/\s+/g, '-')
              .replace(/[^a-z0-9-]/g, '')
              .replace(/-+/g, '-')
              .replace(/^-|-$/g, '');
          };
          
          const titleForSlug = prop.publication_title || prop.address;
          const slug = slugify(titleForSlug);
          const propertyUrl = slug 
            ? `https://propiedades.galas.com.ar/p/${prop.id}-${slug}`
            : `https://propiedades.galas.com.ar/p/${prop.id}`;
          
          // Obtener foto desde Tokko (primera foto no blueprint)
          const firstPhoto = (prop.photos || []).find((p: any) => !p.is_blueprint);
          const photoUrl = firstPhoto?.url || firstPhoto?.thumb;
          
          return {
            id: String(prop.id),
            tokko_id: prop.id,
            title: prop.publication_title,
            address: prop.address,
            price: prop.operations?.[0]?.prices?.[0]?.price || null,
            currency: prop.operations?.[0]?.prices?.[0]?.currency || null,
            photos_count: (prop.photos || []).filter((p: any) => !p.is_blueprint).length,
            status: prop.status,
            days_since_update: null,
            producer_email: prop.producer?.email,
            propertyUrl,
            photoUrl
          } as any;
        }) as TokkoProperty[];
      }
    } catch (err) {
      console.error('Error in properties fetch:', err);
      // Si falla, devolvemos el perfil sin propiedades
    }

    return res.status(200).json({
      profile: enrichedProfile,
      properties,
      team_name: teamData?.name,
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
