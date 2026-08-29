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
  team_role: 'owner' | 'team_leader' | 'member';
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

    // Traer agentes desde tokko_agents CON branch_id
    const { data: tokkoAgents, error: tokkoError } = await supabaseAdmin
      .from('tokko_agents')
      .select('*')
      .eq('team_id', GALAS_TEAM_ID)
      .not('branch_id', 'is', null);  // Solo agentes con branch asignado

    if (tokkoError) {
      console.error('Error fetching tokko_agents:', tokkoError);
      return res.status(500).json({ error: 'Failed to fetch agents' });
    }

    // Traer SOLO agentes con is_visible=true
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('agent_profiles')
      .select('*')
      .eq('team_id', GALAS_TEAM_ID)
      .eq('is_visible', true);  // SOLO AGENTES VISIBLES

    if (profileError) {
      console.error('Error fetching agent_profiles:', profileError);
      return res.status(500).json({ error: 'Failed to fetch profiles' });
    }

    // Obtener solo los emails de agentes visibles
    const visibleEmails = new Set((profiles || []).map((p: any) => p.email));

    // Traer roles y status de subscriptions - SOLO ACTIVOS
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('email, team_role, status')
      .eq('team_id', GALAS_TEAM_ID)
      .eq('status', 'active');  // SOLO agentes con status active

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      return res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }

    // Crear mapas para búsquedas rápidas
    const profileMap = new Map((profiles || []).map((p: any) => [p.email, p]));
    const roleMap = new Map((subscriptions || []).map((s: any) => [s.email, s.team_role]));
    const activeEmails = new Set((subscriptions || []).map((s: any) => s.email));

    // Transformar datos - combinar tokko_agents + agent_profiles + roles
    // Filtrar solo agentes que estén VISIBLE en agent_profiles Y ACTIVOS en subscriptions
    const agents: Agent[] = (tokkoAgents || [])
      .filter((tokkoAgent: any) => visibleEmails.has(tokkoAgent.email) && activeEmails.has(tokkoAgent.email))
      .map((tokkoAgent: any) => {
        const profile = profileMap.get(tokkoAgent.email);
        const role = roleMap.get(tokkoAgent.email) || 'member';

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
          branch_id: Number(tokkoAgent.branch_id),  // Asegurar que es número
          team_role: role,
        };
      })
      // Ordenar: owner primero, luego team_leader, luego members por nombre
      .sort((a, b) => {
        const roleOrder: Record<string, number> = { owner: 0, team_leader: 1, member: 2 };
        const roleA = roleOrder[a.team_role] ?? 2;
        const roleB = roleOrder[b.team_role] ?? 2;

        if (roleA !== roleB) return roleA - roleB;
        return a.name.localeCompare(b.name);
      });

    return res.status(200).json(agents);
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
