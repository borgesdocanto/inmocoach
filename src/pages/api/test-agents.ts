import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  return res.status(200).json({
    status: 'ok',
    message: 'Agent Cards endpoints are working',
    endpoints: {
      public_agents: '/api/agents',
      agent_profile: '/api/agents/[slug]',
      agent_config: '/config/agent-profile (requires auth)',
      public_directory: '/agents',
    },
    timestamp: new Date().toISOString(),
  });
}
