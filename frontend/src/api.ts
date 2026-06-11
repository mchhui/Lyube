export interface Entry {
  id: number;
  task_name: string;
  duration_seconds: number | null;
  notes: string | null;
  recorded_date: string;
}

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    credentials: "include",
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = err.detail;
    const msg = Array.isArray(detail)
      ? detail.map((d: { msg?: string }) => d.msg).join("；")
      : detail || "请求失败";
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  health: () => request<{ status: string }>("/health"),

  authStatus: () => request<{ authenticated: boolean }>("/auth/status"),

  login: (password: string) =>
    request<{ authenticated: boolean }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  logout: () =>
    request<{ authenticated: boolean }>("/auth/logout", {
      method: "POST",
    }),

  listEntries: (date?: string) =>
    request<Entry[]>(`/entries${date ? `?date=${date}` : ""}`),

  create: (data: {
    task_name: string;
    duration_seconds?: number | null;
    notes?: string | null;
    recorded_date?: string;
  }) =>
    request<Entry>("/entries", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    request<void>(`/entries/${id}`, { method: "DELETE" }),
};
