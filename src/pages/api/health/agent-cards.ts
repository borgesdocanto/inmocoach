import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { ensureAgentPhotosBucket } from '@/lib/storageInit';

type HealthResponse = {
  status: 'healthy' | 'degraded' | 'error';
  database: {
    connected: boolean;
    agent_profiles_table: boolean;
  };
  storage: {
    agent_photos_bucket: boolean;
  };
  timestamp: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      status: 'error',
      database: { connected: false, agent_profiles_table: false },
      storage: { agent_photos_bucket: false },
      timestamp: new Date().toISOString(),
    });
  }

  const health: HealthResponse = {
    status: 'healthy',
    database: { connected: false, agent_profiles_table: false },
    storage: { agent_photos_bucket: false },
    timestamp: new Date().toISOString(),
  };

  // Check database
  try {
    const { data, error } = await supabaseAdmin
      .from('agent_profiles')
      .select('id')
      .limit(1);

    if (!error) {
      health.database.connected = true;
      health.database.agent_profiles_table = true;
    } else {
      health.status = 'degraded';
      console.error('[Health] Database error:', error.message);
    }
  } catch (err: any) {
    health.status = 'degraded';
    console.error('[Health] Database connection error:', err.message);
  }

  // Check storage bucket
  try {
    const bucketReady = await ensureAgentPhotosBucket();
    health.storage.agent_photos_bucket = bucketReady;
    
    if (!bucketReady) {
      health.status = 'degraded';
    }
  } catch (err: any) {
    health.status = 'degraded';
    console.error('[Health] Storage check error:', err.message);
  }

  // Determine overall status
  if (!health.database.connected || !health.storage.agent_photos_bucket) {
    health.status = health.status === 'error' ? 'error' : 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  return res.status(statusCode).json(health);
}
