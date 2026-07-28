import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

import { TaskWorkspace } from "./task-workspace";

describe("TaskWorkspace", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("keeps a missing task private", async () => {
    render(<TaskWorkspace taskId="hidden" loadTask={vi.fn().mockRejectedValue({ status: 404 })} sendMessage={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "작업을 찾을 수 없습니다" })).toBeInTheDocument();
  });

  it("renders a direct TaskDetail response", async () => {
    render(<TaskWorkspace taskId="t1" loadTask={vi.fn().mockResolvedValue({ id: "t1", projectId: "p1", title: "보고서", status: "OPEN", conversation: { messages: [] } })} sendMessage={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "보고서" })).toBeInTheDocument();
  });

  it("does not show task A while task B is unresolved", async () => {
    const loadTask = vi.fn().mockResolvedValueOnce({ id: "a", projectId: "p", title: "작업 A", status: "OPEN", conversation: { messages: [] } }).mockImplementationOnce(() => new Promise<never>(() => {}));
    const view = render(<TaskWorkspace taskId="a" loadTask={loadTask} sendMessage={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "작업 A" })).toBeInTheDocument();
    view.rerender(<TaskWorkspace taskId="b" loadTask={loadTask} sendMessage={vi.fn()} />);
    expect(screen.queryByRole("heading", { name: "작업 A" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("메시지")).not.toBeInTheDocument();
    expect(screen.getByLabelText("작업 불러오는 중")).toBeInTheDocument();
  });
});
