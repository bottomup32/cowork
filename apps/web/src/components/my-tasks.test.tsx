import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const router = { replace };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
import { MyTasks } from "./my-tasks";

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((res) => { resolve = res; }); return { promise, resolve }; }
const project = (id: string, name: string) => ({ id, name, teamId: "team", updatedAt: "" });
const task = (id: string, projectId: string, title: string) => ({ id, projectId, title, status: "OPEN" as const });

describe("MyTasks", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it("loads project tasks sequentially with project context", async () => {
    const first = deferred<ReturnType<typeof task>[]>();
    const loadTasks = vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValueOnce([task("t2", "p2", "Second")]);
    render(<MyTasks loadProjects={vi.fn().mockResolvedValue([project("p1", "Alpha"), project("p2", "Beta")])} loadTasks={loadTasks} />);
    await waitFor(() => expect(loadTasks).toHaveBeenCalledWith("p1"));
    expect(loadTasks).toHaveBeenCalledTimes(1);
    first.resolve([task("t1", "p1", "First")]);
    expect(await screen.findByRole("link", { name: /First/ })).toHaveAttribute("href", "/tasks/t1");
    expect(await screen.findByText("Beta")).toBeInTheDocument();
  });
  it("shows empty state", async () => {
    render(<MyTasks loadProjects={vi.fn().mockResolvedValue([])} loadTasks={vi.fn()} />);
    expect(await screen.findByText(/no tasks yet/i)).toBeInTheDocument();
  });
  it("does not display partial results after a failure and retries", async () => {
    const loadTasks = vi.fn().mockResolvedValueOnce([task("t1", "p1", "First")]).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    render(<MyTasks loadProjects={vi.fn().mockResolvedValue([project("p1", "Alpha"), project("p2", "Beta")])} loadTasks={loadTasks} />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("First")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByText(/no tasks yet/i)).toBeInTheDocument();
    expect(loadTasks).toHaveBeenCalledTimes(4);
  });
  it("redirects for 401 and ignores unmounted completions", async () => {
    const pending = deferred<ReturnType<typeof task>[]>();
    const first = render(<MyTasks loadProjects={vi.fn().mockResolvedValue([project("p1", "Alpha")])} loadTasks={vi.fn().mockRejectedValue({ status: 401 })} />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    first.unmount();
    const second = render(<MyTasks loadProjects={vi.fn().mockResolvedValue([project("p1", "Alpha")])} loadTasks={vi.fn().mockReturnValue(pending.promise)} />);
    await screen.findByLabelText("Loading my tasks");
    second.unmount(); pending.resolve([task("t1", "p1", "Stale")]); await Promise.resolve();
    expect(screen.queryByText("Stale")).not.toBeInTheDocument();
  });
});
