import { AlertTriangle, Boxes, ImageOff, Layers3, ScanLine } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { CameraFrame, DetectionResult, RiskLevel, SimulationMode } from "../domain/models";

type LineScanViewerProps = {
  frame: CameraFrame;
  detections: DetectionResult[];
  riskLevel: RiskLevel;
  mode: SimulationMode;
};

const defectLabel: Record<DetectionResult["defectClass"], string> = {
  foreign: "异物",
  residue: "残留物",
  scratch: "划痕",
  pollution: "污染",
  breakage: "破损",
  wrinkle: "褶皱"
};

const severityLabel: Record<DetectionResult["severity"], string> = {
  low: "低",
  medium: "中",
  high: "高",
  critical: "严重"
};

export function LineScanViewer({ frame, detections, riskLevel, mode }: LineScanViewerProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const offline = mode === "camera-offline";

  useEffect(() => {
    setImageFailed(false);
  }, [frame.imageUrl]);

  const queue = useMemo(() => Array.from({ length: 6 }, (_, index) => (Number(frame.frameId.slice(-2)) + index) % 6), [frame.frameId]);

  return (
    <section className="panel scan-panel" aria-label="实时线扫图像">
      <div className="panel-header">
        <div>
          <h2>实时线扫图像</h2>
          <p>{frame.cameraId} / {frame.linePosition} / {new Date(frame.capturedAt).toLocaleTimeString("zh-CN", { hour12: false })}</p>
        </div>
        <div className="scan-tools">
          <span><Layers3 size={15} />热力层</span>
          <span><Boxes size={15} />缺陷框</span>
          <span><ScanLine size={15} />帧质 {Math.round(frame.quality * 100)}%</span>
        </div>
      </div>
      <div className={`scan-viewport risk-${riskLevel}`}>
        {!offline && !imageFailed ? (
          <img src={frame.imageUrl} alt="线扫相机最新帧" onError={() => setImageFailed(true)} />
        ) : (
          <div className="scan-fallback">
            {offline ? <ImageOff size={36} /> : <AlertTriangle size={36} />}
            <strong>{offline ? "相机离线" : "图像加载失败"}</strong>
            <span>界面保留状态面板和告警，不阻塞其他实时数据</span>
          </div>
        )}
        {!offline && !imageFailed && <div className="heat-layer" />}
        {!offline && !imageFailed && detections.map((detection, index) => (
          <div
            className={`defect-box severity-${detection.severity}`}
            key={`${detection.frameId}-${detection.defectClass}-${index}`}
            style={{
              left: `${detection.bbox.x * 100}%`,
              top: `${detection.bbox.y * 100}%`,
              width: `${detection.bbox.width * 100}%`,
              height: `${detection.bbox.height * 100}%`
            }}
          >
            <span>{defectLabel[detection.defectClass]} {Math.round(detection.confidence * 100)}%</span>
          </div>
        ))}
      </div>
      <div className="frame-strip" aria-label="最新帧队列">
        {queue.map((frameIndex, index) => (
          <div className={index === 0 ? "frame-thumb active" : "frame-thumb"} key={`${frame.frameId}-${frameIndex}-${index}`}>
            <img src={`/demo-frames/frame-${frameIndex}.svg`} alt={`最近帧 ${index + 1}`} />
          </div>
        ))}
      </div>
      <div className="defect-summary">
        {detections.length === 0 ? (
          <div className="empty-row">当前帧无有效检测结果</div>
        ) : detections.map((detection, index) => (
          <div className="defect-row" key={`${detection.frameId}-summary-${index}`}>
            <strong>{defectLabel[detection.defectClass]}</strong>
            <span>置信度 {Math.round(detection.confidence * 100)}%</span>
            <span>严重度 {severityLabel[detection.severity]}</span>
            <span>{detection.algorithmVersion}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
