import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { getEffectiveEmail } from '@/lib/impersonation';

type ProfileResponse = {
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
  is_visible: boolean;
  team_id: string;
} | { error: string };

// Función para normalizar slug
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProfileResponse | { error: string }>
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const effectiveEmail = getEffectiveEmail(req, session);

  try {
    if (req.method === 'GET') {
      // Obtener perfil actual del agente
      const { data, error } = await supabaseAdmin
        .from('agent_profiles')
        .select('*')
        .eq('email', effectiveEmail)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No existe, crear uno por defecto
          const { data: subscription } = await supabaseAdmin
            .from('subscriptions')
            .select('name, team_id, email')
            .eq('email', effectiveEmail)
            .single();

          if (!subscription) {
            return res.status(404).json({ error: 'User not found' });
          }

          // Crear slug por defecto
          const defaultSlug = generateSlug(subscription.name || effectiveEmail);

          const { data: newProfile, error: createError } = await supabaseAdmin
            .from('agent_profiles')
            .insert({
              email: effectiveEmail,
              team_id: subscription.team_id,
              slug: defaultSlug,
              bio: `Agente inmobiliario en ${subscription.name}`,
              email_contact: effectiveEmail,
            })
            .select()
            .single();

          if (createError) {
            console.error('Error creating profile:', createError);
            return res.status(500).json({ error: 'Failed to create profile' });
          }

          return res.status(200).json(newProfile);
        }
        console.error('Error fetching profile:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json(data);
    }

    if (req.method === 'PUT') {
      // Actualizar perfil
      const {
        bio,
        phone,
        email_contact,
        instagram_url,
        linkedin_url,
        whatsapp_link,
        slug,
        is_visible,
        photo_url,
      } = req.body;

      // Validar que al menos exista un perfil
      const { data: existingProfile } = await supabaseAdmin
        .from('agent_profiles')
        .select('id')
        .eq('email', effectiveEmail)
        .single();

      if (!existingProfile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      // Si se proporciona nuevo slug, validar unicidad
      let finalSlug = slug;
      if (slug) {
        const normalized = generateSlug(slug);
        const { data: existingSlug } = await supabaseAdmin
          .from('agent_profiles')
          .select('id')
          .eq('slug', normalized)
          .neq('email', effectiveEmail)
          .single();

        if (existingSlug) {
          return res.status(400).json({ error: 'Slug already in use' });
        }

        finalSlug = normalized;
      }

      const updateData: any = {};
      if (bio !== undefined) updateData.bio = bio;
      if (phone !== undefined) updateData.phone = phone;
      if (email_contact !== undefined) updateData.email_contact = email_contact;
      if (instagram_url !== undefined) updateData.instagram_url = instagram_url;
      if (linkedin_url !== undefined) updateData.linkedin_url = linkedin_url;
      if (whatsapp_link !== undefined) updateData.whatsapp_link = whatsapp_link;
      if (finalSlug !== undefined) updateData.slug = finalSlug;
      if (is_visible !== undefined) updateData.is_visible = is_visible;
      if (photo_url !== undefined) updateData.photo_url = photo_url;

      const { data, error } = await supabaseAdmin
        .from('agent_profiles')
        .update(updateData)
        .eq('email', effectiveEmail)
        .select()
        .single();

      if (error) {
        console.error('Error updating profile:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
