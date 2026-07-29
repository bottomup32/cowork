const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";
export const apiEndpoint = (path: string) => `${API_URL}${path}`;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(`API request failed (${status})`);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(apiEndpoint(path), { ...init, credentials: "include", headers });
  if (!response.ok) {
    let code = `HTTP_${response.status}`;
    try {
      const body: unknown = await response.json();
      if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
        code = body.error;
      }
    } catch {
      // Error bodies are deliberately not surfaced to callers.
    }
    throw new ApiError(response.status, code);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
