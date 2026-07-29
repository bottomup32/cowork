"use client";

import { BookOpen, Cable, FileSpreadsheet } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import type { IntegrationState } from "../lib/types";

const icons = { notion: BookOpen, google: FileSpreadsheet, composio: Cable };

export function IntegrationCenter() {
  const [items, setItems] = useState<IntegrationState[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  useEffect(() => { void apiFetch<IntegrationState[]>("/integrations").then(setItems).catch(() => setError("연결 상태를 불러오지 못했습니다.")); }, []);
  async function connect(provider: "google" | "notion") {
    setBusy(provider); setError("");
    try {
      const result = await apiFetch<{ redirectUrl: string }>(`/integrations/${provider}/connect`, { method: "POST" });
      window.location.assign(result.redirectUrl);
    } catch { setError("서버에 Composio API 키와 Auth Config ID를 먼저 설정해 주세요."); setBusy(""); }
  }
  return <section className="workspace-page integrations-page">
    <header className="page-heading"><p className="eyebrow">Connections</p><h1>외부 서비스 연결</h1><p>Notion은 팀 지식으로, Google Docs와 Sheets는 Composio OAuth를 통해 작업 도구로 사용합니다.</p></header>
    {error && <p role="alert" className="inline-alert">{error}</p>}
    {!items ? <div className="content-skeleton" /> : <div className="connection-grid">{items.map((item) => {
      const Icon = icons[item.id];
      return <article className="connection-card" key={item.id}><Icon aria-hidden="true" size={22} /><div><h2>{item.name}</h2><p>{item.capability}</p></div><span className="status-chip">{item.status === "READY" ? "서버 준비됨" : "설정 필요"}</span>
        {item.id === "google" && item.status === "READY" && <button className="button-primary" disabled={busy === item.id} onClick={() => void connect("google")}>Google 계정 연결</button>}
      </article>;
    })}</div>}
  </section>;
}
