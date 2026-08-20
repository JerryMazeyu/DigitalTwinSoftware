/**
 * PLC 数据点的 3D 锚点配置。
 *
 * 每个条目声明：
 *   - 要轮询的 PLC 标签（plcSymbol——PLC_SENSOR_META 的外键）；
 *   - 中文显示名（cnName）——面板 checkbox 和 banner 上展示的文字，
 *     不再依赖 PLC_SENSOR_META 的 cnName 字段；
 *   - 标签在 GLB 上的锚点位置（worldPosition，单位 R3F 世界坐标）；
 *   - 开关面板分组的逻辑部件 ID（partId）；
 *   - 开关面板分桶的类别（categoryEn）；
 *   - 以及优先级开关 defaultVisible。设为 false 时，该条目既不会被轮询、
 *     也不会渲染、也不会出现在面板里（配置 > 开关面板）。
 *
 * 位置和中文字段都是种子值，调位置/换文案直接改这里——不需要碰 UI 代码。
 *
 * === 新模型（20260819）Y 重新标定 ===
 * 旧模型：cavities/锚点散落在世界 Y=[0.2, 2.85] 区间；Y_OFFSET=1.9 是
 * 后期整体上抬（注释里写的 0.8 是历史值值）。新模型里 13 个 cavity
 * Extrusion mesh Y 全部 = 1.37（gltf 坐标），size 0.87 → 应用 Y_OFFSET
 * 后 cavities 占世界 Y=[2.84, 3.71]，中心 Y=3.27。42 个 roller 在世界
 * Y=[0.36, 2.79]，大部分集中在 Y≈2.5，少数放卷/收卷 reel 在 Y≈2.0。
 * 三层 Y 高度：reels(2.0) / 主辊(2.5) / cavities(3.27)。
 *
 * GLB 缩放 + Y 抬升之后的世界坐标范围：
 *   X ∈ [-4.4, +4.4]  (长轴)
 *   Y ∈ [-0.26, 3.71] (floor 底 → cavity 顶)
 *   Z ∈ [-1.03, +1.03] (后 ↔ 前)
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
  /** 面板 checkbox 与 banner 上展示的中文名；不依赖 PlcSensorMeta。 */
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
// 6 路溅射电源均落在 cavities 之上（Y=3.27），X 沿镀膜室分布
const sputter: PlcAnchorConfigEntry[] = [
  { plcSymbol: "dbHtg_fPower_Actual[0]", partId: "PowerSupply_SP1", categoryEn: "SputterPowerActual", cnName: "溅射电源1实际功率", worldPosition: [0.2, 3.27, 0.6], defaultVisible: true },
  { plcSymbol: "dbHtg_fPower_Actual[1]", partId: "PowerSupply_SP2", categoryEn: "SputterPowerActual", cnName: "溅射电源2实际功率", worldPosition: [0.4, 3.27, 0.6], defaultVisible: true },
  { plcSymbol: "dbHtg_fPower_Actual[2]", partId: "PowerSupply_SP3", categoryEn: "SputterPowerActual", cnName: "溅射电源3实际功率", worldPosition: [1.4, 3.27, 0.6], defaultVisible: true },
  { plcSymbol: "dbHtg_fPower_Actual[3]", partId: "PowerSupply_SP4", categoryEn: "SputterPowerActual", cnName: "溅射电源4实际功率", worldPosition: [1.6, 3.27, 0.6], defaultVisible: true },
  { plcSymbol: "dbHtg_fPower_Actual[4]", partId: "PowerSupply_SP5", categoryEn: "SputterPowerActual", cnName: "溅射电源5实际功率", worldPosition: [1.8, 3.27, 0.6], defaultVisible: true },
  { plcSymbol: "dbHtg_fPower_Actual[5]", partId: "PowerSupply_SP6", categoryEn: "SputterPowerActual", cnName: "溅射电源6实际功率", worldPosition: [0, 3.27, 0.6], defaultVisible: true }
];

