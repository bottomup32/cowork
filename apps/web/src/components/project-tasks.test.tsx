import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectTasks } from "./project-tasks";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("ProjectTasks", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  const task = { id: "t1", projectId: "p1", title: "보고서", status: "OPEN" as const };

  it("renders direct tasks", async () => {
    render(<ProjectTasks projectId="p1" loadTasks={vi.fn().mockResolvedValue([task])} createTask={vi.fn()} />);
    expect(await screen.findByRole("link", { name: "보고서" })).toHaveAttribute("href", "/tasks/t1");
  });

  it("validates a title before creating", async () => {
    const createTask = vi.fn();
    render(<ProjectTasks projectId="p1" loadTasks={vi.fn().mockResolvedValue([])} createTask={createTask} />);
    await screen.findByText("아직 작업이 없습니다");
    fireEvent.click(screen.getByRole("button", { name: "작업 만들기" }));
    expect(screen.getByRole("alert")).toHaveTextContent("작업 제목을 입력해 주세요");
    expect(createTask).not.toHaveBeenCalled();
  });

  it("posts an exact trimmed payload once and prepends its direct response", async () => {
    const createTask = vi.fn().mockResolvedValue(task);
    render(<ProjectTasks projectId="p1" loadTasks={vi.fn().mockResolvedValue([])} createTask={createTask} />);
    await screen.findByText("아직 작업이 없습니다");
    fireEvent.change(screen.getByLabelText("작업 제목"), { target: { value: " 보고서 " } });
    const submit = screen.getByRole("button", { name: "작업 만들기" });
    fireEvent.click(submit); fireEvent.click(submit);
    await waitFor(() => expect(createTask).toHaveBeenCalledWith("p1", "보고서"));
    expect(createTask).toHaveBeenCalledOnce();
    expect(await screen.findByRole("link", { name: "보고서" })).toBeInTheDocument();
    expect(push).toHaveBeenCalledWith("/tasks/t1");
  });

  it("preserves the draft after a creation failure", async () => {
    render(<ProjectTasks projectId="p1" loadTasks={vi.fn().mockResolvedValue([])} createTask={vi.fn().mockRejectedValue(new Error("offline"))} />);
    await screen.findByText("아직 작업이 없습니다");
    fireEvent.change(screen.getByLabelText("작업 제목"), { target: { value: "보고서" } });
    fireEvent.click(screen.getByRole("button", { name: "작업 만들기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("작업을 만들지 못했습니다");
    expect(screen.getByLabelText("작업 제목")).toHaveValue("보고서");
  });
});
