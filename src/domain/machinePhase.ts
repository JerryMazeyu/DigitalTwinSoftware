/**
 * 机器运行相位判定：把 PLC 实时点位值归类为四类运行状态——
 *   idle(闲置) / pump(抽真空) / pump+winding(抽真空+卷绕) / pump+winding+coating(抽真空+卷绕+镀膜)
 *
 * 判定基于三类独立的布尔事实（任一满足即该层激活）：
 *   1. 真空   —— 任一抽气流程码 ≠ 0 或任一路高真空到位位为真
 *   2. 卷绕   —— 任一收/放卷轴实际速度的绝对值超过阈值（单位 m/min）
 *   3. 镀膜   —— 任一溅射电源实际功率超过阈值（单位 W）
 *
 * 相位按优先级收敛：三者同时为真 → 最高级；有真空 + 卷绕（但镀膜未起）→
 * 中间级；仅真空 → 最低级；否则全部落空 → 闲置。
 *
 * PLC 返回值可能是 number / boolean / string / undefined（首次轮询前），
 * 解析函数一律兜底为 0 / false，保证判定在任何数据形态下都健壮。
 * 订阅用的符号集固定不随 UI 状态（锚点开关 / 腔室选择）变化——见 TwinMachine3D。
 *
 * === 临时调试覆盖（端到端验证用） ===
 * 想临时把判定固定成某一个相位、观察「15s 空闲 → 相机复位 + 视频轮播」
 * 的端到端行为？详见文件下方 `MACHINE_PHASE_OVERRIDE`：在项目根
 * `.env.local` 写入 `VITE_MACHINE_PHASE=pump` 等 4 个合法值之一即可。
 * Vite 自动加载、`.gitignore` 默认忽略，验证完删掉那一行恢复真实数据。
 */
export type MachinePhase = "idle" | "pump" | "pump+winding" | "pump+winding+coating";

/** 高真空到位位（Boolean）：任一为真即说明腔体已进入高真空。 */
export const PHASE_HIVAC_SYMBOLS = [
  "dbVacOpStatus_bChbHiVac1",
  "dbVacOpStatus_bChbHiVac2",
  "dbVacOpStatus_bChbHiVac3"
] as const;

/** 抽气流程状态码（Short）：任一 ≠ 0 即说明对应室正在执行抽气流程。 */
export const PHASE_AUTOPUMP_SYMBOLS = [
  "dbVacOpStatus_nAutoPumpStatus",
  "dbVacOpStatus_nAutoPumpStatusB",
  "dbVacOpStatus_nAutoPumpStatusC"
] as const;

/** 真空判定需要订阅的全部符号。 */
export const PHASE_VACUUM_SYMBOLS = [
  ...PHASE_HIVAC_SYMBOLS,
  ...PHASE_AUTOPUMP_SYMBOLS
] as const;

/** 卷绕判定：5 根轴的 HMI 实际转速（数值，m/min）。 */
export const PHASE_WINDING_SYMBOLS = [
  "HMI_Act_Vel_Axis_1",
  "HMI_Act_Vel_Axis_2",
  "HMI_Act_Vel_Axis_3",
  "HMI_Act_Vel_Axis_4",
  "HMI_Act_Vel_Axis_5"
] as const;

/** 镀膜判定：6 路溅射电源实际功率（数值，W）。 */
export const PHASE_COATING_SYMBOLS = [
  "dbHtg_fPower_Actual[0]",
  "dbHtg_fPower_Actual[1]",
  "dbHtg_fPower_Actual[2]",
  "dbHtg_fPower_Actual[3]",
  "dbHtg_fPower_Actual[4]",
  "dbHtg_fPower_Actual[5]"
] as const;

/** 固定订阅集：相位判定独立于 UI 的锚点开关 / 腔室选择。 */
export const PHASE_ALL_SYMBOLS = [
  ...PHASE_VACUUM_SYMBOLS,
  ...PHASE_WINDING_SYMBOLS,
  ...PHASE_COATING_SYMBOLS
] as const;

/** 卷绕轴速度阈值（m/min）：|速度| 超过它才算「在卷绕」。 */
export const WINDING_SPEED_THRESHOLD = 0.05;
/** 溅射电源功率阈值（W）：超过它才算「在镀膜」。 */
export const COATING_POWER_THRESHOLD = 50;

/**
 * 运行态 → 视频文件（public/videos/ 下的内循环素材）。
 * 闲置态（idle）无视频素材、也不播放，故用 Exclude 排除掉。
 */
export const PHASE_VIDEO: Record<Exclude<MachinePhase, "idle">, string> = {
  pump: "/videos/pumping.mp4",
  "pump+winding": "/videos/pumping_winding.mp4",
  "pump+winding+coating": "/videos/pumping_winding_coating.mp4"
};

