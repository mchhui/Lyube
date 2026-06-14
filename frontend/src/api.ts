export interface Entry {
  id: number;
  task_name: string;
  duration_seconds: number | null;
  notes: string | null;
  recorded_date: string;
}

export interface LlmExportPayload {
  数据说明: {
    来源: string;
    记录方式: string;
    "给 AI 的提示": string;
    导出时间: string;
  };
  记录概况: {
    总条数: number;
    有记录天数: number;
    日期范围: string | null;
    累计耗时: string;
    按事情汇总: Array<{
      事情: string;
      次数: number;
      累计耗时?: string;
      耗时占比?: string;
    }>;
  };
  按日记录: Array<{
    日期: string;
    日期描述: string;
    当日合计: string;
    记录: Array<{
      事情: string;
      耗时: string;
      想法?: string;
    }>;
  }>;
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

  exportEntries: () => request<LlmExportPayload>("/entries/export"),

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
