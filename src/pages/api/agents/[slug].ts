import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';

type AgentProfile = {
  id: string;
  email: string;
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
  address: string;
  price: number;
  currency: string;
  photos_count: number;
  status: number;
  days_since_update: number;
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

    // Obtener perfil del agente
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('agent_profiles')
      .select('*')
      .eq('slug', slug)
      .eq('is_visible', true)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Obtener datos del equipo
    const { data: teamData } = await supabaseAdmin
      .from('teams')
      .select('name, id')
      .eq('id', profile.team_id)
      .single();

    // Obtener propiedades del agente desde Tokko
    let properties: TokkoProperty[] = [];
    try {
      // Necesitamos obtener el API key del equipo
      const { data: subscription } = await supabaseAdmin
        .from('subscriptions')
        .select('team_id')
        .eq('email', profile.email)
        .single();

      if (subscription) {
        const { data: team } = await supabaseAdmin
          .from('teams')
          .select('tokko_api_key')
          .eq('id', subscription.team_id)
          .single();

        if (team?.tokko_api_key) {
          // Obtener propiedades asociadas al email del agente
          const { data: tokkoProps } = await supabaseAdmin
            .from('tokko_properties')
            .select('*')
            .eq('producer_email', profile.email)
            .eq('status', 2)  // Solo publicadas
            .order('days_since_update', { ascending: true });

          properties = tokkoProps || [];
        }
      }
    } catch (err) {
      console.error('Error fetching properties:', err);
      // Si falla, devolvemos el perfil sin propiedades
    }

    return res.status(200).json({
      profile,
      properties,
      team_name: teamData?.name,
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
