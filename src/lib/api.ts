import { supabase } from "./supabase";

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 6000);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || "";

    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const { signal, ...restOptions } = options;

    let responseSignal = controller.signal;
    if (signal) {
      // If there's an external signal, make our timeout controller listen to its abort event
      signal.addEventListener("abort", () => {
        controller.abort();
      });
      if (signal.aborted) {
        controller.abort();
      }
    }

    const response = await fetch(path, {
      ...restOptions,
      headers,
      signal: responseSignal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`apiFetch received non-200 status ${response.status} for ${path}`);
      return null;
    }

    return response;
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn(`apiFetch error/timeout for ${path}:`, err.message || err);
    return null;
  }
}
