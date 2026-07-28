"use client";

import { ClipboardPlus, FileSpreadsheet, ShieldCheck, Sparkles } from "lucide-react";

import { useSession } from "../lib/session";
import { NewTaskComposer } from "./new-task-composer";

const quickCards = [
  { title: "새 작업 만들기", description: "대화형 작업 공간을 시작합니다.", icon: ClipboardPlus, available: true },
  { title: "Excel 파일 업로드", description: "파일 기반 작업은 준비 중입니다.", icon: FileSpreadsheet, available: false },
  { title: "팀 Skills", description: "공용 역량을 연결하는 기능은 준비 중입니다.", icon: Sparkles, available: false },
  { title: "승인 확인", description: "승인 흐름은 준비 중입니다.", icon: ShieldCheck, available: false },
];

export function HomeWorkspace() {
  const { user } = useSession();
  return <div className="home-workspace"><section className="home-intro"><p className="eyebrow">개인 작업 공간</p><h1>{user?.displayName}님, 오늘의 일을 차분히 시작해 볼까요?</h1><p>새 작업을 만들면 필요한 대화와 결과를 한곳에서 이어갈 수 있어요.</p></section><section className="quick-grid" aria-label="빠른 시작">{quickCards.map(({ title, description, icon: Icon, available }) => <article key={title} className="quick-card">{available ? <a href="#new-task" aria-label={`${title}으로 이동`}><Icon size={20} strokeWidth={1.7} /><div><h2>{title}</h2><p>{description}</p></div><span className="available">바로 시작</span></a> : <><Icon size={20} strokeWidth={1.7} /><div><h2>{title}</h2><p>{description}</p></div><span className="pending-chip">준비 중</span></>}</article>)}</section><div id="new-task"><NewTaskComposer /></div></div>;
}
