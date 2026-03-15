import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { api } from "../api/client.js";
import type { SessionInfo, SessionConfig } from "../api/types.js";

interface SessionState {
  session: SessionInfo | null;
  connecting: boolean;
  error: string | null;
  connect: (config: SessionConfig) => Promise<void>;
  disconnect: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async (config: SessionConfig) => {
    setConnecting(true);
    setError(null);
    try {
      const info = await api.sessions.create(config);
      setSession(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (session) {
      await api.sessions.close(session.id);
      setSession(null);
      setError(null);
    }
  }, [session]);

  return (
    <SessionContext.Provider value={{ session, connecting, error, connect, disconnect }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
