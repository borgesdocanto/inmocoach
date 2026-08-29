import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';

type Agent = {
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Agent[] | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { branch_id, team_id } = req.query;

    let query = supabaseAdmin
      .from('agent_profiles')
      .select('*')
      .eq('is_visible', true);

    // Filtrar por team_id si se proporciona
    if (team_id) {
      query = query.eq('team_id', team_id);
    }

    // Filtrar por rama si se proporciona
    if (branch_id) {
      // Necesitamos hacer un join con subscriptions para obtener branch_id
      // Por ahora, asumimos que el filtro se hace en el cliente
      // TODO: agregar branch_id a agent_profiles para queries más eficientes
    }

    const { data, error } = await query.order('slug', { ascending: true });

    if (error) {
      console.error('Error fetching agents:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data || []);
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
