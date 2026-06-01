import { supabase } from "./supabase";

/**
 * Authenticated fetch wrapper.
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
      return null;
    }

    return response;
  } catch (err: any) {
    clear();
    console.warn(`apiFetch error/timeout for ${path}:`, err.message || err);
    return null;
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

/** Best-effort extraction of an error message from a Response. */
export async function readError(res: Response, fallback = "Request failed."): Promise<string> {
  try {
    const data = await res.clone().json();
    return data?.error || data?.message || fallback;
  } catch {
    try {
      const text = await res.text();
      return text || fallback;
    } catch {
      return fallback;
    }
  }
}
