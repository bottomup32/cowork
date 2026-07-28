import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const session = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }), usePathname: () => "/" }));
vi.mock("../lib/session", () => ({ useSession: () => session() }));

import { WorkspaceGate } from "./workspace-gate";

describe("WorkspaceGate", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  const refresh = vi.fn();
  const logout = vi.fn();
  it("shows only a loading skeleton while session resolution is pending", () => {
    session.mockReturnValue({ loading: true, error: false, user: null, refresh, logout });
    render(<WorkspaceGate><p>비밀 내용</p></WorkspaceGate>);
    expect(screen.getByLabelText("작업 공간을 불러오는 중")).toBeInTheDocument();
    expect(screen.queryByText("비밀 내용")).not.toBeInTheDocument();
  });
  it("redirects an unauthenticated visitor without flashing protected content", () => {
    session.mockReturnValue({ loading: false, error: false, user: null, refresh, logout });
    render(<WorkspaceGate><p>비밀 내용</p></WorkspaceGate>);
    expect(replace).toHaveBeenCalledWith("/login");
    expect(screen.queryByText("비밀 내용")).not.toBeInTheDocument();
  });
  it("shows recoverable Korean session error and retries", () => {
    session.mockReturnValue({ loading: false, error: true, user: null, refresh, logout });
    render(<WorkspaceGate><p>비밀 내용</p></WorkspaceGate>);
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(refresh).toHaveBeenCalledOnce();
  });
  it("renders the authenticated shell and protected content", () => {
    session.mockReturnValue({ loading: false, error: false, user: { id: "u1", displayName: "민지", email: "me@cowork.test" }, refresh, logout });
    render(<WorkspaceGate><p>비밀 내용</p></WorkspaceGate>);
    expect(screen.getByText("비밀 내용")).toBeInTheDocument();
    expect(screen.getByText("민지")).toBeInTheDocument();
  });
});
