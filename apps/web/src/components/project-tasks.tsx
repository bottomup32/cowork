"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError, apiFetch } from "../lib/api";
import type { TaskSummary } from "../lib/types";

type Props = { projectId: string; loadTasks?: (projectId: string) => Promise<TaskSummary[]>; createTask: (projectId: string, title: string) => Promise<TaskSummary>; onUnauthenticated?: () => void };
const defaultLoadTasks = (projectId: string) => apiFetch<TaskSummary[]>(`/projects/${projectId}/tasks`);
const unauthenticated = (error: unknown) => error instanceof ApiError ? error.status === 401 : typeof error === "object" && error !== null && "status" in error && error.status === 401;

export function ProjectTasks({ projectId, loadTasks = defaultLoadTasks, createTask, onUnauthenticated }: Props) {
  const router = useRouter(); const [tasks, setTasks] = useState<TaskSummary[] | null>(null); const [tasksProjectId, setTasksProjectId] = useState<string | null>(null); const [title, setTitle] = useState(""); const [error, setError] = useState(""); const [loadingError, setLoadingError] = useState(false); const [errorProjectId, setErrorProjectId] = useState<string | null>(null); const [creating, setCreating] = useState(false); const request = useRef(0); const visibleTasks = tasksProjectId === projectId ? tasks : null; const visibleError = errorProjectId === projectId && loadingError;
  const load = useCallback(async () => { const current = ++request.current; setTasks(null); setTasksProjectId(null); setLoadingError(false); try { const result = await loadTasks(projectId); if (current === request.current) { setTasks(result); setTasksProjectId(projectId); } } catch (caught) { if (current !== request.current) return; if (unauthenticated(caught)) onUnauthenticated?.(); else { setLoadingError(true); setErrorProjectId(projectId); } } }, [loadTasks, onUnauthenticated, projectId]);
  // The request token deliberately ignores completions after unmount or a retry.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void load(); const current = request.current; return () => { if (request.current === current) request.current++; }; }, [load]);
  const submit = async (event: FormEvent) => { event.preventDefault(); const clean = title.trim(); if (!clean) { setError("작업 제목을 입력해 주세요"); return; } if (creating) return; setCreating(true); setError(""); try { const task = await createTask(projectId, clean); setTasks((existing) => [task, ...(existing ?? [])]); setTitle(""); router.push(`/tasks/${task.id}`); } catch (caught) { if (unauthenticated(caught)) onUnauthenticated?.(); else setError("작업을 만들지 못했습니다. 다시 시도해 주세요."); } finally { setCreating(false); } };
  return <section className="project-tasks"><form className="create-task" onSubmit={submit} noValidate><label>작업 제목<input aria-label="작업 제목" value={title} onChange={(event) => setTitle(event.target.value)} disabled={creating} placeholder="새 작업의 제목" /></label><button className="button-primary" disabled={creating} type="submit">{creating ? "만드는 중…" : "작업 만들기"}</button>{error ? <p role="alert" className="inline-alert">{error}</p> : null}</form>{visibleTasks === null && !visibleError ? <div aria-label="작업 불러오는 중" className="content-skeleton" /> : null}{visibleError ? <p role="alert" className="inline-alert">작업을 불러오지 못했습니다. <button type="button" onClick={() => void load()}>다시 시도</button></p> : null}{visibleTasks?.length === 0 ? <p className="empty-copy">아직 작업이 없습니다</p> : null}{visibleTasks?.length ? <ul className="task-list">{visibleTasks.map((task) => <li key={task.id}><Link aria-label={task.title} href={`/tasks/${task.id}`}><span>{task.title}</span><small>{task.status}</small></Link></li>)}</ul> : null}</section>;
}
