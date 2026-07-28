import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { NewTaskComposer } from "./new-task-composer";

describe("NewTaskComposer", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  const projects = [{ id: "project-1", name: "운영", teamId: "team-1", updatedAt: "2026-07-28" }];

  it("requires a project and title", async () => {
    render(<NewTaskComposer loadProjects={vi.fn().mockResolvedValue(projects)} createTask={vi.fn()} />);
    await screen.findByRole("option", { name: "운영" });
    fireEvent.click(screen.getByRole("button", { name: "작업 시작" }));
    expect(screen.getByRole("alert")).toHaveTextContent("프로젝트와 작업 제목을 입력해 주세요");
  });

  it("creates the requested task once and routes to it", async () => {
    const createTask = vi.fn().mockResolvedValue({ id: "task-1", projectId: "project-1", title: "7월 마감 보고서", status: "OPEN" });
    render(<NewTaskComposer loadProjects={vi.fn().mockResolvedValue(projects)} createTask={createTask} />);
    await screen.findByRole("option", { name: "운영" });
    fireEvent.change(screen.getByLabelText("프로젝트"), { target: { value: "project-1" } });
    fireEvent.change(screen.getByLabelText("작업 제목"), { target: { value: "7월 마감 보고서" } });
    const submit = screen.getByRole("button", { name: "작업 시작" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(createTask).toHaveBeenCalledWith("project-1", "7월 마감 보고서"));
    expect(createTask).toHaveBeenCalledOnce();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/tasks/task-1"));
  });

  it("keeps the entered title and exposes retry after an error", async () => {
    render(<NewTaskComposer loadProjects={vi.fn().mockResolvedValue(projects)} createTask={vi.fn().mockRejectedValue(new Error("offline"))} />);
    await screen.findByRole("option", { name: "운영" });
    fireEvent.change(screen.getByLabelText("프로젝트"), { target: { value: "project-1" } });
    fireEvent.change(screen.getByLabelText("작업 제목"), { target: { value: "보고서" } });
    fireEvent.click(screen.getByRole("button", { name: "작업 시작" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("작업을 만들지 못했습니다");
    expect(screen.getByLabelText("작업 제목")).toHaveValue("보고서");
    expect(screen.getByRole("button", { name: "작업 생성 다시 시도" })).toBeInTheDocument();
  });

  it("retries the failed task creation with the preserved draft", async () => {
    const createTask = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ id: "task-2", projectId: "project-1", title: "보고서", status: "OPEN" });
    render(<NewTaskComposer loadProjects={vi.fn().mockResolvedValue(projects)} createTask={createTask} />);
    await screen.findByRole("option", { name: "운영" });
    fireEvent.change(screen.getByLabelText("프로젝트"), { target: { value: "project-1" } });
    fireEvent.change(screen.getByLabelText("작업 제목"), { target: { value: "보고서" } });
    fireEvent.click(screen.getByRole("button", { name: "작업 시작" }));
    const retry = await screen.findByRole("button", { name: "작업 생성 다시 시도" });
    expect(screen.getByLabelText("프로젝트")).toHaveValue("project-1");
    expect(screen.getByLabelText("작업 제목")).toHaveValue("보고서");
    fireEvent.click(retry);
    await waitFor(() => expect(createTask).toHaveBeenNthCalledWith(2, "project-1", "보고서"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/tasks/task-2"));
  });
});
