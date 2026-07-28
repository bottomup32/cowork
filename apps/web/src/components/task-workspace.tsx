"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError, apiFetch } from "../lib/api";
import type { Message, TaskDetail } from "../lib/types";
import { TaskChat } from "./task-chat";

const getTask = (taskId: string) => apiFetch<TaskDetail>(`/tasks/${taskId}`);
const send = (taskId: string, content: string) => apiFetch<{ messages: Message[] }>(`/tasks/${taskId}/messages`, { method: "POST", body: JSON.stringify({ content }) }).then((result) => result.messages);
const hasStatus = (error: unknown, status: number) => error instanceof ApiError ? error.status === status : typeof error === "object" && error !== null && "status" in error && error.status === status;

export function TaskWorkspace({ taskId, loadTask = getTask, sendMessage = send }: { taskId: string; loadTask?: (taskId: string) => Promise<TaskDetail>; sendMessage?: (taskId: string, content: string) => Promise<Message[]> }) {
  const router = useRouter(); const [task, setTask] = useState<TaskDetail | null>(null); const [taskResourceId, setTaskResourceId] = useState<string | null>(null); const [state, setState] = useState<"loading" | "missing" | "error">("loading"); const [stateResourceId, setStateResourceId] = useState<string | null>(null); const request = useRef(0);
  // router is stable in Next; excluding it keeps the cancellable loader stable across state renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => { const current = ++request.current; setState("loading"); setStateResourceId(taskId); try { const result = await loadTask(taskId); if (current === request.current) { setTask(result); setTaskResourceId(taskId); } } catch (error) { if (current !== request.current) return; if (hasStatus(error, 401)) router.replace("/login"); else if (hasStatus(error, 404)) { setState("missing"); setStateResourceId(taskId); } else { setState("error"); setStateResourceId(taskId); } } }, [loadTask, taskId]);
  // The request token deliberately ignores completions after unmount or a retry.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void load(); const current = request.current; return () => { if (request.current === current) request.current++; }; }, [load]);
  if (stateResourceId === taskId && state === "missing") return <section className="workspace-page empty-state"><h1>작업을 찾을 수 없습니다</h1></section>;
  if (stateResourceId === taskId && state === "error") return <section className="workspace-page"><p role="alert" className="inline-alert">작업을 불러오지 못했습니다. 다시 시도해 주세요.</p><button className="button-primary" onClick={() => void load()}>다시 시도</button></section>;
  if (!task || taskResourceId !== taskId) return <section className="workspace-page" aria-label="작업 불러오는 중"><div className="content-skeleton" /></section>;
  return <section className="workspace-page task-workspace"><header className="page-heading"><p className="eyebrow">개인 작업</p><h1>{task.title}</h1><span className="status-chip">{task.status}</span></header><TaskChat taskId={task.id} initialMessages={task.conversation?.messages ?? []} sendMessage={(content) => sendMessage(task.id, content)} /></section>;
}
