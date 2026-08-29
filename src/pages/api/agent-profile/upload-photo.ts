import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabase';
import { getEffectiveEmail } from '@/lib/impersonation';
import { IncomingForm, File } from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

type UploadResponse = {
  photo_url: string;
} | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse>
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const effectiveEmail = getEffectiveEmail(req, session);

  try {
    const form = new IncomingForm();
    const [fields, files] = await new Promise<[any, any]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const photoFile = files.photo as File | File[] | undefined;
    if (!photoFile || Array.isArray(photoFile)) {
      return res.status(400).json({ error: 'No photo file provided' });
    }

    // Validar que sea una imagen
    const mimeType = photoFile.mimetype || '';
    if (!mimeType.startsWith('image/')) {
      return res.status(400).json({ error: 'File must be an image' });
    }

    // Leer archivo
    const fileBuffer = fs.readFileSync(photoFile.filepath);
    const fileName = `agent-profiles/${effectiveEmail}-${Date.now()}.${photoFile.originalFilename?.split('.').pop() || 'jpg'}`;

    // Subir a Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from('agent-photos')
      .upload(fileName, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      console.error('Error uploading photo:', error);
      return res.status(500).json({ error: 'Failed to upload photo' });
    }

    // Obtener URL pública
    const { data: publicUrlData } = supabaseAdmin.storage
      .from('agent-photos')
      .getPublicUrl(fileName);

    const photoUrl = publicUrlData?.publicUrl;

    if (!photoUrl) {
      return res.status(500).json({ error: 'Failed to get public URL' });
    }

    // Actualizar perfil con nueva foto
    const { error: updateError } = await supabaseAdmin
      .from('agent_profiles')
      .update({ photo_url: photoUrl })
      .eq('email', effectiveEmail);

    if (updateError) {
      console.error('Error updating profile photo:', updateError);
      // No es crítico, seguimos
    }

    return res.status(200).json({ photo_url: photoUrl });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