/** 把任意 PLC 值归一化为有限数值：number/boolean/string 都能吃，undefined→0。 */
export function toNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** 把任意 PLC 值归一化为布尔：覆盖 true/假值字符串、1/0，undefined→false。 */
export function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    if (v === "true" || v === "1") return true;
    if (v === "false" || v === "0") return false;
    const n = Number(v);
    return Number.isFinite(n) && n !== 0;
  }
  return false;
}

/**
 * 把 usePlcSensors 的多个 bySymbol（`{symbol: {value}}`）摊平成 `{symbol: value}`
 * 的扁平表，方便 classifyMachinePhase 按符号直接读取。后出现的 map 覆盖同名符号。
 */
export function valuesFromSymbolMaps(
  ...maps: Array<Record<string, { value: unknown }>>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const map of maps) {
    for (const [sym, item] of Object.entries(map)) {
      out[sym] = item.value;
    }
  }
  return out;
}

/**
 * 断言运行相位。任一层判定符号缺失时该层视为不激活（呈乐观闲置），
 * 因此 PLC 断连 / 首次轮询未返回时只会误判为 idle，不会误播「运行中」。
 */
/**
 * 端到端调试覆盖：读 Vite 环境变量 VITE_MACHINE_PHASE，把判定固定成某一
 * 个相位，用于临时验证「15s 空闲 → 相机复位 + 视频轮播」的端到端行为。
 * 留空 / 未设 / 不在合法值集合 → 走真实 PLC 数据。
 *
 * 用法（在项目根创建或修改 `.env.local`，Vite 会自动加载、`.gitignore` 已默认忽略）：
 *   VITE_MACHINE_PHASE=pump                     # 强制判定为「抽真空」
 *   VITE_MACHINE_PHASE=pump+winding             # 强制判定为「抽真空+卷绕」
 *   VITE_MACHINE_PHASE=pump+winding+coating     # 强制判定为「抽真空+卷绕+镀膜」
 *   VITE_MACHINE_PHASE=idle                     # 强制判定为「闲置」
 * 验证完删掉这一行即可恢复真实数据驱动。
 */
const VALID_PHASE_OVERRIDES: ReadonlySet<MachinePhase> = new Set([
  "idle",
  "pump",
  "pump+winding",
  "pump+winding+coating"
]);

function readMachinePhaseOverride(): MachinePhase | null {
  try {
    const env = (import.meta as unknown as { env?: Record<string, unknown> & { DEV?: boolean } }).env;
    const raw = env?.VITE_MACHINE_PHASE;
    const isDev = env?.DEV === true;
    if (typeof raw !== "string") return null;
    if (VALID_PHASE_OVERRIDES.has(raw as MachinePhase)) {
      // dev 模式启动时打一次：让用户在 console 一眼看到 override 是否生效，
      // 避免再次踩到拼写错误。prod 构建不打印（避免污染生产 console）。
      if (isDev) console.info(`[machinePhase] VITE_MACHINE_PHASE override active: ${raw}`);
      return raw as MachinePhase;
    }
    if (isDev) {
      console.warn(
        `[machinePhase] VITE_MACHINE_PHASE="${raw}" 是非法值；应为 idle | pump | pump+winding | pump+winding+coating 之一；已忽略并走真实数据。`
      );
    }
    return null;
  } catch {
    return null;
  }
}

export const MACHINE_PHASE_OVERRIDE: MachinePhase | null = readMachinePhaseOverride();

/**
 * 相位 → 中文标签（界面展示用）。
 * 复合相位只显示最高层级的中文简称（"抽真空" 蕴含于 pump、pump+winding、
 * pump+winding+coating；"卷绕" 是 pump+winding 的新增层；"镀膜" 是
 * pump+winding+coating 的新增层），让徽章文本更清爽。
 */
export const PHASE_LABEL: Record<MachinePhase, string> = {
  "idle": "闲置",
  "pump": "抽真空",
  "pump+winding": "卷绕",
  "pump+winding+coating": "镀膜"
};

export function classifyMachinePhase(values: Record<string, unknown>): MachinePhase {
  // 调试覆盖：设置环境变量后直接返回目标相位，绕过 PLC 真实值。
  if (MACHINE_PHASE_OVERRIDE) return MACHINE_PHASE_OVERRIDE;
  const vacuumActive =
    PHASE_HIVAC_SYMBOLS.some((s) => toBool(values[s])) ||
    PHASE_AUTOPUMP_SYMBOLS.some((s) => toNumber(values[s]) !== 0);
  const windingActive = PHASE_WINDING_SYMBOLS.some(
    (s) => Math.abs(toNumber(values[s])) > WINDING_SPEED_THRESHOLD
  );
  const coatingActive = PHASE_COATING_SYMBOLS.some(
    (s) => toNumber(values[s]) > COATING_POWER_THRESHOLD
  );

  if (vacuumActive && windingActive && coatingActive) return "pump+winding+coating";
  if (vacuumActive && windingActive) return "pump+winding";
  if (vacuumActive) return "pump";
  return "idle";
}