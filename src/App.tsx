import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileJson,
  FolderSearch,
  Gauge,
  GripVertical,
  Image as ImageIcon,
  Layers3,
  Radio,
  RefreshCw,
  Search,
  Server,
  Sparkles
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { API_BASE } from "./api/coatingApi";
import { SensorBoard } from "./components/sensorBoard/SensorBoard";
import { TwinMachine3D } from "./components/TwinMachine3D";
import {
  formatScore,
  formatTime,
  formatVoltage,
  getCropResults,
  getOutputImageEntries,
  getPrimaryInputImage,
  inspectionTypeLabel,
  isLongStripImageSize,
  isReadyJob,
  jobKey,
  resultLevelTone,
  statusLabel,
  type ApiFile,
  type CoatingJob,
  type InspectionType
} from "./domain/coatingJobs";
import { riskLevelFromScore, type MachineStatus, type RiskLevel, type SystemHealth } from "./domain/models";
import { DESKTOP_SPLIT_BOUNDS, ratioFromDrag, splitGridTemplateRows } from "./domain/resizableSplit";
import { useCoatingMonitor } from "./hooks/useCoatingMonitor";

type FilterType = "all" | InspectionType;
type ImageMode = "input" | "output";
type AppTabKey = "machine" | "sensor";

const appTabs: Array<{ key: AppTabKey; label: string }> = [
  { key: "machine", label: "3D 数字孪生" },
  { key: "sensor", label: "PLC 传感器看板" }
];

const connectionText = {
  connecting: "连接中",
  live: "实时推送",
  polling: "轮询同步",
  offline: "服务离线"
};

const typeTone: Record<InspectionType, string> = {
  anomaly: "danger",
  trend: "success"
};

const resultToneClass = (level?: string) => `result-level ${resultLevelTone(level)}`;
const resultChipClass = (level?: string) => `result-chip ${resultLevelTone(level)}`;

const jsonPreview = (value: unknown) => JSON.stringify(value ?? {}, null, 2);

const buildMachineStatus = (
  health: ReturnType<typeof useCoatingMonitor>["health"],
  connection: ReturnType<typeof useCoatingMonitor>["connection"],
  jobs: CoatingJob[]
): MachineStatus => {
  const readyRatio = health?.totalJobs ? (health.readyJobs / Math.max(health.totalJobs, 1)) : 0;
  const latestUpdate = jobs[0]?.updatedAt || health?.lastScanAt || new Date().toISOString();

  return {
    status: connection === "offline" ? "offline" : connection === "polling" ? "warning" : "running",
    lineSpeed: Number((8.6 + readyRatio * 3.2).toFixed(1)),
    tension: Math.round(118 + readyRatio * 18),
    temperature: Number((64 + (health?.anomalyJobs ?? 0) * 0.8).toFixed(1)),
    vacuum: Number((0.082 + readyRatio * 0.011).toFixed(3)),
    power: Number((42 + (health?.trendJobs ?? 0) * 0.6).toFixed(1)),
    recipe: "R2R-Coating-20260702",
    batchId: jobs[0]?.id || "P-drive-monitor",
    rollMaterial: "复合基膜",
    updatedAt: latestUpdate
  };
};

