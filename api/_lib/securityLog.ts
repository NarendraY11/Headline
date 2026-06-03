// ---------------------------------------------------------------------------
// Structured security-event + audit logging for the serverless API layer.
//
// Two sinks, both written with the service-role client so they bypass RLS but
// remain append-only (the DB rejects UPDATE/DELETE even for service role):
//   * security_log — auth failures, authz denials, admin actions, payment
//     events, abuse, suspicious signals. Severity-tagged.
//   * audit_log    — who/when/old/new for sensitive data mutations done from
//     the API (DB triggers cover client/UI-driven changes separately).
//
// EVERY value going in is run through redact() so we never persist passwords,
// API keys, tokens, signatures, cookies, or card/SSN-shaped strings.
// All writes are best-effort: a logging failure must never break the request.
// ---------------------------------------------------------------------------
import type { VercelRequest } from "@vercel/node";
import { getSupabaseAdmin, getClientIdentity } from "./utils.js";

export type Severity = "info" | "warn" | "error" | "critical";

// Keys whose VALUES are always replaced wholesale, regardless of content.
const SENSITIVE_KEY_RE =
  /(pass(word|wd)?|secret|token|authorization|auth|cookie|session|api[-_]?key|access[-_]?key|service[-_]?role|signature|sign|ssn|card|cvv|pan)/i;

// Value-shaped secrets to mask even when they appear in a non-sensitive key
// (e.g. an error string that embedded a token). Keep the last 4 chars so logs
// stay correlatable: sk_live_51Hxx... -> sk_live_****yhT4.
const VALUE_PATTERNS: { re: RegExp; keep?: number }[] = [
  { re: /\b(sk|pk|rk|rzp)_(live|test)_[A-Za-z0-9]{6,}\b/g, keep: 4 }, // Stripe/Razorpay-style keys
  { re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g }, // JWT
  { re: /\bBearer\s+[A-Za-z0-9._-]{8,}\b/gi }, // bearer tokens
  { re: /\b(?:\d[ -]?){13,19}\b/g, keep: 4 }, // card numbers
  { re: /\b\d{3}-\d{2}-\d{4}\b/g }, // US SSN
];

const REDACTED = "[redacted]";
const MAX_STR = 2000; // cap any single string we persist

function maskMatch(match: string, keep?: number): string {
  if (keep && match.length > keep) {
    return `****${match.slice(-keep)}`;
  }
  return REDACTED;
}

export function redactString(input: string): string {
  let out = input.length > MAX_STR ? input.slice(0, MAX_STR) + "…" : input;
  for (const { re, keep } of VALUE_PATTERNS) {
    out = out.replace(re, (m) => maskMatch(m, keep));
  }
  return out;
}

// Deep-redacts an arbitrary value for safe persistence. Sensitive keys are
// dropped to [redacted]; remaining strings are scrubbed of value-shaped
// secrets. Cuts off at depth 6 to bound work on hostile nested input.
export function redact(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= 6) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY_RE.test(k) ? REDACTED : redact(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

export interface ReqMeta {
  ip: string;
  user_agent: string;
  route: string;
  http_method: string;
}

export function getReqMeta(req: VercelRequest): ReqMeta {
  const ua = req.headers["user-agent"];
  return {
    ip: getClientIdentity(req), // first X-Forwarded-For hop, else "anonymous"
    user_agent: (Array.isArray(ua) ? ua[0] : ua || "").slice(0, 500),
    route: String(req.url || "").split("?")[0].slice(0, 300),
    http_method: String(req.method || "").slice(0, 10),
  };
}

export interface SecurityEventInput {
  req?: VercelRequest;
  eventType: string;
  severity?: Severity;
  userId?: string | null;
  actorEmail?: string | null;
  statusCode?: number | null;
  metadata?: Record<string, unknown>;
}

// Records a security event. Never throws; logging must not break requests.
export async function logSecurityEvent(input: SecurityEventInput): Promise<void> {
  try {
    const meta = input.req ? getReqMeta(input.req) : null;
    await getSupabaseAdmin()
      .from("security_log")
      .insert({
        event_type: input.eventType.slice(0, 100),
        severity: input.severity ?? "info",
        user_id: input.userId ?? null,
        actor_email: input.actorEmail ?? null,
        ip: meta?.ip ?? null,
        user_agent: meta?.user_agent ?? null,
        route: meta?.route ?? null,
        http_method: meta?.http_method ?? null,
        status_code: input.statusCode ?? null,
        metadata: redact(input.metadata ?? {}),
      });
  } catch (e) {
    // Surface to runtime logs (redacted) but swallow — best effort.
    console.warn("[securityLog] event insert failed:", redactString(String((e as any)?.message ?? e)));
  }
}

export interface AuditInput {
  req?: VercelRequest;
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  tableName?: string | null;
  recordId?: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  sessionId?: string | null;
  source?: "ui" | "api" | "system" | "trigger";
  metadata?: Record<string, unknown>;
}

// Records an audit-trail entry for an API-driven sensitive-data change.
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    const meta = input.req ? getReqMeta(input.req) : null;
    await getSupabaseAdmin()
      .from("audit_log")
      .insert({
        actor_user_id: input.actorUserId ?? null,
        actor_email: input.actorEmail ?? null,
        action: input.action.slice(0, 100),
        table_name: input.tableName ?? null,
        record_id: input.recordId ? String(input.recordId).slice(0, 200) : null,
        old_value: input.oldValue ? redact(input.oldValue) : null,
        new_value: input.newValue ? redact(input.newValue) : null,
        ip: meta?.ip ?? null,
        session_id: input.sessionId ?? null,
        source: input.source ?? "api",
        metadata: redact(input.metadata ?? {}),
      });
  } catch (e) {
    console.warn("[securityLog] audit insert failed:", redactString(String((e as any)?.message ?? e)));
  }
}
