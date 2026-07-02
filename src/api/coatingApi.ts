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

export const fetchJobs = async (signal?: AbortSignal) => {
  const response = await fetch(`${API_BASE}/api/jobs`, { signal });
  return parseJsonResponse<JobsPayload>(response);
};

export const fetchJob = async (type: CoatingJob["type"], id: string, signal?: AbortSignal) => {
  const response = await fetch(`${API_BASE}/api/jobs/${type}/${encodeURIComponent(id)}`, { signal });
  return parseJsonResponse<CoatingJob>(response);
};

export const fetchHealth = async (signal?: AbortSignal) => {
  const response = await fetch(`${API_BASE}/api/health`, { signal });
  return parseJsonResponse<MonitorHealth>(response);
};

export const openJobEventSource = () => new EventSource(`${API_BASE}/api/events`);