const buildSystemHealth = (
  health: ReturnType<typeof useCoatingMonitor>["health"],
  connection: ReturnType<typeof useCoatingMonitor>["connection"],
  lastEventAt: string | null
): SystemHealth[] => {
  const now = health?.lastScanAt || lastEventAt || new Date().toISOString();
  const apiOnline = connection !== "offline";
  const rootOnline = Boolean(health?.rootExists);

  return [
    {
      node: "ipc",
      online: apiOnline,
      latencyMs: connection === "live" ? 36 : connection === "polling" ? 210 : 0,
      statusText: apiOnline ? "监控服务在线" : "监控服务离线",
      updatedAt: now
    },
    {
      node: "algorithm-server",
      online: apiOnline && Boolean(health?.readyJobs),
      latencyMs: connection === "live" ? 74 : 260,
      statusText: apiOnline ? "算法结果目录同步" : "等待算法服务",
      updatedAt: now
    },
    {
      node: "camera",
      online: rootOnline,
      latencyMs: rootOnline ? 48 : 0,
      statusText: rootOnline ? "图像输入目录可访问" : "图像输入目录不可访问",
      updatedAt: now
    },
    {
      node: "network",
      online: apiOnline,
      latencyMs: connection === "live" ? 18 : connection === "polling" ? 145 : 0,
      statusText: connectionText[connection],
      updatedAt: now
    },
    {
      node: "model-service",
      online: apiOnline && Boolean(health?.trendJobs || health?.anomalyJobs),
      latencyMs: 92,
      statusText: "异常检测 / 趋势预测结果监听",
      updatedAt: now
    },
    {
      node: "coating-machine",
      online: rootOnline && apiOnline,
      latencyMs: 64,
      statusText: rootOnline ? "设备数据链路映射正常" : "只读监控模式",
      updatedAt: now
    }
  ];
};

const deriveRiskLevel = (jobs: CoatingJob[]): RiskLevel => {
  const highestScore = jobs.reduce((max, job) => Math.max(max, typeof job.summary.score === "number" ? job.summary.score * 100 : 0), 0);
  return riskLevelFromScore(highestScore);
};

