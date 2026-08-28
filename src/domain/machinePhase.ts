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
 * 想临时把判定固定成某一个相位（可选：再钉住镀膜子状态的活跃电源集）、
 * 观察「15s 空闲 → 相机复位 + 视频轮播」的端到端行为？详见文件下方
 * `MACHINE_PHASE_OVERRIDE`：在项目根 `.env.local` 写入
 * `VITE_MACHINE_PHASE=pump` 等 4 个合法相位值之一，镀膜相位还可加
 * `:电源集` 后缀（如 `pump+winding+coating:1+4`）。注意：钉住 coating
 * 但不带后缀时，活跃电源走真实 PLC（连着可能命中视频，没连则无视频）。
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
 * idle 无视频；pump+winding+coating 已细分为子状态视频（见
 * COATING_SUBSTATE_VIDEOS），不再有通用素材，故两者都排除——
 * 类型收窄保证任何试图读 coating 条目的代码直接编译报错。
 */
export const PHASE_VIDEO: Record<Exclude<MachinePhase, "idle" | "pump+winding+coating">, string> = {
  pump: "/videos/pumping.mp4",
  "pump+winding": "/videos/pumping_winding.mp4"
};

/**
 * 视频取景配置：录制角度导致设备在画面中占比偏小，在 contain 基线上
 * 叠加等比 transform: scale 放大——裁剪而非拉伸，宽高比不变；溢出由
 * 容器 overflow: hidden 裁掉。zoom=1 完全恢复原始取景。
 */
export type PhaseVideoFraming = {
  /** 等比放大倍率，≥1；1 = 不裁剪（现状）。 */
  zoom: number;
  /** 画面归一化焦点（0~1）：transform-origin 缩放不动点，0.5/0.5 = 沿中心放大。
   *  全屏下精确对应画面坐标；非全屏含 letterbox 的轴有轻微压缩，微调用。 */
  focusX: number;
  focusY: number;
};

/** 默认取景：1.35× 居中放大（保留约 74% 画面，设备线尺寸放大约 35%）。 */
export const PHASE_VIDEO_FRAMING_DEFAULT: PhaseVideoFraming = {
  zoom: 1.35,
  focusX: 0.5,
  focusY: 0.5
};

/** 每个运行态视频的取景配置；三个素材同机位，共享默认值，需要时单独覆盖。 */
export const PHASE_VIDEO_FRAMING: Record<Exclude<MachinePhase, "idle">, PhaseVideoFraming> = {
  pump: PHASE_VIDEO_FRAMING_DEFAULT,
  "pump+winding": PHASE_VIDEO_FRAMING_DEFAULT,
  "pump+winding+coating": PHASE_VIDEO_FRAMING_DEFAULT
};

/**
 * 镀膜子状态视频：按「哪几路溅射电源在工作」细分。powers 升序，
 * 编号 1..6 对应 dbHtg_fPower_Actual[0..5]。匹配规则为**精确集合相等**
 * ——活跃集恰好等于已知组合才命中；多出任何电源（如 {2,3,5}）算未知
 * 组合，不播视频（露出 3D 模型），但徽章文案仍显示真实状态。
 */
export type CoatingSubstateVideo = {
  readonly powers: readonly number[];
  readonly src: string;
};

export const COATING_SUBSTATE_VIDEOS: readonly CoatingSubstateVideo[] = [
  { powers: [6], src: "/videos/pumping_winding_coating_01.mp4" },
  { powers: [1], src: "/videos/pumping_winding_coating_02.mp4" },
  { powers: [2], src: "/videos/pumping_winding_coating_03.mp4" },
  { powers: [3], src: "/videos/pumping_winding_coating_04.mp4" },
  { powers: [4], src: "/videos/pumping_winding_coating_05.mp4" },
  { powers: [5], src: "/videos/pumping_winding_coating_06.mp4" },
  { powers: [1, 4], src: "/videos/pumping_winding_coating_07.mp4" },
  { powers: [2, 3], src: "/videos/pumping_winding_coating_08.mp4" }
];

/**
 * 幂等规范化签名：去重 + 升序 + "+" 连接（[4,1,4] → "1+4"，空集 → ""）。
 * 视频匹配的 Map key 与徽章文案共用这一个事实来源。
 */
export function coatingSignature(powers: Iterable<number>): string {
  return [...new Set(powers)].sort((a, b) => a - b).join("+");
}

