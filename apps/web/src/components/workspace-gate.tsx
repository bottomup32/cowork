"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useSession } from "../lib/session";
import { AppShell } from "./app-shell";

export function WorkspaceGate({ children }: { children: React.ReactNode }) {
  const { user, loading, error, refresh, logout } = useSession();
  const router = useRouter();
  useEffect(() => { if (!loading && !error && !user) router.replace("/login"); }, [error, loading, router, user]);
  if (loading) return <main className="gate-loading" aria-label="작업 공간을 불러오는 중"><div /><div /><div /></main>;
  if (error) return <main className="gate-error"><h1>작업 공간에 연결하지 못했습니다.</h1><p>네트워크 연결을 확인한 뒤 다시 시도해 주세요.</p><button className="button-primary" onClick={() => void refresh()}>다시 시도</button></main>;
  if (!user) return null;
  return <AppShell user={user} logout={logout}>{children}</AppShell>;
}
