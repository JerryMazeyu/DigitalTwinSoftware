import { useEffect, useState } from "react";
import { PHASE_VIDEO, type MachinePhase } from "../domain/machinePhase";

type MachinePhaseVideoProps = {
  /** 当前机器运行相位（由 PLC 实时值判定）。 */
  phase: MachinePhase;
  /** 是否处于空闲期：false 时不挂载，<video> 卸载即停止并释放资源。 */
  visible: boolean;
  /**
   * 是否处于全屏模式：全屏下相机距离更远，回正动画收敛更慢，需要更长延迟。
   * 用于决定挂载视频前的等待时间。
   */
  isFullscreen: boolean;
};

/**
 * 等待时长：相机复位动画收敛需要的缓冲（RESET_DAMPING=6 + RESET_EPSILON=0.02）。
 * 非全屏相机距离 12，回正时间较短；全屏 20，留出更多余量。
 * 设为 0 表示完全跟随 visible——保留导出便于单测。
 */
const VIDEO_MOUNT_DELAY_DEFAULT_MS = 1200;
const VIDEO_MOUNT_DELAY_FULLSCREEN_MS = 1800;

/**
 * 空闲期的机器状态视频轮播面板：覆盖 3D 镀膜机显示区域（数据面板在
 * 父容器的兄弟节点，天然不遮），按运行相位循环播放对应素材。
 * 闲置（idle）不播视频。
 *
 * 要点：
 * - `key={src}` 强制重挂载：相位切换时从头加载并重新触发 autoplay，
 *   优于直接改 <video src>（后者可能停留旧进度）。
 * - autoplay 必须 muted：muted 是浏览器免手势自动播放的唯一条件。
 * - 容器尺寸：
 *     - 非全屏下 .machine-phase-video 高度 = 右侧数据面板高度（同
 *       .machine-canvas-grid 第 1 行 1fr）。视频由 <video> 内部
 *       object-fit: contain 保持原生比 + 完整不裁切，不写 aspectRatio。
 *     - 全屏下走旧行为：JS 在 onLoadedMetadata 时把视频原生 aspectRatio
 *       写入容器（CSS .is-fullscreen 同时给 16/9 兜底），紧贴画布边缘。
 * - not visible 时 return null 整体卸载，无需手动 pause()。
 */
export function MachinePhaseVideo({ phase, visible, isFullscreen }: MachinePhaseVideoProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!visible) {
      // 离开空闲期立即卸载，停止视频并释放资源；同时清掉 pending 计时器。
      setMounted(false);
      return;
    }
    // 空闲期上跳沿：延时挂载视频，给相机复位动画留出回正时间。
    const delay = isFullscreen ? VIDEO_MOUNT_DELAY_FULLSCREEN_MS : VIDEO_MOUNT_DELAY_DEFAULT_MS;
    const id = window.setTimeout(() => setMounted(true), delay);
    return () => window.clearTimeout(id);
  }, [visible, isFullscreen]);

  if (!visible || phase === "idle" || !mounted) return null;

  const src = PHASE_VIDEO[phase];

  return (
    <div className={`machine-phase-video${isFullscreen ? " is-fullscreen" : ""}`}>
      <video
        key={src}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onLoadedMetadata={(e) => {
          // 仅全屏下把视频原生 aspectRatio 写入容器（非全屏容器高度
          // 由 grid 等高驱动，写了反而溢出主格）。
          if (!isFullscreen) return;
          const v = e.currentTarget;
          if (v.videoWidth && v.videoHeight) {
            const parent = v.parentElement;
            if (parent) parent.style.aspectRatio = `${v.videoWidth} / ${v.videoHeight}`;
          }
        }}
        onCanPlay={(e) => {
          // 兜底：部分浏览器在 canplay 后才放行 autoplay 策略。
          e.currentTarget.play().catch(() => {});
        }}
      >
        <source src={src} type="video/mp4" />
      </video>
    </div>
  );
}