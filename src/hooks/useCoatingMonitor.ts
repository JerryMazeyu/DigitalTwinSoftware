import { useEffect, useMemo, useState } from "react";

import { fetchJobs, openJobEventSource } from "../api/coatingApi";
import { jobKey, type CoatingJob, type JobsPayload, type MonitorHealth } from "../domain/coatingJobs";

type ConnectionState = "connecting" | "live" | "polling" | "offline";

type MonitorState = {
  jobs: CoatingJob[];
  health: MonitorHealth | null;
  loading: boolean;
  error: string | null;
  connection: ConnectionState;
  lastEventAt: string | null;
};

export const useCoatingMonitor = () => {
  const [state, setState] = useState<MonitorState>({
    jobs: [],
    health: null,
    loading: true,
    error: null,
    connection: "connecting",
    lastEventAt: null
  });

  useEffect(() => {
    const abortController = new AbortController();

    const applyPayload = (payload: JobsPayload, connection: ConnectionState) => {
      setState({
        jobs: payload.jobs,
        health: payload.health,
        loading: false,
        error: null,
        connection,
        lastEventAt: new Date().toISOString()
      });
    };

    const refresh = async (connection: ConnectionState) => {
      try {
        const payload = await fetchJobs(abortController.signal);
        applyPayload(payload, connection);
      } catch (error) {
        if (abortController.signal.aborted) return;
        setState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : "无法连接本地监控服务",
          connection: "offline"
        }));
      }
    };

    void refresh("connecting");

    let eventSource: EventSource | null = null;
    try {
      eventSource = openJobEventSource();
      eventSource.addEventListener("jobs", (event) => {
        const payload = JSON.parse((event as MessageEvent<string>).data) as JobsPayload;
        applyPayload(payload, "live");
      });
      eventSource.onerror = () => {
        setState((current) => ({ ...current, connection: "polling" }));
      };
    } catch {
      setState((current) => ({ ...current, connection: "polling" }));
    }

    const intervalId = window.setInterval(() => {
      void refresh(eventSource?.readyState === EventSource.OPEN ? "live" : "polling");
    }, 5000);

    return () => {
      abortController.abort();
      window.clearInterval(intervalId);
      eventSource?.close();
    };
  }, []);

  const jobsByKey = useMemo(() => new Map(state.jobs.map((job) => [jobKey(job), job])), [state.jobs]);

  return { ...state, jobsByKey };
};
