"use client";

import { LoginForm } from "../../components/login-form";
import { useSession } from "../../lib/session";

export default function LoginPage() {
  const { refresh } = useSession();
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-sm rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-7 shadow-sm" aria-labelledby="login-title">
        <p className="mb-2 text-sm font-medium text-[var(--text-muted)]">Team Cowork</p>
        <h1 id="login-title" className="mb-6 text-2xl font-semibold tracking-tight">로그인</h1>
        <LoginForm refreshSession={refresh} />
      </section>
    </main>
  );
}
