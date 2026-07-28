import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const router = { replace };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
import { SettingsPanel } from "./settings-panel";

describe("SettingsPanel", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it("shows current identity without internal IDs and redirects after logout", async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    render(<SettingsPanel user={{ id: "internal", displayName: "Member", email: "member@cowork.test" }} logout={logout} />);
    expect(screen.getByText("Member")).toBeInTheDocument(); expect(screen.getByText("member@cowork.test")).toBeInTheDocument(); expect(screen.queryByText("internal")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /log out/i }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });
  it("disables duplicate logout and reports an error", async () => {
    let reject!: (reason?: unknown) => void; const logout = vi.fn().mockReturnValue(new Promise<void>((_, fail) => { reject = fail; }));
    render(<SettingsPanel user={{ id: "u", displayName: "Member", email: "member@cowork.test" }} logout={logout} />);
    const button = screen.getByRole("button", { name: /log out/i }); fireEvent.click(button); fireEvent.click(button);
    expect(logout).toHaveBeenCalledOnce(); expect(button).toBeDisabled(); reject(new Error("offline"));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
