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
 * GLB 缩放 + Y 抬升之后的世界坐标范围：
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
// 溅射电源 1–6 实际功率——分别对应6个腔室 (已调好)
// （1）0.2, 0, 0.6 （2）0.4, -0.5, 0.6 (3) 1.4, -0.5, 0.6 (4) 1.6, 0, 0.6 (5) 1.8, 0.5, 0.6 (6) 0, 0.5, 0.6
const sputter: PlcAnchorConfigEntry[] = [
  { plcSymbol: "dbHtg_fPower_Actual[0]", partId: "PowerSupply_SP1", categoryEn: "SputterPowerActual", cnName: "溅射电源1实际功率", worldPosition: [0.2, 0, 0.6], defaultVisible: true },
  { plcSymbol: "dbHtg_fPower_Actual[1]", partId: "PowerSupply_SP2", categoryEn: "SputterPowerActual", cnName: "溅射电源2实际功率", worldPosition: [0.4, -0.5, 0.6], defaultVisible: true },
  { plcSymbol: "dbHtg_fPower_Actual[2]", partId: "PowerSupply_SP3", categoryEn: "SputterPowerActual", cnName: "溅射电源3实际功率", worldPosition: [1.4, -0.5, 0.6], defaultVisible: true },
  { plcSymbol: "dbHtg_fPower_Actual[3]", partId: "PowerSupply_SP4", categoryEn: "SputterPowerActual", cnName: "溅射电源4实际功率", worldPosition: [1.6, 0, 0.6], defaultVisible: true },
  { plcSymbol: "dbHtg_fPower_Actual[4]", partId: "PowerSupply_SP5", categoryEn: "SputterPowerActual", cnName: "溅射电源5实际功率", worldPosition: [1.8, 0.5, 0.6], defaultVisible: true },
  { plcSymbol: "dbHtg_fPower_Actual[5]", partId: "PowerSupply_SP6", categoryEn: "SputterPowerActual", cnName: "溅射电源6实际功率", worldPosition: [0, 0.5, 0.6], defaultVisible: true }
];

// ---------- Winding actuals (11) ----------
// 卷绕轴速度 1–5、张力 1–4、收/放卷半径——沿长 X 轴在辊轮高度
//（世界坐标 Y ≈ 1.0）分布，Z 靠近模型前方，让标签浮在辊轮上方。
const winding: PlcAnchorConfigEntry[] = [
  // 5 个轴速度 分别对应A1、A2、A3、A4、A5 五个滚子 （已调好）
  { plcSymbol: "HMI_Act_Vel_Axis_1", partId: "Axis_1", categoryEn: "WindingActual", cnName: "卷绕轴1实际速度", worldPosition: [ 0.75, 0.5, 0.6], defaultVisible: true },
  { plcSymbol: "HMI_Act_Vel_Axis_2", partId: "Axis_2", categoryEn: "WindingActual", cnName: "卷绕轴2实际速度", worldPosition: [ -4, 0.1, 0.6], defaultVisible: true },
  { plcSymbol: "HMI_Act_Vel_Axis_3", partId: "Axis_3", categoryEn: "WindingActual", cnName: "卷绕轴3实际速度", worldPosition: [ 4, 0.1, 0.6], defaultVisible: true },
  { plcSymbol: "HMI_Act_Vel_Axis_4", partId: "Axis_4", categoryEn: "WindingActual", cnName: "卷绕轴4实际速度", worldPosition: [ 0.5, 1.7, 0.6], defaultVisible: true },
  { plcSymbol: "HMI_Act_Vel_Axis_5", partId: "Axis_5", categoryEn: "WindingActual", cnName: "卷绕轴5实际速度", worldPosition: [ 1.0,1.7, 0.6], defaultVisible: true },
  // 4 个张力（前侧，Y 较低让标签贴在膜上）分别对应A2、A3、A4、A5 四个滚子 和 A2、A3、A4、A5 四个滚子 数据坐标一致 （已调好）
  { plcSymbol: "Tension_1", partId: "Roller_TensionFro", categoryEn: "WindingActual", cnName: "张力1实际值", worldPosition: [-4, 0.1, 0.6], defaultVisible: true },
  { plcSymbol: "Tension_2", partId: "Roller_TensionFro_2", categoryEn: "WindingActual", cnName: "张力2实际值", worldPosition: [4, 0.1, 0.6], defaultVisible: true },
  { plcSymbol: "Tension_3", partId: "Roller_TensionBak", categoryEn: "WindingActual", cnName: "张力3实际值", worldPosition: [ 0.5, 1.7, 0.6], defaultVisible: true },
  { plcSymbol: "Tension_4", partId: "Roller_TensionBak_2", categoryEn: "WindingActual", cnName: "张力4实际值", worldPosition: [ 1.0, 1.7, 0.6], defaultVisible: true},
  // 2 个半径（卷筒，位于两端）分别对应A2 和 A3，和A2、A3数据坐标一致（已调好）
  { plcSymbol: "HMI_Act_Wind_R",   partId: "Roller_Wind",   categoryEn: "WindingActual", cnName: "收卷半径实际值", worldPosition: [-4, 0.1, 0.6], defaultVisible: true },
  { plcSymbol: "HMI_Act_Unwind_R", partId: "Roller_Unwind", categoryEn: "WindingActual", cnName: "放卷半径实际值", worldPosition: [4, 0.1, 0.6], defaultVisible: true }
];

