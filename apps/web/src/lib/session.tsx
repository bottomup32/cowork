"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { ApiError, apiFetch } from "./api";
import type { User } from "./types";

type Session = {
  user: User | null;
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const mounted = useRef(true);
  const requestId = useRef(0);
  const logoutInFlight = useRef(false);
  const logoutPromise = useRef<Promise<void> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    if (logoutInFlight.current) return;
    const currentRequest = ++requestId.current;
    if (mounted.current) { setLoading(true); setError(false); }
    try {
      const nextUser = await apiFetch<User>("/me");
      if (mounted.current && currentRequest === requestId.current) setUser(nextUser);
    } catch (caught) {
      if (mounted.current && currentRequest === requestId.current) {
        setUser(null);
        setError(!(caught instanceof ApiError && caught.status === 401));
      }
    } finally {
      if (mounted.current && currentRequest === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void refresh(); });
  }, [refresh]);

  const logout = useCallback(async () => {
    if (logoutPromise.current) return logoutPromise.current;
    ++requestId.current;
    logoutInFlight.current = true;
    const pending = (async () => {
      try { await apiFetch("/auth/logout", { method: "POST" }); }
      finally {
        logoutInFlight.current = false;
        logoutPromise.current = null;
        if (mounted.current) { setUser(null); setError(false); setLoading(false); }
      }
    })();
    logoutPromise.current = pending;
    return pending;
  }, []);

  const value = useMemo(() => ({ user, loading, error, refresh, logout }), [user, loading, error, refresh, logout]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used within SessionProvider");
  return session;
}
