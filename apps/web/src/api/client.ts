import type {
  SessionConfig, SessionInfo,
  ToolInfo, ToolCallResult,
  ResourceInfo, ResourceContent,
  PromptInfo, PromptResult,
  TimelineEvent,
} from "./types.js";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = await res.json() as unknown;
  if (!res.ok) {
    const msg = (body as { error?: string })?.error ?? res.statusText;
    throw new Error(msg);
  }
  return body as T;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export const api = {
  sessions: {
    list: () => request<SessionInfo[]>("/sessions"),
    create: (config: SessionConfig) => request<SessionInfo>("/sessions", {
      method: "POST",
      body: JSON.stringify(config),
    }),
    get: (id: string) => request<SessionInfo>(`/sessions/${id}`),
    close: (id: string) => fetch(`${BASE}/sessions/${id}`, { method: "DELETE" }),
  },

  // ─── Tools ──────────────────────────────────────────────────────────────────

  tools: {
    list: (sessionId: string) =>
      request<{ tools: ToolInfo[] }>(`/sessions/${sessionId}/tools`),
    call: (sessionId: string, name: string, args: Record<string, unknown>) =>
      request<ToolCallResult>(`/sessions/${sessionId}/tools/call`, {
        method: "POST",
        body: JSON.stringify({ name, args }),
      }),
  },

  // ─── Resources ──────────────────────────────────────────────────────────────

  resources: {
    list: (sessionId: string) =>
      request<{ resources: ResourceInfo[] }>(`/sessions/${sessionId}/resources`),
    read: (sessionId: string, uri: string) =>
      request<{ contents: ResourceContent[] }>(
        `/sessions/${sessionId}/resources/read?uri=${encodeURIComponent(uri)}`
      ),
  },

  // ─── Prompts ────────────────────────────────────────────────────────────────

  prompts: {
    list: (sessionId: string) =>
      request<{ prompts: PromptInfo[] }>(`/sessions/${sessionId}/prompts`),
    get: (sessionId: string, name: string, args?: Record<string, string>) =>
      request<PromptResult>(`/sessions/${sessionId}/prompts/get`, {
        method: "POST",
        body: JSON.stringify({ name, args }),
      }),
  },

  // ─── Timeline ───────────────────────────────────────────────────────────────

  timeline: {
    get: (sessionId: string, since?: number) =>
      request<TimelineEvent[]>(
        `/sessions/${sessionId}/timeline${since ? `?since=${since}` : ""}`
      ),
  },
};