// ---------- Winding actuals (11) ----------
// 5 个轴速 + 4 个张力 + 2 个卷半径。
// X 仍沿用旧配置（按用户原意保留腔室分布语义），Y 根据新 roller
// 实测位置：两端 reel (放卷/收卷) Y=2.0，中段主辊 Y=2.5。
const winding: PlcAnchorConfigEntry[] = [
  // 5 个轴速度
  { plcSymbol: "HMI_Act_Vel_Axis_1", partId: "Axis_1", categoryEn: "WindingActual", cnName: "卷绕轴1实际速度", worldPosition: [ 0.75, 2.5, 0.6], defaultVisible: true },
  { plcSymbol: "HMI_Act_Vel_Axis_2", partId: "Axis_2", categoryEn: "WindingActual", cnName: "卷绕轴2实际速度", worldPosition: [-4, 2.0, 0.6], defaultVisible: true },
  { plcSymbol: "HMI_Act_Vel_Axis_3", partId: "Axis_3", categoryEn: "WindingActual", cnName: "卷绕轴3实际速度", worldPosition: [ 4, 2.0, 0.6], defaultVisible: true },
  { plcSymbol: "HMI_Act_Vel_Axis_4", partId: "Axis_4", categoryEn: "WindingActual", cnName: "卷绕轴4实际速度", worldPosition: [ 0.5, 2.5, 0.6], defaultVisible: true },
  { plcSymbol: "HMI_Act_Vel_Axis_5", partId: "Axis_5", categoryEn: "WindingActual", cnName: "卷绕轴5实际速度", worldPosition: [ 1.0, 2.5, 0.6], defaultVisible: true },
  // 4 个张力
  { plcSymbol: "Tension_1", partId: "Roller_TensionFro", categoryEn: "WindingActual", cnName: "张力1实际值", worldPosition: [-4, 2.0, 0.6], defaultVisible: true },
  { plcSymbol: "Tension_2", partId: "Roller_TensionFro_2", categoryEn: "WindingActual", cnName: "张力2实际值", worldPosition: [4, 2.0, 0.6], defaultVisible: true },
  { plcSymbol: "Tension_3", partId: "Roller_TensionBak", categoryEn: "WindingActual", cnName: "张力3实际值", worldPosition: [ 0.5, 2.5, 0.6], defaultVisible: true },
  { plcSymbol: "Tension_4", partId: "Roller_TensionBak_2", categoryEn: "WindingActual", cnName: "张力4实际值", worldPosition: [ 1.0, 2.5, 0.6], defaultVisible: true},
  // 2 个卷半径（卷筒，位于两端）
  { plcSymbol: "HMI_Act_Wind_R",   partId: "Roller_Wind",   categoryEn: "WindingActual", cnName: "收卷半径实际值", worldPosition: [-4, 2.0, 0.6], defaultVisible: true },
  { plcSymbol: "HMI_Act_Unwind_R", partId: "Roller_Unwind", categoryEn: "WindingActual", cnName: "放卷半径实际值", worldPosition: [4, 2.0, 0.6], defaultVisible: true }
];

// ---------- Ion source actuals (2) ----------
// 离子源位于 cavity 顶端（Y≈3.7），cluster 合并为单条 banner
const ionSource: PlcAnchorConfigEntry[] = [
  { plcSymbol: "dbEvapSwitch_fIONCur", partId: "IonSource", categoryEn: "IonSourceActual", cnName: "离子源电流反馈", worldPosition: [ -1.5, 3.7, 0.6], defaultVisible: true },
  { plcSymbol: "dbEvapSwitch_fIONVol", partId: "IonSource", categoryEn: "IonSourceActual", cnName: "离子源电压反馈", worldPosition: [ -1.5, 3.7, 0.6], defaultVisible: true }
];

