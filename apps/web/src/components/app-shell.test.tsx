import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const pathname = vi.fn(() => "/");
vi.mock("next/navigation", () => ({ usePathname: () => pathname() }));

import { AppShell } from "./app-shell";

describe("AppShell", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); pathname.mockReturnValue("/"); document.body.style.overflow = ""; });

  it("shows navigation, the signed-in user, and marks the active link", () => {
    render(<AppShell user={{ id: "u1", email: "me@cowork.test", displayName: "민지" }} logout={vi.fn()}><p>내용</p></AppShell>);
    for (const label of ["Home", "Projects", "My Tasks", "Skills", "Approvals", "Integrations", "Settings"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("민지")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  });

  it("exposes an accessible mobile drawer toggle and logs out", () => {
    const logout = vi.fn();
    render(<AppShell user={{ id: "u1", email: "me@cowork.test", displayName: "민지" }} logout={logout}><p>내용</p></AppShell>);
    const toggle = screen.getByRole("button", { name: "메뉴 열기" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    expect(logout).toHaveBeenCalledOnce();
  });

  it("handles a rejected logout, disables duplicates, and allows retry", async () => {
    const logout = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
    render(<AppShell user={{ id: "u1", email: "me@cowork.test", displayName: "Member" }} logout={logout}><p>content</p></AppShell>);
    const button = document.querySelector<HTMLButtonElement>(".logout")!;
    fireEvent.click(button); fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fireEvent.click(button);
    expect(logout).toHaveBeenCalledTimes(2);
  });

  it("moves focus into the drawer and restores it after Escape or the overlay closes it", () => {
    render(<AppShell user={{ id: "u1", email: "me@cowork.test", displayName: "민지" }} logout={vi.fn()}><p>내용</p></AppShell>);
    const toggle = screen.getByRole("button", { name: "메뉴 열기" });
    fireEvent.click(toggle);
    expect(screen.getByRole("link", { name: "Home" })).toHaveFocus();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(toggle).toHaveFocus();
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("button", { name: "메뉴 바깥 영역 닫기" }));
    expect(toggle).toHaveFocus();
  });

  it("keeps tab focus within the open mobile drawer", () => {
    render(<AppShell user={{ id: "u1", email: "me@cowork.test", displayName: "민지" }} logout={vi.fn()}><p>내용</p></AppShell>);
    fireEvent.click(screen.getByRole("button", { name: "메뉴 열기" }));
    const logout = screen.getByRole("button", { name: "로그아웃" });
    logout.focus();
    fireEvent.keyDown(logout, { key: "Tab" });
    expect(screen.getByRole("link", { name: "Home" })).toHaveFocus();
  });

  it("locks body scrolling only while the drawer is open and restores the prior inline value", () => {
    document.body.style.overflow = "scroll";
    const view = render(<AppShell user={{ id: "u1", email: "me@cowork.test", displayName: "민지" }} logout={vi.fn()}><p>내용</p></AppShell>);
    fireEvent.click(screen.getByRole("button", { name: "메뉴 열기" }));
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.body.style.overflow).toBe("scroll");
    fireEvent.click(screen.getByRole("button", { name: "메뉴 열기" }));
    view.unmount();
    expect(document.body.style.overflow).toBe("scroll");
  });

  it("closes and unlocks the mobile drawer when the desktop breakpoint becomes active", () => {
    let listener: ((event: MediaQueryListEvent) => void) | undefined;
    const matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: (_: string, callback: (event: MediaQueryListEvent) => void) => { listener = callback; }, removeEventListener: vi.fn() });
    Object.defineProperty(window, "matchMedia", { configurable: true, value: matchMedia });
    render(<AppShell user={{ id: "u1", email: "me@cowork.test", displayName: "민지" }} logout={vi.fn()}><p>내용</p></AppShell>);
    const toggle = screen.getByRole("button", { name: "메뉴 열기" });
    fireEvent.click(toggle);
    expect(document.body.style.overflow).toBe("hidden");
    act(() => listener?.({ matches: true } as MediaQueryListEvent));
    expect(document.body.style.overflow).toBe("");
    expect(screen.queryByRole("button", { name: "메뉴 바깥 영역 닫기" })).not.toBeInTheDocument();
    expect(toggle).not.toHaveFocus();
  });
});
