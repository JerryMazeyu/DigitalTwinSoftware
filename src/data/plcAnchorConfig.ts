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
  // 5 个轴速度 分别对应A1、A2、A3、A4、A5 五个滚子 （已调好）
  { plcSymbol: "HMI_Act_Vel_Axis_1", partId: "Axis_1", categoryEn: "WindingActual", worldPosition: [ 0.75, 0.5, 0.6], defaultVisible: true },
  { plcSymbol: "HMI_Act_Vel_Axis_2", partId: "Axis_2", categoryEn: "WindingActual", worldPosition: [ -4, 0.1, 0.6], defaultVisible: true },
  { plcSymbol: "HMI_Act_Vel_Axis_3", partId: "Axis_3", categoryEn: "WindingActual", worldPosition: [ 4, 0.1, 0.6], defaultVisible: true },
  { plcSymbol: "HMI_Act_Vel_Axis_4", partId: "Axis_4", categoryEn: "WindingActual", worldPosition: [ 1.0, 1.7, 0.6], defaultVisible: true },
  { plcSymbol: "HMI_Act_Vel_Axis_5", partId: "Axis_5", categoryEn: "WindingActual", worldPosition: [ 0.5, 1.7, 0.6], defaultVisible: true },
  // 4 个张力（前侧，Y 较低让标签贴在膜上）分别对应A2、A3、A4、A5 四个滚子 和 A2、A3、A4、A5 四个滚子 数据坐标一致 （已调好）
  { plcSymbol: "Tension_1", partId: "Roller_TensionFro", categoryEn: "WindingActual", worldPosition: [-4, 0.1, 0.6], defaultVisible: true },
  { plcSymbol: "Tension_2", partId: "Roller_TensionFro_2", categoryEn: "WindingActual", worldPosition: [4, 0.1, 0.6], defaultVisible: true },
  { plcSymbol: "Tension_3", partId: "Roller_TensionBak", categoryEn: "WindingActual", worldPosition: [ 1.0, 1.7, 0.6], defaultVisible: true },
  { plcSymbol: "Tension_4", partId: "Roller_TensionBak_2", categoryEn: "WindingActual", worldPosition: [ 0.5, 1.7, 0.6], defaultVisible: true},
  // 2 个半径（卷筒，位于两端）分别对应A2 和 A3，和A2、A3数据坐标一致（已调好）
  { plcSymbol: "HMI_Act_Wind_R",   partId: "Roller_Wind",   categoryEn: "WindingActual", worldPosition: [-4, 0.1, 0.6], defaultVisible: true },
  { plcSymbol: "HMI_Act_Unwind_R", partId: "Roller_Unwind", categoryEn: "WindingActual", worldPosition: [4, 0.1, 0.6], defaultVisible: true }
];

// ---------- Ion source actuals (2) ----------
// 离子源电流 / 电压反馈——浮在机器中心上方。
const ionSource: PlcAnchorConfigEntry[] = [
  { plcSymbol: "dbEvapSwitch_fIONCur", partId: "IonSource", categoryEn: "IonSourceActual", worldPosition: [0, 2.5, 0.6], defaultVisible: false },
  { plcSymbol: "dbEvapSwitch_fIONVol", partId: "IonSource", categoryEn: "IonSourceActual", worldPosition: [0, 2.5, 0.6], offset: [0.55, 0, 0], defaultVisible: false }
];

// ---------- Vacuum gauges (G8–G19 only) ----------
// 真空规 G8–G19（索引 188–199）——用户当前只关心这一段；G1–G7 和
// G20–G26 暂不挂载，需要时再加回。沿 X 轴在腔体高度（Y = 1.4）分布，
// Z 前后交替以保持标签可读。defaultVisible: false 表示开关面板不会
// 列出这些（配置 > 开关面板）；位置确定后改回 true 即可纳入面板。
const vacuumGauges: PlcAnchorConfigEntry[] = [
  { plcSymbol: "dbGauge_fData[7]",  partId: "Gauge_G8",  categoryEn: "VacuumGauge", worldPosition: [-1.53, 1.4, -0.6], defaultVisible: false },
  { plcSymbol: "dbGauge_fData[8]",  partId: "Gauge_G9",  categoryEn: "VacuumGauge", worldPosition: [-1.27, 1.4,  0.6], defaultVisible: false },
  { plcSymbol: "dbGauge_fData[9]",  partId: "Gauge_G10", categoryEn: "VacuumGauge", worldPosition: [-1.00, 1.4, -0.6], defaultVisible: false },
  { plcSymbol: "dbGauge_fData[10]", partId: "Gauge_G11", categoryEn: "VacuumGauge", worldPosition: [-0.73, 1.4,  0.6], defaultVisible: false },
  { plcSymbol: "dbGauge_fData[11]", partId: "Gauge_G12", categoryEn: "VacuumGauge", worldPosition: [-0.47, 1.4, -0.6], defaultVisible: false },
  { plcSymbol: "dbGauge_fData[12]", partId: "Gauge_G13", categoryEn: "VacuumGauge", worldPosition: [-0.20, 1.4,  0.6], defaultVisible: false },
  { plcSymbol: "dbGauge_fData[13]", partId: "Gauge_G14", categoryEn: "VacuumGauge", worldPosition: [ 0.07, 1.4, -0.6], defaultVisible: false },
  { plcSymbol: "dbGauge_fData[14]", partId: "Gauge_G15", categoryEn: "VacuumGauge", worldPosition: [ 0.33, 1.4,  0.6], defaultVisible: false },
  { plcSymbol: "dbGauge_fData[15]", partId: "Gauge_G16", categoryEn: "VacuumGauge", worldPosition: [ 0.60, 1.4, -0.6], defaultVisible: false },
  { plcSymbol: "dbGauge_fData[16]", partId: "Gauge_G17", categoryEn: "VacuumGauge", worldPosition: [ 0.87, 1.4,  0.6], defaultVisible: false },
  { plcSymbol: "dbGauge_fData[17]", partId: "Gauge_G18", categoryEn: "VacuumGauge", worldPosition: [ 1.13, 1.4, -0.6], defaultVisible: false },
  { plcSymbol: "dbGauge_fData[18]", partId: "Gauge_G19", categoryEn: "VacuumGauge", worldPosition: [ 1.40, 1.4,  0.6], defaultVisible: false }
];

// ---------- Temperature / cold trap (3) ----------
// 温度 · 冷捕集——主辊温度反馈 (PolyCold), 预加热 1/2 (Heater_H1/H2)。
const tempColdTrap: PlcAnchorConfigEntry[] = [
  { plcSymbol: "dbMaRollPar_fTemp", partId: "PolyCold",  categoryEn: "TemperatureOrColdTrap", worldPosition: [-2.5, 1.0, 0.0], defaultVisible: false },
  { plcSymbol: "dbHf_ParPV1",       partId: "Heater_H1", categoryEn: "TemperatureOrColdTrap", worldPosition: [-1.0, 1.5, 0.6], defaultVisible: false },
  { plcSymbol: "dbHf_ParPV2",       partId: "Heater_H2", categoryEn: "TemperatureOrColdTrap", worldPosition: [ 1.0, 1.5, 0.6], defaultVisible: false }
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