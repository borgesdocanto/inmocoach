import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';

type Agent = {
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
  branch_id: number | null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Agent[] | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const GALAS_TEAM_ID = 'bb61ed0d-96dd-4c45-ac9a-c72169bd0b93';

    // Traer agentes desde tokko_agents (que tiene fotos + todas las branches)
    const { data: tokkoAgents, error } = await supabaseAdmin
      .from('tokko_agents')
      .select(
        `
        id,
        name,
        email,
        picture,
        phone,
        branch_id,
        team_id,
        agent_profiles(
          slug,
          photo_url,
          bio,
          email_contact,
          instagram_url,
          linkedin_url,
          whatsapp_link,
          is_visible
        )
        `
      )
      .eq('team_id', GALAS_TEAM_ID)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching agents:', error);
      return res.status(500).json({ error: 'Failed to fetch agents' });
    }

    // Transformar datos - combinar tokko_agents + agent_profiles
    const agents: Agent[] = (tokkoAgents || [])
      .map((tokkoAgent: any) => {
        const profile = tokkoAgent.agent_profiles?.[0];
        
        return {
          id: tokkoAgent.id,
          email: tokkoAgent.email,
          name: tokkoAgent.name,
          slug: profile?.slug || tokkoAgent.email.split('@')[0],
          // Prioridad: foto subida manualmente > foto de Tokko
          photo_url: profile?.photo_url || tokkoAgent.picture,
          bio: profile?.bio || '',
          phone: tokkoAgent.phone || profile?.phone || '',
          email_contact: profile?.email_contact || tokkoAgent.email,
          instagram_url: profile?.instagram_url || '',
          linkedin_url: profile?.linkedin_url || '',
          whatsapp_link: profile?.whatsapp_link || '',
          team_id: tokkoAgent.team_id,
          branch_id: tokkoAgent.branch_id,
        };
      });

    return res.status(200).json(agents);
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
