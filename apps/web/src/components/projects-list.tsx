"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, apiFetch } from "../lib/api";
import type { Project } from "../lib/types";

type Props = { loadProjects?: () => Promise<Project[]>; onUnauthenticated?: () => void };
const defaultLoadProjects = () => apiFetch<Project[]>("/projects");
const isUnauthenticated = (error: unknown) => error instanceof ApiError ? error.status === 401 : typeof error === "object" && error !== null && "status" in error && error.status === 401;

export function ProjectsList({ loadProjects = defaultLoadProjects, onUnauthenticated }: Props) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [failed, setFailed] = useState(false);
  const request = useRef(0);
  const load = useCallback(async () => {
    const current = ++request.current;
    setFailed(false); setProjects(null);
    try { const result = await loadProjects(); if (current === request.current) setProjects(result); }
    catch (error) { if (current !== request.current) return; if (isUnauthenticated(error)) onUnauthenticated?.(); else setFailed(true); }
  }, [loadProjects, onUnauthenticated]);
  // The request token deliberately ignores completions after unmount or a retry.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void load(); const current = request.current; return () => { if (request.current === current) request.current++; }; }, [load]); // load only on entry or explicit retry

  if (projects === null && !failed) return <section className="workspace-page" aria-label="프로젝트 불러오는 중"><div className="content-skeleton" /><div className="content-skeleton short" /></section>;
  if (failed) return <section className="workspace-page"><p role="alert" className="inline-alert">프로젝트를 불러오지 못했습니다. 다시 시도해 주세요.</p><button className="button-primary" onClick={() => void load()}>다시 시도</button></section>;
  if (!projects?.length) return <section className="workspace-page empty-state"><h1>프로젝트</h1><p>참여 중인 프로젝트가 없습니다</p></section>;
  return <section className="workspace-page"><header className="page-heading"><p className="eyebrow">내 공간</p><h1>프로젝트</h1><p>참여 중인 팀 프로젝트를 선택해 개인 작업을 이어가세요.</p></header><div className="project-grid">{projects.map((project) => <Link aria-label={project.name} className="project-card" href={`/projects/${project.id}`} key={project.id}><span className="context-label">팀 프로젝트</span><strong>{project.name}</strong><span>작업 열기</span></Link>)}</div></section>;
}
