// ---------------------------------------------------------------------------
// Universal permission guard for the serverless API layer.
//
// One call does all four things requested:
//   1. authenticate (401 if no/!valid token — handled by getAuthenticatedUser,
//      which also logs auth.failed),
//   2. run a caller-supplied authorizer against THIS request's resource,
//   3. return 401 if unauthenticated, 403 if unauthorized,
//   4. log every denied attempt to security_log (event authz.denied) for the
//      alert sweep + audit.
//
// Usage in any handler:
//   const user = await authorizeRequest(req, res, {
//     action: "admin.broadcast",
//     authorize: requireAdmin,
//   });
//   if (!user) return; // 401/403 already written + logged
//
// Authorizers compose: `all(requirePro, requireSelf(...))`.
// ---------------------------------------------------------------------------
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { User } from "@supabase/supabase-js";
import { getAuthenticatedUser, getSupabaseAdmin, isProUser } from "./utils.js";
import { logSecurityEvent, type Severity } from "./securityLog.js";

export interface AuthzContext {
  user: User;
  req: VercelRequest;
}

// An authorizer returns true (allow), false (deny, 403), or a structured
// denial letting it set the status/message/log severity.
export type AuthzResult =
  | boolean
  | { ok: boolean; reason?: string; status?: number; message?: string; severity?: Severity };

export type Authorizer = (ctx: AuthzContext) => Promise<AuthzResult> | AuthzResult;

function normalize(result: AuthzResult) {
  if (typeof result === "boolean") return { ok: result };
  return result;
}

export interface AuthorizeOptions {
  // Stable identifier for the action, used in the authz.denied log + alerts.
  action: string;
  // Resource authorizer. Omit for "any authenticated user".
  authorize?: Authorizer;
}

// Returns the authenticated+authorized user, or null after writing the proper
// 401/403 response (and logging the denial). Callers just `if (!user) return;`.
export async function authorizeRequest(
  req: VercelRequest,
  res: VercelResponse,
  opts: AuthorizeOptions
): Promise<User | null> {
  // (1) Authenticate. getAuthenticatedUser writes 401 + logs auth.failed.
  const user = await getAuthenticatedUser(req, res);
  if (!user) return null;

  // (2) Authorize against this specific resource.
  if (opts.authorize) {
    const norm = normalize(await opts.authorize({ user, req }));
    if (!norm.ok) {
      const status = norm.status ?? 403;
      // (4) Log the denied attempt for monitoring/alerting.
      void logSecurityEvent({
        req,
        eventType: "authz.denied",
        severity: norm.severity ?? "warn",
        userId: user.id,
        actorEmail: user.email,
        statusCode: status,
        metadata: { action: opts.action, reason: norm.reason ?? "unauthorized" },
      });
      // (3) 403 (or caller-chosen status) for an authenticated-but-unauthorized user.
      res.status(status).json({
        error: norm.message ?? "Forbidden: you do not have access to this resource.",
      });
      return null;
    }
  }

  return user;
}

// ---------------------------------------------------------------------------
// Reusable authorizers
// ---------------------------------------------------------------------------

// Caller must be in the admins roster.
export const requireAdmin: Authorizer = async ({ user }) => {
  const { data } = await getSupabaseAdmin()
    .from("admins")
    .select("email")
    .eq("email", user.email)
    .maybeSingle();
  return data ? true : { ok: false, reason: "not_admin", message: "Admins only." };
};

// Caller must hold an active Pro/Trial/lifetime plan.
export const requirePro: Authorizer = async ({ user }) =>
  (await isProUser(user.id))
    ? true
    : {
        ok: false,
        reason: "pro_required",
        severity: "info",
        message: "Access denied. Pro or active Trial subscription required.",
      };

// Caller must own the resource. `getOwnerId` extracts the resource owner's
// user id from the request (body/query/db lookup); access is allowed only when
// it equals the caller's id. This is the per-resource authorization hook.
export function requireSelf(
  getOwnerId: (ctx: AuthzContext) => string | undefined | null | Promise<string | undefined | null>
): Authorizer {
  return async (ctx) => {
    const ownerId = await getOwnerId(ctx);
    return ownerId && ownerId === ctx.user.id
      ? true
      : { ok: false, reason: "not_owner" };
  };
}

// Compose authorizers with AND semantics: every one must pass. The first
// failure is returned (so its reason/status/message wins).
export function all(...authorizers: Authorizer[]): Authorizer {
  return async (ctx) => {
    for (const authz of authorizers) {
      const norm = normalize(await authz(ctx));
      if (!norm.ok) return norm;
    }
    return true;
  };
}
