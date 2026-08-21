import type { CoatingJob, JobsPayload, MonitorHealth } from "../domain/coatingJobs";

const envBase = (import.meta as ImportMeta & { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE;

export const API_BASE = (envBase || "http://127.0.0.1:8787").replace(/\/$/, "");

const parseJsonResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
};

/**
 * 浏览器原生 fetch 在网络层失败时抛 `TypeError: Failed to fetch`，
 * 直接透传到 UI 上对用户毫无意义。统一在这里翻译成中文。
 * AbortError（请求被取消）保持原样，由调用方决定是否忽略。
 */
const fetchWithFriendlyError = async (url: string, endpoint: string, signal?: AbortSignal): Promise<Response> => {
  try {
    return await fetch(url, { signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof TypeError && /Failed to fetch/i.test(error.message)) {
      throw new Error(`无法连接本地监控服务（${API_BASE}${endpoint}），请确认服务已启动`);
    }
    throw error;
  }
};

const requestJson = async <T>(endpoint: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetchWithFriendlyError(`${API_BASE}${endpoint}`, endpoint, signal);
  return parseJsonResponse<T>(response);
};

export const fetchJobs = async (signal?: AbortSignal) => {
  return requestJson<JobsPayload>("/api/jobs", signal);
};

export const fetchJob = async (type: CoatingJob["type"], id: string, signal?: AbortSignal) => {
  return requestJson<CoatingJob>(`/api/jobs/${type}/${encodeURIComponent(id)}`, signal);
};

export const fetchHealth = async (signal?: AbortSignal) => {
  return requestJson<MonitorHealth>("/api/health", signal);
};

export const openJobEventSource = () => new EventSource(`${API_BASE}/api/events`);