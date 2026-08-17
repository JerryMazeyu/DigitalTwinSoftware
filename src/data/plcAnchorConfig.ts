/**
 * PLC 数据点的 3D 锚点配置。
 *
 * 每个条目声明：
 *   - 要轮询的 PLC 标签（plcSymbol——PLC_SENSOR_META 的外键）；
 *   - 标签在 GLB 上的锚点位置（worldPosition，单位 R3F 世界坐标）；
 *   - 开关面板分组的逻辑部件 ID（partId）；
 *   - 开关面板分桶的类别（categoryEn）；
 *   - 以及优先级开关 defaultVisible。设为 false 时，该条目既不会被轮询、
 *     也不会渲染、也不会出现在面板里（配置 > 开关面板）。
 *
 * 位置都是种子值，调位置直接改这里——不需要碰 UI 代码。GLB 缩放 +
 * Y 抬升之后的世界坐标范围：
 *   X ∈ [-4.4, +4.4]  (长轴)
 *   Y ∈ [ 1.03, 2.76] (机架底部 → 腔体顶部)
 *   Z ∈ [-1.0, +1.0]  (后 ↔ 前)
 *
 * 之前的单挂载参考点在 worldPosition=[0, 1.1, 0] + offset=[0, 1.0, 0]
 * （即 src/components/TwinMachine3D.tsx 历史上那一行；当前已移除）。
 */

export type AnchorWorldPosition = [number, number, number];

export type PlcAnchorCategory =
  | "VacuumGauge"
  | "TemperatureOrColdTrap"
  | "IonSourceActual"
  | "SputterPowerActual"
  | "WindingActual";

export type PlcAnchorConfigEntry = {
  /** 与 PlcSensorMeta.plcSymbol 对应的规范 PLC 符号。 */
  plcSymbol: string;
  /** 用于分组的逻辑部件 ID（如 "Roller_Unwind"、"Gauge_G1"）。 */
  partId: string;
  /** 开关面板分组的类别。 */
  categoryEn: PlcAnchorCategory;
  /** 可选的显示名覆盖，默认回退到 PlcSensorMeta.cnName。 */
  cnName?: string;
  /** R3F 世界坐标系下的锚点。 */
  worldPosition: AnchorWorldPosition;
  /** 标签向上浮起的偏移量，默认 [0, 0.2, 0]。 */
  offset?: AnchorWorldPosition;
  /**
   * 配置 > 开关面板：设为 false 时，该条目既不会被轮询、也不会渲染、
   * 还不会出现在开关面板里。
   */
  defaultVisible: boolean;
};

// ---------- Sputter power actuals (6) ----------
// 溅射电源 1–6 实际功率——沿电源架（后排）排列，Y 靠近电源架顶部
//（世界坐标 ~1.7），Z 在腔体后方。
const sputter: PlcAnchorConfigEntry[] = [
  { plcSymbol: "dbHtg_fPower_Actual[0]", partId: "PowerSupply_SP1", categoryEn: "SputterPowerActual", worldPosition: [-3.2, 1.7, -0.7], defaultVisible: true },
  { plcSymbol: "dbHtg_fPower_Actual[1]", partId: "PowerSupply_SP2", categoryEn: "SputterPowerActual", worldPosition: [-1.9, 1.7, -0.7], defaultVisible: true },
  { plcSymbol: "dbHtg_fPower_Actual[2]", partId: "PowerSupply_SP3", categoryEn: "SputterPowerActual", worldPosition: [-0.6, 1.7, -0.7], defaultVisible: true },
  { plcSymbol: "dbHtg_fPower_Actual[3]", partId: "PowerSupply_SP4", categoryEn: "SputterPowerActual", worldPosition: [ 0.6, 1.7, -0.7], defaultVisible: true },
  { plcSymbol: "dbHtg_fPower_Actual[4]", partId: "PowerSupply_SP5", categoryEn: "SputterPowerActual", worldPosition: [ 1.9, 1.7, -0.7], defaultVisible: true },
  { plcSymbol: "dbHtg_fPower_Actual[5]", partId: "PowerSupply_SP6", categoryEn: "SputterPowerActual", worldPosition: [ 3.2, 1.7, -0.7], defaultVisible: true }
];

