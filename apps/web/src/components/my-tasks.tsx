"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, CircleX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, apiFetch } from "../lib/api";
import type { Project, TaskSummary } from "../lib/types";

type TaskWithProject = TaskSummary & { projectName: string };
type Props = { loadProjects?: () => Promise<Project[]>; loadTasks?: (projectId: string) => Promise<TaskSummary[]> };
const defaultProjects = () => apiFetch<Project[]>("/projects");
const defaultTasks = (projectId: string) => apiFetch<TaskSummary[]>(`/projects/${projectId}/tasks`);
const isUnauthorized = (error: unknown) => error instanceof ApiError ? error.status === 401 : typeof error === "object" && error !== null && "status" in error && error.status === 401;
const statusIcon = { OPEN: Circle, COMPLETED: CheckCircle2, CANCELLED: CircleX };

export function MyTasks({ loadProjects = defaultProjects, loadTasks = defaultTasks }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskWithProject[] | null>(null);
  const [error, setError] = useState(false);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const current = ++generation.current;
    setTasks(null); setError(false);
    try {
      const projects = await loadProjects();
      const merged: TaskWithProject[] = [];
      for (const project of projects) {
        const projectTasks = await loadTasks(project.id);
        merged.push(...projectTasks.map((task) => ({ ...task, projectName: project.name })));
      }
      if (current === generation.current) setTasks(merged);
    } catch (caught) {
      if (current !== generation.current) return;
      if (isUnauthorized(caught)) router.replace("/login"); else setError(true);
    }
  }, [loadProjects, loadTasks, router]);
  // The generation token intentionally fences a queued load after unmount or retry.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) void load(); }); return () => { active = false; generation.current++; }; }, [load]);

  return <section className="workspace-page my-tasks">
    <div className="page-heading"><h1>My Tasks</h1><p>Projects you can access, showing only tasks returned for your current account.</p></div>
    {tasks === null && !error ? <div aria-label="Loading my tasks" className="content-skeleton" /> : null}
    {error ? <p role="alert" className="inline-alert">We could not load your tasks. <button type="button" onClick={() => void load()}>Retry</button></p> : null}
    {tasks?.length === 0 ? <div className="empty-state"><h2>No tasks yet</h2><p>{"\uC544\uC9C1 \uB0B4 \uC791\uC5C5\uC774 \uC5C6\uC2B5\uB2C8\uB2E4"}</p></div> : null}
    {tasks?.length ? <ul className="task-list">{tasks.map((task) => { const Icon = statusIcon[task.status]; return <li key={task.id}><Link href={`/tasks/${task.id}`}><span><strong>{task.title}</strong><small>{task.projectName}</small></span><span className="task-status"><Icon aria-hidden="true" size={16} />{task.status}</span></Link></li>; })}</ul> : null}
  </section>;
}
