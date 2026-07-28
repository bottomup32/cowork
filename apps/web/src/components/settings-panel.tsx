"use client";

import { LogOut, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { User } from "../lib/types";

export function SettingsPanel({ user, logout }: { user: User; logout: () => Promise<void> }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [error, setError] = useState(false);
  const handleLogout = async () => { if (pending) return; setPending(true); setError(false); try { await logout(); router.replace("/login"); } catch { setError(true); setPending(false); } };
  return <section className="workspace-page settings-page"><div className="page-heading"><h1>Settings</h1><p>Your current workspace session.</p></div><div className="identity-card"><UserRound aria-hidden="true" size={20} /><div><strong>{user.displayName}</strong><span>{user.email}</span></div></div><button type="button" className="logout-action" onClick={() => void handleLogout()} disabled={pending}><LogOut aria-hidden="true" size={16} />Log out</button>{error ? <p role="alert" className="inline-alert">{"\uB85C\uADF8\uC544\uC6C3\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694."}</p> : null}</section>;
}
