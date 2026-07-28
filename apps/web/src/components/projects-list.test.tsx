import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectsList } from "./projects-list";

describe("ProjectsList", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("shows neutral loading and then direct project links", async () => {
    render(<ProjectsList loadProjects={vi.fn().mockResolvedValue([{ id: "p1", name: "제품 팀", teamId: "team-1", updatedAt: "2026-07-28" }])} />);
    expect(screen.getByLabelText("프로젝트 불러오는 중")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "제품 팀" })).toHaveAttribute("href", "/projects/p1");
    expect(screen.getByText("팀 프로젝트")).toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    render(<ProjectsList loadProjects={vi.fn().mockResolvedValue([])} />);
    expect(await screen.findByText("참여 중인 프로젝트가 없습니다")).toBeInTheDocument();
  });

  it("retries an error", async () => {
    const loadProjects = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([]);
    render(<ProjectsList loadProjects={loadProjects} />);
    fireEvent.click(await screen.findByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(loadProjects).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("참여 중인 프로젝트가 없습니다")).toBeInTheDocument();
  });

  it("hands 401 errors to the session boundary", async () => {
    const onUnauthenticated = vi.fn();
    render(<ProjectsList loadProjects={vi.fn().mockRejectedValue({ status: 401 })} onUnauthenticated={onUnauthenticated} />);
    await waitFor(() => expect(onUnauthenticated).toHaveBeenCalledOnce());
  });
});
