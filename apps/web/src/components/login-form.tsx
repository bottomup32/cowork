"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "../lib/api";

type LoginInput = { email: string; password: string };
type LoginAction = (input: LoginInput) => Promise<unknown>;

const defaultLogin: LoginAction = ({ email, password }) =>
  apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });

export function LoginForm({ login = defaultLogin, refreshSession }: { login?: LoginAction; refreshSession: () => Promise<void> }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(false);
    try {
      await login({ email, password });
      await refreshSession();
      router.replace("/");
      router.refresh();
    } catch {
      setPassword("");
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium">이메일</label>
        <input id="email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-white px-3 py-2.5" required />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium">비밀번호</label>
        <input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-white px-3 py-2.5" required />
      </div>
      {error ? <p role="alert" className="text-sm text-[var(--danger)]">이메일 또는 비밀번호를 확인해 주세요.</p> : null}
      <button type="submit" className="button-primary w-full px-4 py-3" disabled={submitting}>
        로그인
      </button>
    </form>
  );
}
