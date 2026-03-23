import { NextApiRequest } from "next";
import { Session } from "next-auth";
import { parse } from "cookie";
import { isSuperAdmin } from "./adminGuard";
import { IMPERSONATE_COOKIE } from "../pages/api/impersonate";

/**
 * Returns the effective email for API calls.
 * If a super admin is impersonating a user, returns that user's email.
 * Otherwise returns the session user's email.
 */
export function getEffectiveEmail(
  req: NextApiRequest,
  session: Session | null
): string | null {
  const email = session?.user?.email;
  if (!email) return null;

  // Only super admins can impersonate
  if (isSuperAdmin(email)) {
    const cookies = parse(req.headers.cookie || "");
    const impersonating = cookies[IMPERSONATE_COOKIE];
    if (impersonating) return impersonating;
  }

  return email;
}
