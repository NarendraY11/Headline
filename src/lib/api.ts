import * as Sentry from "@sentry/react";
import { supabase } from "./supabase";

/**
 * Why a request failed.
 *  - `http`     server responded with a non-2xx status (see `status`).
 *  - `offline`  the browser reports no network connection.
 *  - `timeout`  our own AbortController fired after `timeoutMs`.
 *  - `aborted`  the caller's external signal aborted the request.
 *  - `network`  fetch rejected for another reason (DNS, CORS, connection reset).
 */
export type ApiFailureKind = "http" | "offline" | "timeout" | "aborted" | "network";

export interface ApiSuccess {
  ok: true;
  /** The successful (2xx) Response. */
  response: Response;
  status: number;
}

export interface ApiFailure {
  ok: false;
  /** Present for an `http` failure so callers can read the error body; null otherwise. */
  response: Response | null;
  /** HTTP status for `http` failures; null when no response was received. */
  status: number | null;
  kind: ApiFailureKind;
}

export type ApiResult = ApiSuccess | ApiFailure;

/**
 * Authenticated fetch wrapper.
 *
 * Returns a discriminated {@link ApiResult} instead of collapsing every failure
 * mode to `null`: callers can branch on `result.ok`, inspect `result.status`,
 * read the error body off `result.response` (for `http` failures), or
 * distinguish `offline`/`timeout` to show the right UI. Server errors (5xx) and
 * timeouts are reported to Sentry here so they're visible centrally; callers
 * don't need to capture again.
 *
 * @param path     API path.
 * @param options  Standard fetch options.
 * @param timeoutMs Abort after this many ms. Pass 0 to disable the timeout
 *                  entirely — required for streaming AI endpoints whose
 *                  responses can take much longer than a normal request.
 *                  Defaults to 30s (was 6s, which truncated AI streams).
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {},
  timeoutMs = 30000
): Promise<ApiResult> {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId =
    timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs)
      : null;
  const clear = () => {
    if (timeoutId) clearTimeout(timeoutId);
  };

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || "";

    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const { signal, ...restOptions } = options;

    if (signal) {
      // Chain an external abort signal into our controller.
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener("abort", () => controller.abort());
      }
    }

    const response = await fetch(path, {
      ...restOptions,
      headers,
      signal: controller.signal,
    });

    clear();

    if (!response.ok) {
      console.warn(`apiFetch received non-200 status ${response.status} for ${path}`);
      // Surface server-side faults (5xx) to Sentry; 4xx are client/expected
      // (auth, validation) and would just be noise.
      if (response.status >= 500) {
        Sentry.captureException(
          new Error(`apiFetch ${response.status} for ${path}`),
          { tags: { apiPath: path, apiStatus: String(response.status) } }
        );
      }
      return { ok: false, response, status: response.status, kind: "http" };
    }

    return { ok: true, response, status: response.status };
  } catch (err: any) {
    clear();

    // Our timeout fired.
    if (timedOut) {
      console.warn(`apiFetch timeout (${timeoutMs}ms) for ${path}`);
      Sentry.captureException(
        err instanceof Error ? err : new Error(`apiFetch timeout for ${path}`),
        { tags: { apiPath: path, apiFailure: "timeout" } }
      );
      return { ok: false, response: null, status: null, kind: "timeout" };
    }

    // Caller's external signal aborted us — expected, not an error to report.
    if (err?.name === "AbortError") {
      return { ok: false, response: null, status: null, kind: "aborted" };
    }

    // No connection — expected and recoverable; don't spam Sentry.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return { ok: false, response: null, status: null, kind: "offline" };
    }

    console.warn(`apiFetch network error for ${path}:`, err?.message || err);
    Sentry.captureException(
      err instanceof Error ? err : new Error(`apiFetch network error for ${path}`),
      { tags: { apiPath: path, apiFailure: "network" } }
    );
    return { ok: false, response: null, status: null, kind: "network" };
  }
}

/**
 * Like {@link apiFetch} but returns the Response for ANY HTTP status (including
 * 4xx/5xx) so the caller can read the server's error message body. Returns null
 * only on a network failure or timeout. Use this where surfacing the real error
 * to the user matters (e.g. payments).
 */
export async function apiFetchRaw(
  path: string,
  options: RequestInit = {},
  timeoutMs = 30000
): Promise<Response | null> {
  const controller = new AbortController();
  const timeoutId =
    timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const clear = () => {
    if (timeoutId) clearTimeout(timeoutId);
  };

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || "";

    const headers = new Headers(options.headers || {});
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const { signal, ...restOptions } = options;
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener("abort", () => controller.abort());
    }

    const response = await fetch(path, { ...restOptions, headers, signal: controller.signal });
    clear();
    return response;
  } catch (err: any) {
    clear();
    console.warn(`apiFetchRaw error/timeout for ${path}:`, err.message || err);
    return null;
  }
}

export function aiStreamErrorToast(
  showToast: (opts: { type: "success" | "error" | "info"; title: string; message: string; duration: number }) => void,
  response: Response | null,
  msg: string
): void {
  showToast({
    type: "error",
    title:
      response?.status === 429
        ? "Slow down"
        : response?.status === 403
        ? "Upgrade required"
        : "Service Offline",
    message: msg,
    duration: 5000,
  });
}

/** Best-effort extraction of an error message from a Response. */
// Infrastructure error patterns that must never appear in UI.
const INFRA_ERROR_RE = /FUNCTION_INVOCATION_FAILED|bom\d+::|iad\d+::|sin\d+::|sfo\d+::|A server error has occurred|Internal Server Error/i;

export async function readError(res: Response, fallback = "Request failed."): Promise<string> {
  try {
    const data = await res.clone().json();
    const msg: string = data?.error || data?.message || "";
    if (msg && !INFRA_ERROR_RE.test(msg)) return msg;
    return fallback;
  } catch {
    try {
      const text = (await res.text()).trim();
      // Never surface raw Vercel/infra error pages — return the fallback instead.
      if (!text || INFRA_ERROR_RE.test(text)) return fallback;
      // Cap length so even unexpected text doesn't flood the UI.
      return text.length <= 200 ? text : fallback;
    } catch {
      return fallback;
    }
  }
}
