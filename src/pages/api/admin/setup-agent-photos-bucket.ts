import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { requireSuperAdmin } from '@/lib/adminGuard';
import { supabaseAdmin } from '@/lib/supabase';

type Response = {
  success: boolean;
  message?: string;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Response>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  
  try {
    // Verificar super admin
    requireSuperAdmin(session);
  } catch (error: any) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  try {
    // Intentar crear bucket agent-photos
    const { data, error } = await supabaseAdmin.storage.createBucket(
      'agent-photos',
      {
        public: true,
        allowedMimeTypes: [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
        ],
        fileSizeLimit: 5242880, // 5MB
      }
    );

    if (error) {
      // Si el bucket ya existe, no es error
      if (error.message?.includes('already exists')) {
        return res.status(200).json({
          success: true,
          message: 'Bucket agent-photos ya existe',
        });
      }

      console.error('Error creating bucket:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to create bucket',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Bucket agent-photos creado exitosamente',
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}
