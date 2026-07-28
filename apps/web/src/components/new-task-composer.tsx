"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";

import { ApiError, apiFetch } from "../lib/api";
import type { Project, TaskSummary } from "../lib/types";

type CreateTask = (projectId: string, title: string) => Promise<TaskSummary>;
const getProjects = () => apiFetch<Project[]>("/projects");
const postTask: CreateTask = (projectId, title) => apiFetch<TaskSummary>(`/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify({ title }) });

export function NewTaskComposer({ loadProjects = getProjects, createTask = postTask }: { loadProjects?: () => Promise<Project[]>; createTask?: CreateTask }) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [errorKind, setErrorKind] = useState<"projects" | "task" | null>(null);
  const [failedDraft, setFailedDraft] = useState<{ projectId: string; title: string } | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const receiveProjectError = (caught: unknown) => {
    if (caught instanceof ApiError && caught.status === 401) router.replace("/login");
    else { setErrorKind("projects"); setError("프로젝트를 불러오지 못했습니다. 다시 시도해 주세요."); }
  };
  const retryProjects = async () => { setLoadingProjects(true); setError(""); setErrorKind(null); try { setProjects(await loadProjects()); } catch (caught) { receiveProjectError(caught); } finally { setLoadingProjects(false); } };
  useEffect(() => {
    void loadProjects().then(setProjects).catch(receiveProjectError).finally(() => setLoadingProjects(false));
    // Project options are direct API data; retry is intentionally user-initiated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(draft: { projectId: string; title: string }) {
    if (submitting) return;
    setSubmitting(true); setError(""); setErrorKind(null);
    try { const task = await createTask(draft.projectId, draft.title); setFailedDraft(null); router.push(`/tasks/${task.id}`); }
    catch (caught) { if (caught instanceof ApiError && caught.status === 401) router.replace("/login"); else { setFailedDraft(draft); setErrorKind("task"); setError("작업을 만들지 못했습니다. 다시 시도해 주세요."); } }
    finally { setSubmitting(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId || !title.trim()) { setErrorKind(null); setError("프로젝트와 작업 제목을 입력해 주세요."); return; }
    await create({ projectId, title: title.trim() });
  }

  return <section className="task-composer" aria-labelledby="new-task-title"><div><p className="eyebrow">새 작업</p><h2 id="new-task-title">무엇을 함께 해볼까요?</h2><p>제목을 적으면 전용 작업 공간을 바로 만들어요.</p></div><form onSubmit={submit} noValidate><label>프로젝트<select value={projectId} onChange={(event) => setProjectId(event.target.value)} disabled={loadingProjects || submitting}><option value="">프로젝트 선택</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label>작업 제목<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: 7월 마감 보고서" disabled={submitting} /></label>{error ? <div role="alert" className="composer-error">{error}{errorKind === "projects" ? <button type="button" onClick={() => void retryProjects()}>프로젝트 불러오기 다시 시도</button> : null}{errorKind === "task" && failedDraft ? <button type="button" disabled={submitting} onClick={() => void create(failedDraft)}>작업 생성 다시 시도</button> : null}</div> : null}<button type="submit" className="button-primary composer-submit" disabled={submitting || loadingProjects}>{submitting ? <LoaderCircle className="spin" size={17} /> : <ArrowRight size={17} />}작업 시작</button></form></section>;
}
