import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
const replace = vi.fn();
vi.mock("../lib/api", () => ({ apiFetch, ApiError: class ApiError extends Error {} }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }), usePathname: () => "/settings" }));

import { useSession, SessionProvider } from "../lib/session";
import { SettingsPanel } from "./settings-panel";
import { WorkspaceGate } from "./workspace-gate";

function SettingsRoute() { const { user, logout } = useSession(); return user ? <SettingsPanel user={user} logout={logout} /> : null; }

describe("settings logout integration", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it("keeps the authenticated route on failure and redirects after retry succeeds", async () => {
    apiFetch.mockResolvedValueOnce({ id: "u1", displayName: "Member", email: "member@cowork.test" }).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
    render(<SessionProvider><WorkspaceGate><SettingsRoute /></WorkspaceGate></SessionProvider>);
    await screen.findAllByText("member@cowork.test");
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("\uB85C\uADF8\uC544\uC6C3");
    expect(screen.getAllByText("member@cowork.test").length).toBeGreaterThan(0);
    expect(replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });
});
