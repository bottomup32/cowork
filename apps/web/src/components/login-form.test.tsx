import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));

import { LoginForm } from "./login-form";

describe("LoginForm", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("refreshes the persistent session before navigating after login", async () => {
    const events: string[] = [];
    const login = vi.fn().mockResolvedValue(undefined);
    const refreshSession = vi.fn().mockImplementation(async () => { events.push("session"); });
    render(<LoginForm login={async (input) => { events.push("login"); return login(input); }} refreshSession={refreshSession} />);

    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "member@cowork.test" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => expect(login).toHaveBeenCalledWith({ email: "member@cowork.test", password: "password" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(events).toEqual(["login", "session"]);
    expect(refreshSession).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows one generic Korean error and clears the password after a failure", async () => {
    const login = vi.fn().mockRejectedValue(new Error("unexpected"));
    render(<LoginForm login={login} refreshSession={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "member@cowork.test" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("이메일 또는 비밀번호를 확인해 주세요.");
    expect(screen.getByLabelText("이메일")).toHaveValue("member@cowork.test");
    expect(screen.getByLabelText("비밀번호")).toHaveValue("");
  });

  it("disables the submit button while a request is in progress", async () => {
    let resolveLogin!: () => void;
    const login = vi.fn().mockImplementation(() => new Promise<void>((resolve) => { resolveLogin = resolve; }));
    render(<LoginForm login={login} refreshSession={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "member@cowork.test" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "password" } });

    const submit = screen.getByRole("button", { name: "로그인" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(login).toHaveBeenCalledOnce();
    expect(submit).toBeDisabled();

    resolveLogin();
    await waitFor(() => expect(submit).not.toBeDisabled());
  });

  it("shows the generic error and does not navigate when the session refresh fails", async () => {
    render(<LoginForm login={vi.fn().mockResolvedValue(undefined)} refreshSession={vi.fn().mockRejectedValue(new Error("refresh failed"))} />);
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "member@cowork.test" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("이메일 또는 비밀번호를 확인해 주세요.");
    expect(screen.getByLabelText("비밀번호")).toHaveValue("");
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
