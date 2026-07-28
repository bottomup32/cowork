"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, FolderKanban, GraduationCap, Home, Menu, Plug, ShieldCheck, X } from "lucide-react";

import type { User } from "../lib/types";

const navigation = [
  { label: "Home", href: "/", icon: Home },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "My Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Skills", href: "/skills", icon: GraduationCap },
  { label: "Approvals", href: "/approvals", icon: ShieldCheck },
  { label: "Integrations", href: "/integrations", icon: Plug },
  { label: "Settings", href: "/settings", icon: Menu },
];

export function AppShell({ user, logout, children }: { user: User; logout: () => Promise<void> | void; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const closeDrawer = (restoreFocus = true) => { setOpen(false); if (restoreFocus) toggleRef.current?.focus(); };
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape" && open) closeDrawer(); }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);
  useEffect(() => { if (open) firstLinkRef.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const desktop = window.matchMedia("(min-width: 641px)");
    const closeForDesktop = (event: MediaQueryListEvent) => { if (event.matches) closeDrawer(false); };
    desktop.addEventListener("change", closeForDesktop);
    return () => desktop.removeEventListener("change", closeForDesktop);
  }, []);
  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  const trapFocus = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!open || event.key !== "Tab") return;
    const focusable = drawerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
    if (!focusable?.length) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  const handleLogout = async () => { if (loggingOut) return; setLoggingOut(true); setLogoutError(false); try { await logout(); } catch { setLogoutError(true); setLoggingOut(false); } };

  return <div className="workspace-shell">
    {open ? <button className="sidebar-overlay" aria-label="메뉴 바깥 영역 닫기" onClick={() => closeDrawer()} /> : null}
    <aside ref={drawerRef} onKeyDown={trapFocus} id="workspace-navigation" className={`sidebar ${open ? "sidebar-open" : ""}`} aria-label="주 메뉴">
      <div className="brand"><span className="brand-mark" aria-hidden="true" />Cowork</div>
      <nav>{navigation.map(({ label, href, icon: Icon }, index) => <Link ref={index === 0 ? firstLinkRef : undefined} key={href} href={href} onClick={() => closeDrawer()} className="nav-link" aria-current={isActive(href) ? "page" : undefined}><Icon size={18} strokeWidth={1.8} /><span>{label}</span></Link>)}</nav>
      <div className="sidebar-user"><span className="avatar">{user.displayName.slice(0, 1)}</span><div className="user-copy"><strong>{user.displayName}</strong><span>{user.email}</span></div><button type="button" className="logout" onClick={() => void handleLogout()} disabled={loggingOut}>로그아웃</button>{logoutError ? <p role="alert" className="logout-alert">Unable to log out. Try again.</p> : null}</div>
    </aside>
    <div className="workspace-content"><header className="mobile-header"><button ref={toggleRef} type="button" className="icon-button" aria-label={open ? "메뉴 닫기" : "메뉴 열기"} aria-expanded={open} aria-controls="workspace-navigation" onClick={() => open ? closeDrawer() : setOpen(true)}>{open ? <X /> : <Menu />}</button><span>Cowork</span></header><main>{children}</main></div>
  </div>;
}
