import { PHASE_VIDEO, type MachinePhase } from "../domain/machinePhase";

type MachinePhaseVideoProps = {
  /** 当前机器运行相位（由 PLC 实时值判定）。 */
  phase: MachinePhase;
  /** 是否处于空闲期：false 时不挂载，<video> 卸载即停止并释放资源。 */
  visible: boolean;
};

/**
 * 空闲期的机器状态视频轮播面板：覆盖 3D 镀膜机显示区域（数据面板在
 * 父容器的兄弟节点，天然不遮），按运行相位循环播放对应素材。
 * 闲置（idle）不播视频。
 *
 * 要点：
 * - `key={src}` 强制重挂载：相位切换时从头加载并重新触发 autoplay，
 *   优于直接改 <video src>（后者可能停留旧进度）。
 * - autoplay 必须 muted：muted 是浏览器免手势自动播放的唯一条件。
 * - onLoadedMetadata 把视频原生 videoWidth/videoHeight 写到容器
 *   style.aspectRatio，让容器比例 = 视频原生比 → 视频自然撑满容器
 *   绝不变形。配合 CSS object-fit: contain 做双重保险。
 * - not visible 时 return null 整体卸载，无需手动 pause()。
 */
export function MachinePhaseVideo({ phase, visible }: MachinePhaseVideoProps) {
  if (!visible || phase === "idle") return null;

  const src = PHASE_VIDEO[phase];

  return (
    <div className="machine-phase-video">
      <video
        key={src}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onLoadedMetadata={(e) => {
          // 把视频原生宽高比写到容器，让容器比例 = 视频原生比 →
          // 视频自然撑满容器、绝不变形。CSS 的 object-fit: contain 做兜底。
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