const Stat = ({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Activity }) => (
  <div className="stat">
    <Icon size={18} />
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

const EmptyState = ({ title, detail }: { title: string; detail: string }) => (
  <div className="empty-state">
    <FolderSearch size={38} />
    <strong>{title}</strong>
    <span>{detail}</span>
  </div>
);

const JobCard = ({ job, active, onSelect }: { job: CoatingJob; active: boolean; onSelect: () => void }) => {
  const title = inspectionTypeLabel[job.type];
  const eventTime = job.summary.timestamp || job.createdAt || job.updatedAt;

  return (
    <button className={active ? "job-card active" : "job-card"} type="button" onClick={onSelect}>
      <div className="job-card-top">
        <span className={`type-chip ${typeTone[job.type]}`}>{title}</span>
        <span className={`status-dot ${job.status}`}>{statusLabel[job.status]}</span>
      </div>
      <strong>{job.id}</strong>
      <div className="job-meta">
        <span><Clock3 size={13} />{formatTime(eventTime)}</span>
        <span><ImageIcon size={13} />输入 {job.inputImages.length}</span>
      </div>
      <div className="job-card-bottom">
        <span className={resultToneClass(job.summary.level)}>{job.summary.level || "等待结果"}</span>
        {typeof job.summary.score === "number" ? <b>{formatScore(job.summary.score)}</b> : <b>{job.summary.sourceImageCount ?? "-"}</b>}
      </div>
    </button>
  );
};

const SummaryPanel = ({ job }: { job: CoatingJob }) => {
  const cropResults = getCropResults(job);
  const [open, setOpen] = useState(false);

  return (
    <section className={`panel summary-panel collapsible-panel ${open ? "is-open" : "is-collapsed"}`}>
      <button
        type="button"
        className="panel-header collapsible-panel-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <div>
          <h2>结果摘要</h2>
          <p>{inspectionTypeLabel[job.type]} / {job.id}</p>
        </div>
        <span className="collapsible-panel-actions">
          {job.summary.level ? (
            <span className={resultChipClass(job.summary.level)}>{job.summary.level}</span>
          ) : (
            <span className={`status-dot ${job.status}`}>{statusLabel[job.status]}</span>
          )}
          <ChevronDown size={14} className="collapsible-panel-chevron" />
        </span>
      </button>

      {open && (
        <>
          <div className="metric-grid">
            <div>
              <span>{job.type === "anomaly" ? "异常得分" : "输入序列"}</span>
              <strong>{job.type === "anomaly" ? formatScore(job.summary.score) : `${job.summary.sourceImageCount ?? job.inputImages.length} 张`}</strong>
            </div>
            <div>
              <span>模拟电压</span>
              <strong>{formatVoltage(job.summary.analogVoltage)}</strong>
            </div>
            <div>
              <span>结果时间</span>
              <strong>{formatTime(job.summary.timestamp)}</strong>
            </div>
            <div>
              <span>{job.type === "anomaly" ? "异常裁片" : "预测文件"}</span>
              <strong>{job.type === "anomaly" ? `${job.summary.abnormalCropCount ?? 0}/${job.summary.cropCount ?? cropResults.length}` : job.outputImages.prediction ? "已生成" : "缺失"}</strong>
            </div>
          </div>

          {job.type === "anomaly" ? (
            <div className="detail-list">
              <div><span>图片类型</span><strong>{job.summary.imageType || "-"}</strong></div>
              <div><span>源文件</span><strong>{job.summary.sourceImage || "-"}</strong></div>
              <div><span>原始尺寸</span><strong>{job.summary.originalSize ? `${job.summary.originalSize[0]} x ${job.summary.originalSize[1]}` : "-"}</strong></div>
              <div><span>裁片数量</span><strong>{(job.summary.cropCount ?? cropResults.length) || "-"}</strong></div>
            </div>
          ) : (
            <div className="detail-list">
              <div><span>预测等级</span><strong className={resultToneClass(job.summary.level)}>{job.summary.level || "-"}</strong></div>
              <div><span>输入图片</span><strong>{job.inputImages.map((file) => file.name).join(", ")}</strong></div>
            </div>
          )}

          {job.missing.length > 0 && (
            <div className="warning-box">
              <AlertTriangle size={16} />
              <span>缺少文件：{job.missing.join(", ")}</span>
            </div>
          )}
        </>
      )}
    </section>
  );
};

const ImagePreview = ({
  file,
  title,
  subtitle,
  longImage = true
}: {
  file?: ApiFile;
  title: string;
  subtitle?: string;
  longImage?: boolean;
}) => {
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const isLongStrip = longImage || Boolean(naturalSize && isLongStripImageSize(naturalSize.width, naturalSize.height));

  useEffect(() => {
    setNaturalSize(null);
  }, [file?.url]);

  if (!file) {
    return <EmptyState title="暂无图片" detail="等待对应输入或输出文件写入完成" />;
  }

  return (
    <div className={isLongStrip ? "image-stage long-image" : "image-stage"}>
      <div className="image-title">
        <div>
          <strong>{title}</strong>
          <span>{subtitle || file.name}{naturalSize ? ` / ${naturalSize.width} x ${naturalSize.height}` : ""}</span>
        </div>
        <a href={`${API_BASE}${file.url}`} target="_blank" rel="noreferrer">原图</a>
      </div>
      <div className="image-scroll">
        <img
          src={`${API_BASE}${file.url}`}
          alt={title}
          onLoad={(event) => {
            setNaturalSize({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight
            });
          }}
        />
      </div>
    </div>
  );
};

const ImageExplorer = ({ job }: { job: CoatingJob }) => {
  const [mode, setMode] = useState<ImageMode>("input");
  const [inputIndex, setInputIndex] = useState(0);
  const [outputKey, setOutputKey] = useState<string | null>(null);
  const outputEntries = getOutputImageEntries(job);

  useEffect(() => {
    setMode("input");
    setInputIndex(0);
    setOutputKey(null);
  }, [job.id, job.type]);

  const selectedInput = job.inputImages[Math.min(inputIndex, Math.max(job.inputImages.length - 1, 0))];
  const selectedOutput = outputEntries.find((entry) => entry.key === outputKey) || outputEntries[0];
  const longImage = true;

  return (
    <section className="panel image-panel">
      <div className="panel-header">
        <div>
          <h2>输入 / 输出图像</h2>
          <p>{mode === "input" ? "算法输入文件" : "算法输出结果图"}</p>
        </div>
        <div className="segmented">
          <button className={mode === "input" ? "active" : ""} type="button" onClick={() => setMode("input")}>
            <ImageIcon size={15} />输入
          </button>
          <button className={mode === "output" ? "active" : ""} type="button" onClick={() => setMode("output")}>
            <Layers3 size={15} />输出
          </button>
        </div>
      </div>

      {mode === "input" ? (
        <>
          <ImagePreview
            file={selectedInput}
            title={job.type === "trend" ? `序列图 ${selectedInput?.name ?? ""}` : "输入原图"}
            subtitle={job.type === "trend" ? `${inputIndex + 1}/${job.inputImages.length}` : selectedInput?.name}
            longImage={longImage}
          />
          {job.inputImages.length > 1 && (
            <div className="thumb-strip">
              {job.inputImages.map((file, index) => (
                <button className={index === inputIndex ? "active" : ""} key={file.name} type="button" onClick={() => setInputIndex(index)}>
                  <img src={`${API_BASE}${file.url}`} alt={file.name} />
                  <span>{file.name}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <ImagePreview file={selectedOutput?.file} title={selectedOutput?.label || "输出图像"} longImage={longImage} />
          {outputEntries.length > 1 && (
            <div className="output-tabs">
              {outputEntries.map((entry) => (
                <button
                  className={(selectedOutput?.key === entry.key) ? "active" : ""}
                  key={entry.key}
                  type="button"
                  onClick={() => setOutputKey(entry.key)}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
};

const CropTable = ({ job }: { job: CoatingJob }) => {
  const cropResults = getCropResults(job);
  const [open, setOpen] = useState(false);
  if (job.type !== "anomaly" || cropResults.length === 0) return null;

  return (
    <section className={`panel crop-panel collapsible-panel ${open ? "is-open" : "is-collapsed"}`}>
      <button
        type="button"
        className="panel-header compact collapsible-panel-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <div>
          <h2>裁片结果</h2>
          <p>按得分排序显示前 12 个裁片</p>
        </div>
        <ChevronDown size={14} className="collapsible-panel-chevron" />
      </button>
      {open && (
        <div className="crop-table">
          {[...cropResults]
            .sort((a, b) => Number(b?.sample_score ?? 0) - Number(a?.sample_score ?? 0))
            .slice(0, 12)
            .map((crop, index) => (
              <div className="crop-row" key={`${crop?.crop_id ?? index}-${index}`}>
                <span>#{crop?.crop_id ?? index}</span>
                <strong>{formatScore(Number(crop?.sample_score ?? 0))}</strong>
                <em className={resultToneClass(typeof crop?.anomaly_level === "string" ? crop.anomaly_level : undefined)}>
                  {typeof crop?.anomaly_level === "string" ? crop.anomaly_level : "-"}
                </em>
              </div>
            ))}
        </div>
      )}
    </section>
  );
};

const JsonPanel = ({ job }: { job: CoatingJob }) => {
  const [open, setOpen] = useState(false);
  return (
    <section className={`panel json-panel collapsible-panel ${open ? "is-open" : "is-collapsed"}`}>
      <button
        type="button"
        className="panel-header compact collapsible-panel-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <div>
          <h2>结构化 JSON</h2>
          <p>request / result 原始字段</p>
        </div>
        <span className="collapsible-panel-actions">
          <FileJson size={19} />
          <ChevronDown size={14} className="collapsible-panel-chevron" />
        </span>
      </button>
      {open && (
        <div className="json-columns">
          <div>
            <strong>request.json</strong>
            <pre>{jsonPreview(job.request)}</pre>
          </div>
          <div>
            <strong>{job.resultFile?.name || "result.json"}</strong>
            <pre>{jsonPreview(job.result)}</pre>
          </div>
        </div>
      )}
    </section>
  );
};

export function App() {
  const { jobs, health, loading, error, connection, lastEventAt } = useCoatingMonitor();
  const [filter, setFilter] = useState<FilterType>("all");
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detailSplitRatio, setDetailSplitRatio] = useState<number>(DESKTOP_SPLIT_BOUNDS.defaultRatio);
  const [splitDragging, setSplitDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTabKey>("machine");
  // 左侧「异常与趋势」结果列表——整侧边栏可折叠，默认展开。
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const splitShellRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ startY: number; startRatio: number; containerHeight: number } | null>(null);

  const filteredJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return jobs.filter((job) => {
      const typeMatch = filter === "all" || job.type === filter;
      const queryMatch = !normalizedQuery || job.id.toLowerCase().includes(normalizedQuery) || (job.summary.level || "").toLowerCase().includes(normalizedQuery);
      return typeMatch && queryMatch;
    });
  }, [filter, jobs, query]);

  const selectedJob = useMemo(() => {
    if (selectedKey) {
      const found = jobs.find((job) => jobKey(job) === selectedKey);
      if (found) return found;
    }
    return filteredJobs[0] || jobs[0] || null;
  }, [filteredJobs, jobs, selectedKey]);

  useEffect(() => {
    if (selectedJob) setSelectedKey(jobKey(selectedJob));
  }, [selectedJob?.id, selectedJob?.type]);

  useEffect(() => {
    if (!splitDragging) return;

    const stopDrag = () => {
      dragStartRef.current = null;
      setSplitDragging(false);
      document.body.classList.remove("split-dragging");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    const onMove = (event: PointerEvent) => {
      const drag = dragStartRef.current;
      if (!drag) return;
      setDetailSplitRatio(ratioFromDrag({
        startRatio: drag.startRatio,
        deltaY: event.clientY - drag.startY,
        containerHeight: drag.containerHeight
      }));
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
      document.body.classList.remove("split-dragging");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [splitDragging]);

  const startDetailResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const shell = splitShellRef.current;
    if (!shell) return;
    const rect = shell.getBoundingClientRect();
    if (rect.height <= 0) return;

    dragStartRef.current = {
      startY: event.clientY,
      startRatio: detailSplitRatio,
      containerHeight: rect.height
    };
    setSplitDragging(true);
    document.body.classList.add("split-dragging");
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const readyJobs = jobs.filter(isReadyJob).length;
  const primaryInput = selectedJob ? getPrimaryInputImage(selectedJob) : undefined;
  const machineStatus = useMemo(() => buildMachineStatus(health, connection, jobs), [connection, health, jobs]);
  const systemHealth = useMemo(() => buildSystemHealth(health, connection, lastEventAt), [connection, health, lastEventAt]);
  const riskLevel = useMemo(() => deriveRiskLevel(jobs), [jobs]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">DT</div>
          <div>
            <h1>镀膜算法结果实时监控台</h1>
            <p>P 盘 input/output 文件流配对展示 / 本地监控服务 {API_BASE}</p>
          </div>
        </div>

        <div className="status-strip">
          <div className={`connection ${connection}`}>
            <Radio size={16} />
            <span>{connectionText[connection]}</span>
          </div>
          <div>
            <span>数据根目录</span>
            <strong>{health?.dataRoot || "P:\\"}</strong>
          </div>
          <div>
            <span>最近扫描</span>
            <strong>{formatTime(health?.lastScanAt || lastEventAt || undefined)}</strong>
          </div>
        </div>
      </header>

      <section className="overview-band">
        <Stat icon={Server} label="任务总数" value={health?.totalJobs ?? jobs.length} />
        <Stat icon={CheckCircle2} label="已就绪" value={health?.readyJobs ?? readyJobs} />
        <Stat icon={AlertTriangle} label="异常检测" value={health?.anomalyJobs ?? jobs.filter((job) => job.type === "anomaly").length} />
        <Stat icon={Sparkles} label="趋势预测" value={health?.trendJobs ?? jobs.filter((job) => job.type === "trend").length} />
      </section>

      {error && (
        <div className="service-warning">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      <nav className="app-tabs" role="tablist" aria-label="主导航">
        {appTabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            className={activeTab === tab.key ? "active" : ""}
            type="button"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "sensor" ? (
        <main className="app-tab-panel">
          <SensorBoard />
        </main>
      ) : (
      <main className="monitor-layout">
        <aside className={`job-sidebar ${sidebarOpen ? "" : "job-sidebar-collapsed"}`}>
          <button
            type="button"
            className="job-sidebar-toggle"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-expanded={sidebarOpen}
            title={sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
          >
            {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            <span className="job-sidebar-toggle-text">异常与趋势</span>
            <em className="job-sidebar-toggle-count">{filteredJobs.length}</em>
          </button>
          {sidebarOpen && (
            <>
              <div className="side-toolbar">
                <div className="search-box">
                  <Search size={15} />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索时间戳或结果" />
                </div>
                <div className="filter-row">
                  {(["all", "anomaly", "trend"] as FilterType[]).map((item) => (
                    <button className={filter === item ? "active" : ""} key={item} type="button" onClick={() => setFilter(item)}>
                      {item === "all" ? "全部" : inspectionTypeLabel[item]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="job-list">
                {loading ? (
                  <EmptyState title="正在扫描 P 盘" detail="等待本地监控服务返回任务列表" />
                ) : filteredJobs.length === 0 ? (
                  <EmptyState title="暂无匹配任务" detail="可以切换筛选条件或等待新的 input/output 配对" />
                ) : (
                  filteredJobs.map((job) => (
                    <JobCard
                      active={selectedJob ? jobKey(selectedJob) === jobKey(job) : false}
                      job={job}
                      key={jobKey(job)}
                      onSelect={() => setSelectedKey(jobKey(job))}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </aside>

        <section className="detail-workspace">
          <div
            className="detail-resize-shell"
            ref={splitShellRef}
            style={{ gridTemplateRows: splitGridTemplateRows(detailSplitRatio) }}
          >
            <section className="detail-pane detail-pane-machine">
              <TwinMachine3D compact machine={machineStatus} riskLevel={riskLevel} health={systemHealth} />
            </section>

            <button
              className={splitDragging ? "split-handle dragging" : "split-handle"}
              type="button"
              aria-label="调整上方 3D 视图和下方结果区域比例"
              onPointerDown={startDetailResize}
            >
              <GripVertical size={16} />
            </button>

            <section className="detail-pane detail-pane-results">
              {selectedJob ? (
                <>
                  <div className="selected-banner">
                    <div>
                      <span className={`type-chip ${typeTone[selectedJob.type]}`}>{inspectionTypeLabel[selectedJob.type]}</span>
                      <h2>{selectedJob.id}</h2>
                      <p>输入图：{primaryInput?.name || "-"} / 输出文件：{selectedJob.outputFiles.length}</p>
                    </div>
                    <div className="banner-metrics">
                      <div>
                        <Gauge size={16} />
                        <span className={resultToneClass(selectedJob.summary.level)}>
                          {selectedJob.summary.level || statusLabel[selectedJob.status]}
                        </span>
                      </div>
                      <div><RefreshCw size={16} />{formatTime(selectedJob.updatedAt)}</div>
                    </div>
                  </div>

                  <div className="detail-grid">
                    <ImageExplorer job={selectedJob} />
                    <SummaryPanel job={selectedJob} />
                    <CropTable job={selectedJob} />
                    <JsonPanel job={selectedJob} />
                  </div>
                </>
              ) : (
                <EmptyState title="没有可展示的数据" detail="请确认 P:\\trend_api 和 P:\\anomaly_api 下存在配对的 input/output 文件夹" />
              )}
            </section>
          </div>
        </section>
      </main>
      )}
    </div>
  );
}
