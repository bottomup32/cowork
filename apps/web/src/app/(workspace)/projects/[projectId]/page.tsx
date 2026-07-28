"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError, apiFetch } from "../../../../lib/api";
import type { Project, TaskSummary } from "../../../../lib/types";
import { ProjectTasks } from "../../../../components/project-tasks";

export default function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params); const router = useRouter(); const [project, setProject] = useState<Project | null | undefined>(undefined); const request = useRef(0);
  const load = useCallback(async () => { const current = ++request.current; setProject(undefined); try { const projects = await apiFetch<Project[]>("/projects"); if (current === request.current) setProject(projects.find((item) => item.id === projectId) ?? null); } catch (error) { if (current !== request.current) return; if (error instanceof ApiError && error.status === 401) router.replace("/login"); else setProject(null); } }, [projectId, router]);
  // The request token deliberately ignores completions after unmount or a retry.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void load(); const current = request.current; return () => { if (request.current === current) request.current++; }; }, [load]);
  if (project === undefined) return <section className="workspace-page" aria-label="프로젝트 불러오는 중"><div className="content-skeleton" /></section>;
  if (!project) return <section className="workspace-page empty-state"><h1>프로젝트를 찾을 수 없습니다</h1></section>;
  return <section className="workspace-page"><header className="page-heading"><p className="eyebrow">팀 프로젝트</p><h1>{project.name}</h1><p>내가 만든 작업만 이 공간에 표시됩니다.</p></header><ProjectTasks projectId={project.id} createTask={(id, title) => apiFetch<TaskSummary>(`/projects/${id}/tasks`, { method: "POST", body: JSON.stringify({ title }) })} onUnauthenticated={() => router.replace("/login")} /></section>;
}
