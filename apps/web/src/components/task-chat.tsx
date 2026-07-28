"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { Message } from "../lib/types";

export function TaskChat({ taskId, initialMessages, sendMessage }: { taskId: string; initialMessages: Message[]; sendMessage: (content: string) => Promise<Message[]> }) {
  const [messages, setMessages] = useState(initialMessages); const [draft, setDraft] = useState(""); const [error, setError] = useState(""); const [sending, setSending] = useState(false); const generation = useRef(0);
  // A generation is invalidated before a previous task's promise continuation can commit state.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { const current = ++generation.current; setMessages(initialMessages); setDraft(""); setError(""); setSending(false); return () => { generation.current = current + 1; }; }, [taskId]);
  const submit = async (event: FormEvent) => { event.preventDefault(); const content = draft.trim(); if (!content || sending) return; const current = generation.current; setSending(true); setError(""); try { const returned = await sendMessage(content); if (generation.current !== current) return; setMessages((existing) => [...existing, ...returned]); setDraft(""); } catch { if (generation.current === current) setError("메시지를 보내지 못했습니다. 다시 시도해 주세요."); } finally { if (generation.current === current) setSending(false); } };
  return <section className="task-chat" aria-label="작업 대화"><div className="message-list" aria-live="polite">{messages.map((message) => <article className={`message message-${message.role.toLowerCase()}`} key={message.id}><span className="message-role">{message.role}</span><p>{message.content}</p></article>)}</div><form className="chat-composer" onSubmit={submit}><label className="sr-only" htmlFor={`message-${taskId}`}>메시지</label><textarea id={`message-${taskId}`} aria-label="메시지" value={draft} onChange={(event) => setDraft(event.target.value)} disabled={sending} rows={3} placeholder="메시지를 입력하세요" />{error ? <p role="alert" className="inline-alert">{error}</p> : null}<button type="submit" className="button-primary" disabled={sending || !draft.trim()}>{sending ? "보내는 중…" : "보내기"}</button></form></section>;
}
