import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';

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
      .select('name, picture, email')
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
      .select('name, id')
      .eq('id', profile.team_id)
      .single();

    // Obtener propiedades del agente desde tokko_properties
    let properties: TokkoProperty[] = [];
    try {
      // Buscar propiedades publicadas del agente por email
      const { data: tokkoProps, error: propsError } = await supabaseAdmin
        .from('tokko_properties')
        .select('id, tokko_id, title, address, price, currency, photos_count, status, days_since_update, producer_email, thumbnail')
        .eq('producer_email', profile.email)
        .eq('status', 2)  // Solo publicadas
        .order('days_since_update', { ascending: true });

      if (propsError) {
        console.error('Error fetching properties:', propsError);
      } else {
        // Construir URLs correctas para propiedades
        properties = (tokkoProps || []).map(prop => {
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
          
          const titleForSlug = prop.title || prop.address;
          const slug = slugify(titleForSlug);
          const propertyUrl = slug 
            ? `https://propiedades.galas.com.ar/p/${prop.tokko_id}-${slug}`
            : `https://propiedades.galas.com.ar/p/${prop.tokko_id}`;
          
          return { ...prop, propertyUrl };
        });
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
