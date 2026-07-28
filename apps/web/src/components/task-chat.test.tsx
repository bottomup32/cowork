import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TaskChat } from "./task-chat";

describe("TaskChat", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  const userMessage = { id: "m1", role: "USER" as const, content: "안녕하세요", createdAt: "2026-07-28" };
  const assistantMessage = { id: "m2", role: "ASSISTANT" as const, content: "무엇을 도와드릴까요?", createdAt: "2026-07-28" };

  it("uses semantic role labels and sends an exact Korean message once", async () => {
    const sendMessage = vi.fn().mockResolvedValue([userMessage, assistantMessage]);
    render(<TaskChat taskId="t1" initialMessages={[]} sendMessage={sendMessage} />);
    fireEvent.change(screen.getByLabelText("메시지"), { target: { value: " 안녕하세요 " } });
    const send = screen.getByRole("button", { name: "보내기" });
    fireEvent.click(send); fireEvent.click(send);
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith("안녕하세요"));
    expect(sendMessage).toHaveBeenCalledOnce();
    expect(await screen.findByText("USER")).toBeInTheDocument();
    expect(screen.getByText("ASSISTANT")).toBeInTheDocument();
    expect(screen.getByText("무엇을 도와드릴까요?")).toBeInTheDocument();
  });

  it("preserves a draft on failure", async () => {
    render(<TaskChat taskId="t1" initialMessages={[]} sendMessage={vi.fn().mockRejectedValue(new Error("offline"))} />);
    fireEvent.change(screen.getByLabelText("메시지"), { target: { value: "도움" } });
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("메시지를 보내지 못했습니다");
    expect(screen.getByLabelText("메시지")).toHaveValue("도움");
  });

  it("ignores an old task response after switching tasks", async () => {
    let resolveOld!: (messages: typeof userMessage[]) => void;
    const sendMessage = vi.fn().mockImplementation(() => new Promise<typeof userMessage[]>((resolve) => { resolveOld = resolve; }));
    const view = render(<TaskChat taskId="a" initialMessages={[]} sendMessage={sendMessage} />);
    fireEvent.change(screen.getByLabelText("메시지"), { target: { value: "A" } });
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));
    view.rerender(<TaskChat taskId="b" initialMessages={[]} sendMessage={sendMessage} />);
    fireEvent.change(screen.getByLabelText("메시지"), { target: { value: "B 초안" } });
    resolveOld([userMessage]);
    await waitFor(() => expect(screen.getByLabelText("메시지")).toHaveValue("B 초안"));
    expect(screen.queryByText("안녕하세요")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "보내기" })).toBeEnabled();
  });
});