// ---------- Ion source actuals (2) ----------
// 离子源电流 / 电压反馈——两个条目同坐标，由 cluster 合并为单条 banner。
//（已调好）
const ionSource: PlcAnchorConfigEntry[] = [
  { plcSymbol: "dbEvapSwitch_fIONCur", partId: "IonSource", categoryEn: "IonSourceActual", cnName: "离子源电流反馈", worldPosition: [ -1, 1.7, 0.6], defaultVisible: true },
  { plcSymbol: "dbEvapSwitch_fIONVol", partId: "IonSource", categoryEn: "IonSourceActual", cnName: "离子源电压反馈", worldPosition: [ -1, 1.7, 0.6], defaultVisible: true }
];

// ---------- Vacuum gauges (G8–G19 only) ----------
// 真空规 G8–G19（索引 188–199）——用户当前只关心这一段；G1–G7 和
// G20–G26 暂不挂载，需要时再加回。沿 X 轴在腔体高度（Y = 1.4）分布，
// Z 前后交替以保持标签可读。defaultVisible: false 表示开关面板不会
// 列出这些（配置 > 开关面板）；位置确定后改回 true 即可纳入面板。
// （1）0.2, 0, 0.6 （2）0.4, -0.5, 0.6 (3) 1.4, -0.5, 0.6 (4) 1.6, 0, 0.6 (5) 1.8, 0.5, 0.6 (6) 0, 0.5, 0.6
// (已调好)
const vacuumGauges: PlcAnchorConfigEntry[] = [
  { plcSymbol: "dbGauge_fData[7]",  partId: "Gauge_G8",  categoryEn: "VacuumGauge", cnName: "真空规G201读数",  worldPosition: [-4, 0.1, 0.6], defaultVisible: true },//G201
  { plcSymbol: "dbGauge_fData[8]",  partId: "Gauge_G9",  categoryEn: "VacuumGauge", cnName: "真空规G202读数",  worldPosition: [-2.6, 1.2, 0.6], defaultVisible: true },//G202
  { plcSymbol: "dbGauge_fData[9]",  partId: "Gauge_G10", categoryEn: "VacuumGauge", cnName: "真空规G203读数", worldPosition: [-1.5, 1.6, 0.6], defaultVisible: true },//G203
  { plcSymbol: "dbGauge_fData[10]", partId: "Gauge_G11", categoryEn: "VacuumGauge", cnName: "真空规G204读数", worldPosition: [0.75, 1.2, 0.6], defaultVisible: true },//G204
  { plcSymbol: "dbGauge_fData[11]", partId: "Gauge_G12", categoryEn: "VacuumGauge", cnName: "真空规G205读数", worldPosition: [0, 0.5, 0.6], defaultVisible: true },//G205
  { plcSymbol: "dbGauge_fData[12]", partId: "Gauge_G13", categoryEn: "VacuumGauge", cnName: "真空规G206读数", worldPosition: [0.2, 0, 0.6], defaultVisible: true },//G206
  { plcSymbol: "dbGauge_fData[13]", partId: "Gauge_G14", categoryEn: "VacuumGauge", cnName: "真空规G207读数", worldPosition: [ 0.4, -0.5, 0.6], defaultVisible: true },//G207
  { plcSymbol: "dbGauge_fData[14]", partId: "Gauge_G15", categoryEn: "VacuumGauge", cnName: "真空规G208读数", worldPosition: [ 1.4, -0.5, 0.6], defaultVisible: true },//G208
  { plcSymbol: "dbGauge_fData[15]", partId: "Gauge_G16", categoryEn: "VacuumGauge", cnName: "真空规G209读数", worldPosition: [ 1.6, 0, 0.6], defaultVisible: true },//G209
  { plcSymbol: "dbGauge_fData[16]", partId: "Gauge_G17", categoryEn: "VacuumGauge", cnName: "真空规G210读数", worldPosition: [ 1.8, 0.5, 0.6], defaultVisible: true },//G210
  { plcSymbol: "dbGauge_fData[17]", partId: "Gauge_G18", categoryEn: "VacuumGauge", cnName: "真空规G211读数", worldPosition: [ 3, 1.6, 0.6], defaultVisible: true },//G211
  { plcSymbol: "dbGauge_fData[18]", partId: "Gauge_G19", categoryEn: "VacuumGauge", cnName: "真空规G212读数", worldPosition: [ 4, 0.1, 0.6], defaultVisible: true }//G212
];

// ---------- Temperature / cold trap (3) ----------
// 温度 · 冷捕集——主辊温度反馈 (PolyCold), 预加热 1/2 (Heater_H1/H2)。
const tempColdTrap: PlcAnchorConfigEntry[] = [
  { plcSymbol: "dbMaRollPar_fTemp", partId: "PolyCold",  categoryEn: "TemperatureOrColdTrap", cnName: "主辊温度反馈",  worldPosition: [-4, 0.1, 0.6], defaultVisible: true },
  { plcSymbol: "dbHf_ParPV1",       partId: "Heater_H1", categoryEn: "TemperatureOrColdTrap", cnName: "预加热1温度反馈", worldPosition: [-2.6, 1.2, 0.6], defaultVisible: true },
  { plcSymbol: "dbHf_ParPV2",       partId: "Heater_H2", categoryEn: "TemperatureOrColdTrap", cnName: "预加热2温度反馈", worldPosition: [-2.6, 1.2, 0.6], defaultVisible: true }
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