const COATING_VIDEO_BY_SIGNATURE: ReadonlyMap<string, string> = new Map(
  COATING_SUBSTATE_VIDEOS.map((entry) => [coatingSignature(entry.powers), entry.src])
);

/** 活跃电源编号（升序 1..6）：功率严格大于 COATING_POWER_THRESHOLD 才算活跃。 */
export function activeCoatingPowers(values: Record<string, unknown>): number[] {
  const active: number[] = [];
  PHASE_COATING_SYMBOLS.forEach((symbol, i) => {
    if (toNumber(values[symbol]) > COATING_POWER_THRESHOLD) active.push(i + 1);
  });
  return active;
}

/**
 * 解析 `:电源集` 后缀（如 "1+4"）为升序编号数组。
 * 空串 / 纯空白 → null（等价未设置）；**全有或全无**——任一编号非整数
 * 或越出 1..6 → 整体 null，绝不部分接受（部分接受会静默播错视频）。
 * 允许的分隔符：+ , 空格 ; 、。重复编号按集合语义静默去重。
 */
export function parseCoatingPowerSet(raw: unknown): readonly number[] | null {
  if (typeof raw !== "string") return null;
  const tokens = raw.trim().split(/[+,\s;、]+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const set = new Set<number>();
  for (const token of tokens) {
    const n = Number(token);
    if (!Number.isInteger(n) || n < 1 || n > PHASE_COATING_SYMBOLS.length) return null;
    set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

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
 * 个相位（可选：再钉住镀膜子状态的活跃电源集），用于临时验证「15s 空闲 →
 * 相机复位 + 视频轮播」的端到端行为。留空 / 未设 / 相位非法 → 走真实数据。
 *
 * 语法：`<phase>` 或 `<phase>:<电源集>`（后缀仅对 pump+winding+coating 有意义）
 * 用法（在项目根创建或修改 `.env.local`，Vite 会自动加载、`.gitignore` 已默认忽略）：
 *   VITE_MACHINE_PHASE=idle                       # 强制判定为「闲置」
 *   VITE_MACHINE_PHASE=pump                       # 强制判定为「抽真空」
 *   VITE_MACHINE_PHASE=pump+winding               # 强制判定为「抽真空+卷绕」
 *   VITE_MACHINE_PHASE=pump+winding+coating       # 钉镀膜，活跃电源走真实 PLC
 *   VITE_MACHINE_PHASE=pump+winding+coating:1+4   # 钉镀膜 + 钉住 {1,4} → 播 07 视频
 *   VITE_MACHINE_PHASE=pump+winding+coating:3+5   # 未知组合：不播视频露 3D，徽章仍显示
 * 电源段非法时只忽略电源部分（coatingPowers=null），相位覆盖仍生效。
 * 验证完删掉这一行即可恢复真实数据驱动。
 */
export type MachinePhaseOverride = {
  readonly phase: MachinePhase;
  /** `:电源集` 后缀钉住的活跃电源；null = 未指定后缀（coating 态走真实 PLC 功率）。 */
  readonly coatingPowers: readonly number[] | null;
};

const VALID_PHASE_OVERRIDES: ReadonlySet<MachinePhase> = new Set([
  "idle",
  "pump",
  "pump+winding",
  "pump+winding+coating"
]);

/** 纯函数：解析 VITE_MACHINE_PHASE 原始值。相位段非法 → null（整体忽略）。导出便于单测。 */
export function parseMachinePhaseOverride(raw: unknown): MachinePhaseOverride | null {
  if (typeof raw !== "string") return null;
  const colonIndex = raw.indexOf(":");
  const phasePart = (colonIndex === -1 ? raw : raw.slice(0, colonIndex)).trim();
  if (!VALID_PHASE_OVERRIDES.has(phasePart as MachinePhase)) return null;
  const phase = phasePart as MachinePhase;
  if (colonIndex === -1) return { phase, coatingPowers: null };
  // 电源段非法 → coatingPowers=null：相位仍生效，只是不钉子状态。
  return { phase, coatingPowers: parseCoatingPowerSet(raw.slice(colonIndex + 1)) };
}

function readMachinePhaseOverride(): MachinePhaseOverride | null {
  try {
    const env = (import.meta as unknown as { env?: Record<string, unknown> & { DEV?: boolean } }).env;
    // 优先读 process.env：vitest 的 test.env 写的是它，压过 Vite 从开发者
    // 本机 .env.local 注入的 import.meta.env（否则单测结果随本机环境漂移）；
    // 浏览器里 globalThis.process 不存在，自然落到 import.meta.env（.env.local
    // 调试通道不受影响）。
    const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    const raw = processEnv?.VITE_MACHINE_PHASE ?? env?.VITE_MACHINE_PHASE;
    const isDev = env?.DEV === true;
    if (typeof raw !== "string") return null;
    const parsed = parseMachinePhaseOverride(raw);
    if (!parsed) {
      // 空串等价「未设置」，不是配置错误，不打警告。
      if (isDev && raw.trim() !== "") {
        console.warn(
          `[machinePhase] VITE_MACHINE_PHASE="${raw}" 是非法值；应为 idle | pump | pump+winding | pump+winding+coating（可加 :电源集 后缀，如 pump+winding+coating:1+4）之一；已忽略并走真实数据。`
        );
      }
      return null;
    }
    if (isDev) {
      // dev 模式启动时打一次：让用户在 console 一眼看到 override 是否生效，
      // 避免再次踩到拼写错误。prod 构建不打印（避免污染生产 console）。
      if (parsed.phase === "pump+winding+coating" && parsed.coatingPowers) {
        const sig = coatingSignature(parsed.coatingPowers);
        if (!COATING_VIDEO_BY_SIGNATURE.has(sig)) {
          console.warn(
            `[machinePhase] VITE_MACHINE_PHASE 钉住的电源集「${sig}」没有对应视频素材，镀膜态将不播放视频（露出 3D 模型），徽章仍显示该状态。`
          );
        }
      }
      console.info(`[machinePhase] VITE_MACHINE_PHASE override active: ${raw}`);
    }
    return parsed;
  } catch {
    return null;
  }
}

export const MACHINE_PHASE_OVERRIDE: MachinePhaseOverride | null = readMachinePhaseOverride();

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

/**
 * 当前镀膜态应显示的活跃电源集——视频选择与徽章文案的单一事实来源。
 * 相位 override 钉住 coating 且带 `:电源集` 后缀时返回钉住集；否则由
 * 真实 PLC 功率推导。非 coating 相位返回空集。
 */
export function resolveCoatingPowers(phase: MachinePhase, values: Record<string, unknown>): readonly number[] {
  if (phase !== "pump+winding+coating") return [];
  const override = MACHINE_PHASE_OVERRIDE;
  if (override?.phase === "pump+winding+coating" && override.coatingPowers) {
    return override.coatingPowers;
  }
  return activeCoatingPowers(values);
}

/** 单段视频选择结果：phase 与 src 原子配对（phase 保证非 idle），供 MachinePhaseVideo 消费。 */
export type PhaseVideoSelection = {
  readonly phase: Exclude<MachinePhase, "idle">;
  readonly src: string;
};

/**
 * 相位 → 应播放的视频。pump / pump+winding 透传 PHASE_VIDEO；coating 按
 * 活跃电源集精确匹配 COATING_SUBSTATE_VIDEOS。返回 null = 无可播素材
 * （idle / 未知镀膜组合），组件整体不挂载、露出 3D 模型。
 */
export function selectPhaseVideo(phase: MachinePhase, values: Record<string, unknown>): PhaseVideoSelection | null {
  if (phase === "idle") return null;
  if (phase !== "pump+winding+coating") return { phase, src: PHASE_VIDEO[phase] };
  const src = COATING_VIDEO_BY_SIGNATURE.get(coatingSignature(resolveCoatingPowers(phase, values)));
  return src ? { phase, src } : null;
}

/**
 * 相位徽章文案：coating 态动态拼接实际活跃电源（如「镀膜·1+4」）——
 * 未知组合同样显示真实状态；空集（如钉住 coating 但无功率数据）回退纯
 * 「镀膜」。其他相位透传 PHASE_LABEL。
 */
export function phaseDisplayLabel(phase: MachinePhase, values: Record<string, unknown>): string {
  if (phase !== "pump+winding+coating") return PHASE_LABEL[phase];
  const sig = coatingSignature(resolveCoatingPowers(phase, values));
  return sig ? `${PHASE_LABEL[phase]}·${sig}` : PHASE_LABEL[phase];
}

export function classifyMachinePhase(values: Record<string, unknown>): MachinePhase {
  // 调试覆盖：设置环境变量后直接返回目标相位，绕过 PLC 真实值。
  if (MACHINE_PHASE_OVERRIDE) return MACHINE_PHASE_OVERRIDE.phase;
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