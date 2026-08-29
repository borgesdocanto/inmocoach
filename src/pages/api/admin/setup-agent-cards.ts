import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { requireSuperAdmin } from '@/lib/adminGuard';
import { supabaseAdmin } from '@/lib/supabase';
import { ensureAgentPhotosBucket } from '@/lib/storageInit';

type SetupResponse = {
  success: boolean;
  steps: {
    database_table: { status: string; message?: string };
    database_records: { status: string; message?: string };
    storage_bucket: { status: string; message?: string };
  };
  summary: string;
  timestamp: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SetupResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);

  try {
    requireSuperAdmin(session);
  } catch (error: any) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const response: SetupResponse = {
    success: false,
    steps: {
      database_table: { status: 'pending' },
      database_records: { status: 'pending' },
      storage_bucket: { status: 'pending' },
    },
    summary: '',
    timestamp: new Date().toISOString(),
  };

  // Step 1: Verificar tabla
  try {
    const { data, error } = await supabaseAdmin
      .from('agent_profiles')
      .select('count', { count: 'exact' });

    if (error) {
      response.steps.database_table = {
        status: 'error',
        message: error.message,
      };
    } else {
      response.steps.database_table = {
        status: 'ok',
        message: 'Tabla agent_profiles existe',
      };
    }
  } catch (err: any) {
    response.steps.database_table = {
      status: 'error',
      message: err.message,
    };
  }

  // Step 2: Verificar records
  try {
    const { data, error } = await supabaseAdmin
      .from('agent_profiles')
      .select('email', { count: 'exact' })
      .eq('team_id', 'bb61ed0d-96dd-4c45-ac9a-c72169bd0b93');

    if (error) {
      response.steps.database_records = {
        status: 'error',
        message: error.message,
      };
    } else {
      const count = Array.isArray(data) ? data.length : 0;
      response.steps.database_records = {
        status: 'ok',
        message: `${count} perfiles en equipo GALAS`,
      };
    }
  } catch (err: any) {
    response.steps.database_records = {
      status: 'error',
      message: err.message,
    };
  }

  // Step 3: Crear bucket si no existe
  try {
    const bucketReady = await ensureAgentPhotosBucket();
    response.steps.storage_bucket = {
      status: bucketReady ? 'ok' : 'error',
      message: bucketReady
        ? 'Bucket agent-photos listo'
        : 'No se pudo crear/verificar bucket',
    };
  } catch (err: any) {
    response.steps.storage_bucket = {
      status: 'error',
      message: err.message,
    };
  }

  // Determinar éxito
  const allOk = Object.values(response.steps).every(s => s.status === 'ok');
  response.success = allOk;
  response.summary = allOk
    ? '✅ Agent Cards está completamente configurado'
    : '⚠️ Algunos componentes necesitan atención';

  const statusCode = allOk ? 200 : 206;
  return res.status(statusCode).json(response);
}
