import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiFetch } from "./api";

describe("apiFetch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("includes credentials and preserves caller headers while adding JSON for a body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "u1" }), { status: 200, headers: { "content-type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/auth/login", { method: "POST", headers: { "X-Request-Id": "r1" }, body: JSON.stringify({ email: "a@b.com" }) });

    expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:4000/auth/login");
    expect(fetchMock.mock.calls[0][1].credentials).toBe("include");
    const headers = new Headers(fetchMock.mock.calls[0][1].headers);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-request-id")).toBe("r1");
  });

  it("overrides caller credentials so session cookies are always included", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "u1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/me", { credentials: "omit" });

    expect(fetchMock.mock.calls[0][1].credentials).toBe("include");
  });

  it("returns successful JSON and does not overwrite a caller content type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "u1", email: "a@b.com", displayName: "A" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch("/me", { headers: { "content-type": "text/plain" } })).resolves.toEqual({ id: "u1", email: "a@b.com", displayName: "A" });
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get("content-type")).toBe("text/plain");
  });

  it("returns undefined for a 204 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(apiFetch("/auth/logout", { method: "POST" })).resolves.toBeUndefined();
  });

  it("throws a safe ApiError with the response error code", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "INVALID_CREDENTIALS", detail: "secret" }), { status: 401 })));
    await expect(apiFetch("/me")).rejects.toMatchObject({ name: "ApiError", status: 401, code: "INVALID_CREDENTIALS" } satisfies Partial<ApiError>);
  });

  it("uses an HTTP status fallback code when an error payload has no error code", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad", { status: 503 })));
    await expect(apiFetch("/me")).rejects.toMatchObject({ status: 503, code: "HTTP_503" } satisfies Partial<ApiError>);
  });
});
