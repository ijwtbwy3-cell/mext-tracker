/**
 * Клиентский API. Один и тот же код для обеих сборок:
 *   web     — обычные маршруты Next.js (Drizzle + PostgreSQL)
 *   offline — fetch('/api/...') перехватывается fetch-bridge -> sql.js
 */

import type {
  BackupV1,
  BootstrapPayload,
  CompleteTaskResult,
  DiaryRow,
  TopicStatus,
} from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (res.status === 401) throw new ApiError("UNAUTHORIZED", 401);
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Ошибка ${res.status}`;
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

export const api = {
  auth: (passphrase: string) =>
    request<{ ok: boolean }>("/api/auth", { method: "POST", body: JSON.stringify({ passphrase }) }),

  logout: () => request<{ ok: boolean }>("/api/auth", { method: "DELETE" }),

  bootstrap: () => request<BootstrapPayload>("/api/bootstrap"),

  completeTask: (taskId: string, spentMin?: number) =>
    request<CompleteTaskResult>("/api/tasks/complete", {
      method: "POST",
      body: JSON.stringify({ taskId, spentMin }),
    }),

  reopenTask: (taskId: string) =>
    request<{ totals: BootstrapPayload["totals"] }>("/api/tasks/reopen", {
      method: "POST",
      body: JSON.stringify({ taskId }),
    }),

  setTopicStatus: (topicId: string, status: TopicStatus) =>
    request<{ ok: boolean }>("/api/progress", {
      method: "POST",
      body: JSON.stringify({ topicId, status }),
    }),

  addDiary: (entry: { date: string; mood: number; text: string }) =>
    request<DiaryRow>("/api/diary", { method: "POST", body: JSON.stringify(entry) }),

  updateDiary: (id: string, patch: { date?: string; mood?: number; text?: string }) =>
    request<DiaryRow>("/api/diary", { method: "PUT", body: JSON.stringify({ id, ...patch }) }),

  deleteDiary: (id: string) =>
    request<{ ok: boolean }>("/api/diary", { method: "DELETE", body: JSON.stringify({ id }) }),

  setSetting: (key: string, value: string) =>
    request<{ ok: boolean }>("/api/settings", { method: "POST", body: JSON.stringify({ key, value }) }),

  backup: () => request<BackupV1>("/api/backup"),

  restore: (backup: BackupV1) =>
    request<{ ok: boolean }>("/api/restore", { method: "POST", body: JSON.stringify(backup) }),

  reset: () => request<{ ok: boolean }>("/api/reset", { method: "POST", body: JSON.stringify({}) }),
};
