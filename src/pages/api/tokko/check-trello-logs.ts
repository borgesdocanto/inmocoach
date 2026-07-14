import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Intentar traer logs
    const { data: logs, error } = await supabaseAdmin
      .from("trello_sync_log")
      .select("*")
      .eq("team_id", "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93")
      .order("created_at", { ascending: false })
      .limit(20);

    // Contar total
    const { count } = await supabaseAdmin
      .from("trello_sync_log")
      .select("*", { count: "exact", head: true })
      .eq("team_id", "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93");

    res.status(200).json({
      success: true,
      table_exists: !error,
      error: error?.message || null,
      total_logs: count || 0,
      logs_retrieved: logs?.length || 0,
      latest_logs: logs || [],
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
