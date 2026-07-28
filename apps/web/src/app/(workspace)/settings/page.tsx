"use client";
import { SettingsPanel } from "../../../components/settings-panel";
import { useSession } from "../../../lib/session";
export default function SettingsPage() { const { user, logout } = useSession(); return user ? <SettingsPanel user={user} logout={logout} /> : null; }