// ---------- Vacuum gauges (G201–G212) ----------
// 真空规全部坐落在 cavities 顶面（Y=3.27），X 沿各腔室分布。
// 新模型 13 个 cavity 中心 X 位置：
//   unwind: -4.08, -3.38
//   heat-degas: -2.67
//   pretreat: -1.72
//   coating: -0.78, -0.17, +0.44, +1.03, +1.64, +2.26
//   inspect: +2.87
//   rewind: +3.49, +4.10
// 旧 X 值保留原意（与腔室/物理特征对应），Y 统一到 cavity 顶面。
const vacuumGauges: PlcAnchorConfigEntry[] = [
  { plcSymbol: "dbGauge_fData[7]",  partId: "Gauge_G8",  categoryEn: "VacuumGauge", cnName: "真空规G201读数",  worldPosition: [-4,   3.27, 0.6], defaultVisible: true },
  { plcSymbol: "dbGauge_fData[8]",  partId: "Gauge_G9",  categoryEn: "VacuumGauge", cnName: "真空规G202读数",  worldPosition: [-2.6, 3.27, 0.6], defaultVisible: true },
  { plcSymbol: "dbGauge_fData[9]",  partId: "Gauge_G10", categoryEn: "VacuumGauge", cnName: "真空规G203读数",  worldPosition: [-1.5, 3.27, 0.6], defaultVisible: true },
  { plcSymbol: "dbGauge_fData[10]", partId: "Gauge_G11", categoryEn: "VacuumGauge", cnName: "真空规G204读数",  worldPosition: [ 0.75, 3.27, 0.6], defaultVisible: true },
  { plcSymbol: "dbGauge_fData[11]", partId: "Gauge_G12", categoryEn: "VacuumGauge", cnName: "真空规G205读数",  worldPosition: [ 0, 3.27, 0.6], defaultVisible: true },
  { plcSymbol: "dbGauge_fData[12]", partId: "Gauge_G13", categoryEn: "VacuumGauge", cnName: "真空规G206读数",  worldPosition: [ 0.2, 3.27, 0.6], defaultVisible: true },
  { plcSymbol: "dbGauge_fData[13]", partId: "Gauge_G14", categoryEn: "VacuumGauge", cnName: "真空规G207读数",  worldPosition: [ 0.4, 3.27, 0.6], defaultVisible: true },
  { plcSymbol: "dbGauge_fData[14]", partId: "Gauge_G15", categoryEn: "VacuumGauge", cnName: "真空规G208读数",  worldPosition: [ 1.4, 3.27, 0.6], defaultVisible: true },
  { plcSymbol: "dbGauge_fData[15]", partId: "Gauge_G16", categoryEn: "VacuumGauge", cnName: "真空规G209读数",  worldPosition: [ 1.6, 3.27, 0.6], defaultVisible: true },
  { plcSymbol: "dbGauge_fData[16]", partId: "Gauge_G17", categoryEn: "VacuumGauge", cnName: "真空规G210读数",  worldPosition: [ 1.8, 3.27, 0.6], defaultVisible: true },
  { plcSymbol: "dbGauge_fData[17]", partId: "Gauge_G18", categoryEn: "VacuumGauge", cnName: "真空规G211读数",  worldPosition: [ 3, 3.27, 0.6], defaultVisible: true },
  { plcSymbol: "dbGauge_fData[18]", partId: "Gauge_G19", categoryEn: "VacuumGauge", cnName: "真空规G212读数",  worldPosition: [ 4, 3.27, 0.6], defaultVisible: true }
];

// ---------- Temperature / cold trap (3) ----------
// PolyCold 主辊温度：放卷 reel 位置（X=-4, Y=2.0）。
// 预加热 H1/H2：旧配置都在 X=-2.6 处，落在 cavities 上方（Y=3.27）。
const tempColdTrap: PlcAnchorConfigEntry[] = [
  { plcSymbol: "dbMaRollPar_fTemp", partId: "PolyCold",  categoryEn: "TemperatureOrColdTrap", cnName: "主辊温度反馈",   worldPosition: [-4,   2.0, 0.6], defaultVisible: true },
  { plcSymbol: "dbHf_ParPV1",       partId: "Heater_H1", categoryEn: "TemperatureOrColdTrap", cnName: "预加热1温度反馈", worldPosition: [-2.6, 3.27, 0.6], defaultVisible: true },
  { plcSymbol: "dbHf_ParPV2",       partId: "Heater_H2", categoryEn: "TemperatureOrColdTrap", cnName: "预加热2温度反馈", worldPosition: [-2.6, 3.27, 0.6], defaultVisible: true }
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