import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { apiFetch, ApiError } = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error { constructor(public status: number, public code: string) { super(); } },
}));
vi.mock("./api", () => ({
  ApiError,
  apiFetch,
}));

import { SessionProvider, useSession } from "./session";

function Probe() {
  const { loading, user, error, logout, refresh } = useSession();
  return <><p>{loading ? "loading" : user?.email ?? "guest"}</p><p>{error ? "error" : "ok"}</p><button onClick={() => void logout()}>logout</button><button onClick={() => void refresh()}>refresh</button></>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

describe("SessionProvider", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("uses the direct user response from /me", async () => {
    apiFetch.mockResolvedValueOnce({ id: "u1", email: "member@cowork.test", displayName: "Member" });
    render(<SessionProvider><Probe /></SessionProvider>);
    expect(await screen.findByText("member@cowork.test")).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith("/me");
  });

  it("treats a 401 as an unauthenticated session", async () => {
    apiFetch.mockRejectedValueOnce(new ApiError(401, "UNAUTHENTICATED"));
    render(<SessionProvider><Probe /></SessionProvider>);
    expect(await screen.findByText("guest")).toBeInTheDocument();
    expect(screen.getByText("ok")).toBeInTheDocument();
  });

  it("exposes a recoverable error state for a non-401 session failure", async () => {
    apiFetch.mockRejectedValueOnce(new ApiError(503, "HTTP_503"));
    render(<SessionProvider><Probe /></SessionProvider>);
    expect(await screen.findByText("guest")).toBeInTheDocument();
    expect(screen.getByText("error")).toBeInTheDocument();
  });

  it("posts logout and clears the current user", async () => {
    apiFetch.mockResolvedValueOnce({ id: "u1", email: "member@cowork.test", displayName: "Member" }).mockResolvedValueOnce(undefined);
    render(<SessionProvider><Probe /></SessionProvider>);
    await screen.findByText("member@cowork.test");
    screen.getByRole("button", { name: "logout" }).click();
    screen.getByRole("button", { name: "logout" }).click();
    await waitFor(() => expect(screen.getByText("guest")).toBeInTheDocument());
    expect(apiFetch).toHaveBeenLastCalledWith("/auth/logout", { method: "POST" });
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it("fences refreshes while logout is pending and ignores stale requests", async () => {
    const loggedOut = deferred<void>();
    const staleMe = deferred<{ id: string; email: string; displayName: string }>();
    apiFetch.mockResolvedValueOnce({ id: "u1", email: "member@cowork.test", displayName: "Member" })
      .mockImplementationOnce(() => loggedOut.promise)
      .mockImplementationOnce(() => staleMe.promise);
    render(<SessionProvider><Probe /></SessionProvider>);
    await screen.findByText("member@cowork.test");

    screen.getByRole("button", { name: "logout" }).click();
    screen.getByRole("button", { name: "refresh" }).click();
    expect(apiFetch).toHaveBeenCalledTimes(2);

    staleMe.resolve({ id: "u1", email: "member@cowork.test", displayName: "Member" });
    loggedOut.resolve(undefined);
    await waitFor(() => expect(screen.getByText("guest")).toBeInTheDocument());
  });

  it("does not update state or log when a session request resolves after unmount", async () => {
    const pending = deferred<{ id: string; email: string; displayName: string }>();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    apiFetch.mockImplementationOnce(() => pending.promise);
    const view = render(<SessionProvider><Probe /></SessionProvider>);
    view.unmount();
    pending.resolve({ id: "u1", email: "member@cowork.test", displayName: "Member" });
    await Promise.resolve();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