// ---------- Winding actuals (11) ----------
// 卷绕轴速度 1–5、张力 1–4、收/放卷半径——沿长 X 轴在辊轮高度
//（世界坐标 Y ≈ 1.0）分布，Z 靠近模型前方，让标签浮在辊轮上方。
const winding: PlcAnchorConfigEntry[] = [
  // 5 个轴速度（X 在机架上均匀分布）
  { plcSymbol: "HMI_Act_Vel_Axis_1", partId: "Axis_1", categoryEn: "WindingActual", worldPosition: [-3.6, 1.0, 0.6], defaultVisible: true },
  { plcSymbol: "HMI_Act_Vel_Axis_2", partId: "Axis_2", categoryEn: "WindingActual", worldPosition: [-2.4, 1.0, 0.6], defaultVisible: true },
  { plcSymbol: "HMI_Act_Vel_Axis_3", partId: "Axis_3", categoryEn: "WindingActual", worldPosition: [-1.2, 1.0, 0.6], defaultVisible: true },
  { plcSymbol: "HMI_Act_Vel_Axis_4", partId: "Axis_4", categoryEn: "WindingActual", worldPosition: [ 1.2, 1.0, 0.6], defaultVisible: true },
  { plcSymbol: "HMI_Act_Vel_Axis_5", partId: "Axis_5", categoryEn: "WindingActual", worldPosition: [ 3.6, 1.0, 0.6], defaultVisible: true },
  // 4 个张力（前侧，Y 较低让标签贴在膜上）
  { plcSymbol: "Tension_1", partId: "Roller_TensionFro", categoryEn: "WindingActual", worldPosition: [-2.7, 0.6, 0.7], defaultVisible: true },
  { plcSymbol: "Tension_2", partId: "Roller_TensionFro_2", categoryEn: "WindingActual", worldPosition: [-0.9, 0.6, 0.7], defaultVisible: true },
  { plcSymbol: "Tension_3", partId: "Roller_TensionBak", categoryEn: "WindingActual", worldPosition: [ 0.9, 0.6, 0.7], defaultVisible: true },
  { plcSymbol: "Tension_4", partId: "Roller_TensionBak_2", categoryEn: "WindingActual", worldPosition: [ 2.7, 0.6, 0.7], defaultVisible: true },
  // 2 个半径（卷筒，位于两端）
  { plcSymbol: "HMI_Act_Wind_R",   partId: "Roller_Wind",   categoryEn: "WindingActual", worldPosition: [ 3.7, 0.9, 0.4], defaultVisible: true },
  { plcSymbol: "HMI_Act_Unwind_R", partId: "Roller_Unwind", categoryEn: "WindingActual", worldPosition: [-3.7, 0.9, 0.4], defaultVisible: true }
];

// ---------- Ion source actuals (2) ----------
// 离子源电流 / 电压反馈——浮在机器中心上方。
const ionSource: PlcAnchorConfigEntry[] = [
  { plcSymbol: "dbEvapSwitch_fIONCur", partId: "IonSource", categoryEn: "IonSourceActual", worldPosition: [0, 2.5, 0.6], defaultVisible: true },
  { plcSymbol: "dbEvapSwitch_fIONVol", partId: "IonSource", categoryEn: "IonSourceActual", worldPosition: [0, 2.5, 0.6], offset: [0.55, 0, 0], defaultVisible: true }
];

// ---------- Vacuum gauges (26) ----------
// 真空规 G1–G26——沿 X 轴在腔体高度分布，Z 前后交替以保持标签可读。
// defaultVisible: false 表示开关面板不会列出这些（配置 > 开关面板）；
// 位置确定后改回 true 即可纳入面板。
const vacuumGauges: PlcAnchorConfigEntry[] = Array.from({ length: 26 }, (_, i) => {
  const x = -3.4 + (i / 25) * 6.8;                       // 在机架上均匀分布
  const z = i % 2 === 0 ? 0.6 : -0.6;                    // 前后交替
  const gaugeNo = i + 1;
  return {
    plcSymbol: `dbGauge_fData[${i}]`,
    partId: `Gauge_G${gaugeNo}`,
    categoryEn: "VacuumGauge" as const,
    worldPosition: [x, 1.4, z] as AnchorWorldPosition,
    defaultVisible: false
  };
});

// ---------- Temperature / cold trap (3) ----------
// 温度 · 冷捕集——主辊温度反馈 (PolyCold), 预加热 1/2 (Heater_H1/H2)。
const tempColdTrap: PlcAnchorConfigEntry[] = [
  { plcSymbol: "dbMaRollPar_fTemp", partId: "PolyCold",  categoryEn: "TemperatureOrColdTrap", worldPosition: [-2.5, 1.0, 0.0], defaultVisible: true },
  { plcSymbol: "dbHf_ParPV1",       partId: "Heater_H1", categoryEn: "TemperatureOrColdTrap", worldPosition: [-1.0, 1.5, 0.6], defaultVisible: true },
  { plcSymbol: "dbHf_ParPV2",       partId: "Heater_H2", categoryEn: "TemperatureOrColdTrap", worldPosition: [ 1.0, 1.5, 0.6], defaultVisible: true }
];

export const PLC_ANCHOR_CONFIG: PlcAnchorConfigEntry[] = [
  ...sputter,
  ...winding,
  ...ionSource,
  ...vacuumGauges,
  ...tempColdTrap
];

/** 查找工具——渲染层用 plcSymbol 反查对应的锚点配置。 */
export const PLC_ANCHOR_BY_SYMBOL: ReadonlyMap<string, PlcAnchorConfigEntry> = new Map(
  PLC_ANCHOR_CONFIG.map((entry) => [entry.plcSymbol, entry])
);