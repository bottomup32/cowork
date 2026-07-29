"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "../lib/api";
import type { SkillDashboard } from "../lib/types";

type Props = {
  load?: () => Promise<SkillDashboard>;
  create?: (teamId: string, name: string, goal: string) => Promise<void>;
};

const defaultLoad = () => apiFetch<SkillDashboard>("/skills");
const defaultCreate = (teamId: string, name: string, goal: string) =>
  apiFetch<void>(`/teams/${teamId}/skills`, { method: "POST", body: JSON.stringify({ name, goal }) });

export function SkillStudio({ load = defaultLoad, create = defaultCreate }: Props) {
  const [dashboard, setDashboard] = useState<SkillDashboard | null>(null);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [change, setChange] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try { setDashboard(await load()); setError(""); }
    catch { setError("Skill 정보를 불러오지 못했습니다."); }
  }, [load]);
  useEffect(() => { void refresh(); }, [refresh]);

  const authorTeams = useMemo(() => dashboard?.memberships.filter((item) => item.role !== "MEMBER") ?? [], [dashboard]);
  const adminTeamIds = useMemo(() => new Set(dashboard?.memberships.filter((item) => item.role === "TEAM_ADMIN").map((item) => item.teamId)), [dashboard]);
  const [teamId, setTeamId] = useState("");
  useEffect(() => { if (!teamId && authorTeams[0]) setTeamId(authorTeams[0].teamId); }, [authorTeams, teamId]);

  async function action(work: () => Promise<unknown>) {
    setBusy(true); setError("");
    try { await work(); await refresh(); }
    catch { setError("요청을 완료하지 못했습니다. 상태와 권한을 확인해 주세요."); }
    finally { setBusy(false); }
  }

  if (!dashboard) return <section className="workspace-page"><div className="content-skeleton" />{error && <p role="alert" className="inline-alert">{error}</p>}</section>;

  return <section className="workspace-page skill-studio">
    <header className="page-heading"><p className="eyebrow">Skill Studio</p><h1>팀의 반복 업무를 Skill로 만드세요</h1><p>자연어 초안을 안전하게 테스트하고 관리자 승인 후 팀에 배포합니다.</p></header>
    {error && <p role="alert" className="inline-alert">{error}</p>}

    {authorTeams.length > 0 && <form className="skill-builder" onSubmit={(event) => {
      event.preventDefault();
      void action(async () => { await create(teamId, name, goal); setName(""); setGoal(""); });
    }}>
      <div><span className="context-label">대화형 Builder</span><h2>새 Skill 만들기</h2><p>업무 목표를 설명하면 입력 검증, 격리 실행, 결과 미리보기 단계가 포함된 초안을 만듭니다.</p></div>
      <label>팀<select value={teamId} onChange={(event) => setTeamId(event.target.value)}>{authorTeams.map((item) => <option key={item.teamId} value={item.teamId}>{item.team.name}</option>)}</select></label>
      <label>Skill 이름<input aria-label="Skill 이름" required value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label className="wide">업무 목표<textarea aria-label="업무 목표" required value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="예: 청구서 Excel을 검토하고 예외 내역 보고서를 작성해줘." /></label>
      <button className="button-primary" disabled={busy} type="submit">초안 생성</button>
    </form>}

    <div className="skill-columns">
      <section><h2>내 초안</h2>{dashboard.drafts.length === 0 ? <p className="empty-copy">아직 작성한 초안이 없습니다.</p> : dashboard.drafts.map((skill) => {
        const version = skill.latestVersion;
        return <article className="skill-card" key={skill.id}><div><strong>{skill.name}</strong><span className="status-chip">v{version.version} · {version.status}</span></div><p>{version.definition.goal}</p>
          <div className="skill-actions">
            {(version.status === "DRAFT" || version.status === "TESTED") && <button disabled={busy} onClick={() => void action(() => apiFetch(`/skill-versions/${version.id}/test`, { method: "POST" }))}>안전 테스트</button>}
            {version.status === "TESTED" && <button className="button-primary" disabled={busy} onClick={() => void action(() => apiFetch(`/skill-versions/${version.id}/submit`, { method: "POST" }))}>승인 요청</button>}
          </div>
          {version.status !== "REVIEW" && <form className="revision-form" onSubmit={(event) => { event.preventDefault(); const value = change[skill.id]?.trim(); if (value) void action(() => apiFetch(`/skills/${skill.id}/versions`, { method: "POST", body: JSON.stringify({ change: value }) })); }}>
            <input aria-label={`${skill.name} 수정 요청`} value={change[skill.id] ?? ""} onChange={(event) => setChange((current) => ({ ...current, [skill.id]: event.target.value }))} placeholder="자연어로 변경 사항 입력" />
            <button disabled={busy}>새 버전</button>
          </form>}
        </article>;
      })}</section>

      <section><h2>팀 Skill</h2>{dashboard.published.length === 0 ? <p className="empty-copy">배포된 Skill이 없습니다.</p> : dashboard.published.map((skill) => <article className="skill-card" key={skill.id}><div><strong>{skill.name}</strong><span className="status-chip">v{skill.activeVersion.version} · 배포됨</span></div><p>{skill.activeVersion.definition.goal}</p>{adminTeamIds.has(skill.teamId) && <button disabled={busy} onClick={() => void action(() => apiFetch(`/skills/${skill.id}/disable`, { method: "POST" }))}>비활성화</button>}</article>)}</section>
    </div>

    {dashboard.reviews.length > 0 && <section className="review-queue"><h2>관리자 검토함</h2>{dashboard.reviews.map((review) => <article className="skill-card" key={review.id}><div><strong>{review.skillVersion.skill.name}</strong><span>{review.requestedBy.displayName}</span></div><p>{review.skillVersion.definition.goal}</p><div className="skill-actions"><button disabled={busy} onClick={() => void action(() => apiFetch(`/skill-reviews/${review.id}`, { method: "POST", body: JSON.stringify({ decision: "REJECT" }) }))}>반려</button><button className="button-primary" disabled={busy} onClick={() => void action(() => apiFetch(`/skill-reviews/${review.id}`, { method: "POST", body: JSON.stringify({ decision: "APPROVE" }) }))}>승인·배포</button></div></article>)}</section>}
  </section>;
}
