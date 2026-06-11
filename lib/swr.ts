// Shared SWR fetcher for all client-side GET reads.
// Centralizes the "Unauthorized -> /login" redirect that every page's
// hand-rolled loadData() used to repeat, and surfaces HTTP/payload errors
// to SWR's `error` so pages can render error UI.

export class FetchError extends Error {
  status: number;
  info: unknown;
  constructor(message: string, status: number, info: unknown) {
    super(message);
    this.name = "FetchError";
    this.status = status;
    this.info = info;
  }
}

export async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // non-JSON body — leave json null, handled below
  }

  // App-level auth signal: routes return { error: "Unauthorized" } with 200/401.
  const errCode =
    json && typeof json === "object" && "error" in json
      ? (json as { error?: unknown }).error
      : undefined;

  if (res.status === 401 || errCode === "Unauthorized") {
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new FetchError("Unauthorized", 401, json);
  }

  if (!res.ok) {
    throw new FetchError(`Request failed (${res.status})`, res.status, json);
  }

  return json as T;
}
