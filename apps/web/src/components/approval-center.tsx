"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import type { ApprovalDashboard } from "../lib/types";

type Props = {
  load?: () => Promise<ApprovalDashboard>;
  decide?: (id: string, decision: "APPROVE" | "REJECT") => Promise<void>;
};
const defaultLoad = () => apiFetch<ApprovalDashboard>("/approvals");
const defaultDecide = (id: string, decision: "APPROVE" | "REJECT") => apiFetch<void>(`/approvals/${id}`, { method: "POST", body: JSON.stringify({ decision }) });

export function ApprovalCenter({ load = defaultLoad, decide = defaultDecide }: Props) {
  const [data, setData] = useState<ApprovalDashboard | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => { try { setData(await load()); setError(""); } catch { setError("승인 목록을 불러오지 못했습니다."); } }, [load]);
  useEffect(() => { void refresh(); }, [refresh]);
  async function onDecision(id: string, decision: "APPROVE" | "REJECT") {
    setBusy(true);
    try { await decide(id, decision); await refresh(); } catch { setError("승인 결정을 저장하지 못했습니다."); } finally { setBusy(false); }
  }
  if (!data) return <section className="workspace-page"><div className="content-skeleton" />{error && <p role="alert" className="inline-alert">{error}</p>}</section>;
  return <section className="workspace-page approval-center">
    <header className="page-heading"><p className="eyebrow">Policy & Approval</p><h1>외부 변경 승인</h1><p>실행 전 대상, 변경 내용, 영향 데이터를 확인하고 승인하거나 반려합니다.</p></header>
    {error && <p role="alert" className="inline-alert">{error}</p>}
    <section><h2>검토 대기</h2>{data.pending.length === 0 ? <p className="empty-copy">대기 중인 승인 요청이 없습니다.</p> : data.pending.map((item) => <article className="approval-card" key={item.id}>
      <div><span className="status-chip">{item.risk}</span><strong>{item.summary}</strong></div>
      <dl><div><dt>서비스</dt><dd>{item.service}</dd></div><div><dt>작업</dt><dd>{item.action}</dd></div><div><dt>요청자</dt><dd>{item.requestedBy?.displayName ?? "-"}</dd></div></dl>
      <pre>{JSON.stringify(item.payload, null, 2)}</pre>
      <div className="skill-actions"><button disabled={busy} onClick={() => void onDecision(item.id, "REJECT")}>반려</button><button className="button-primary" disabled={busy} onClick={() => void onDecision(item.id, "APPROVE")}>승인</button></div>
    </article>)}</section>
    <section className="approval-history"><h2>내 요청 기록</h2>{data.mine.length === 0 ? <p className="empty-copy">요청 기록이 없습니다.</p> : data.mine.map((item) => <article className="approval-row" key={item.id}><div><strong>{item.summary}</strong><span>{item.service} · {item.action}</span></div><span className="status-chip">{item.status}</span></article>)}</section>
  </section>;
}
