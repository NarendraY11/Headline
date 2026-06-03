// Fire-and-forget client breadcrumb for auth attempts. The server endpoint
// (/api/auth-event) stamps IP / user-agent / timestamp and writes the durable
// security_log row. Never send the password — only the email and outcome.
export type AuthEventType =
  | "login_success"
  | "login_failed"
  | "signup"
  | "password_reset_requested"
  | "logout";

export function logAuthEvent(
  type: AuthEventType,
  email?: string,
  provider?: string
): void {
  try {
    const body = JSON.stringify({ type, email, provider });
    // No auth header: a failed login has no session. keepalive lets the beacon
    // survive a navigation (e.g. redirect right after login).
    fetch("/api/auth-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* best-effort only */
  }
}
