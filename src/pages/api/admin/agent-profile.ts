import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabase';
import { getEffectiveEmail } from '@/lib/impersonation';

type AdminProfileUpdateResponse = {
  success: boolean;
  profile?: any;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AdminProfileUpdateResponse>
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const effectiveEmail = getEffectiveEmail(req, session);
  const { agentEmail } = req.query;

  if (!agentEmail || typeof agentEmail !== 'string') {
    return res.status(400).json({ success: false, error: 'agentEmail is required' });
  }

  try {
    // Verificar que el broker/team leader tiene permiso para editar este agente
    const { data: editor } = await supabaseAdmin
      .from('subscriptions')
      .select('team_id, team_role')
      .eq('email', effectiveEmail)
      .single();

    if (!editor) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    // Obtener el team_id del agente a editar
    const { data: agent } = await supabaseAdmin
      .from('subscriptions')
      .select('team_id')
      .eq('email', agentEmail)
      .single();

    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    // Verificar permisos: owner puede editar a cualquiera, team_leader solo a su equipo
    if (
      editor.team_role !== 'owner' &&
      (editor.team_role !== 'team_leader' || editor.team_id !== agent.team_id)
    ) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const { bio, phone, email_contact, instagram_url, linkedin_url, whatsapp_link, slug, is_visible, photo_url } =
      req.body;

    const updateData: any = {};
    if (bio !== undefined) updateData.bio = bio;
    if (phone !== undefined) updateData.phone = phone;
    if (email_contact !== undefined) updateData.email_contact = email_contact;
    if (instagram_url !== undefined) updateData.instagram_url = instagram_url;
    if (linkedin_url !== undefined) updateData.linkedin_url = linkedin_url;
    if (whatsapp_link !== undefined) updateData.whatsapp_link = whatsapp_link;
    if (slug !== undefined) updateData.slug = slug;
    if (is_visible !== undefined) updateData.is_visible = is_visible;
    if (photo_url !== undefined) updateData.photo_url = photo_url;

    const { data, error } = await supabaseAdmin
      .from('agent_profiles')
      .update(updateData)
      .eq('email', agentEmail)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.status(200).json({ success: true, profile: data });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
