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
 * ===== 位置字典 LOCATIONS =====
 * 同一 worldPosition 上的多个数据点合并到 LOCATIONS 的同一 key，方便统一
 *   调整（例如 G201 / 主辊温度 / 张力1 / Axis_2 / 收卷半径 都挂在 LEFT_END，
 *   微调这五处共同坐标时只改 LOCATIONS.LEFT_END 一行）。
 *
 * 坐标系：X 向右（沿机器长轴）、Y 向上、Z 面向观测者；所有锚点统一 Z=0.6。
 * GLB 缩放 + Y 抬升之后的世界坐标范围：
 *   X ∈ [-4, +4]  (长轴)
 *   Y ∈ [0.3, 2.5] (辊轮高度 → 腔体顶部)
 *   Z = 0.6        (模型前缘偏前一点，标签浮在机器前方)
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

/**
 * 共享位置字典：每条 3D 锚点的 (x, y, z) 在此定义一次。多个 plcSymbol 共享
 * 同一位置时只引用同一 key，避免漂移。所有共享条目都会在分类组里加注释
 * 标注「共享 LEFT_END」等，便于追溯。
 *
 * 命名约定：按 X 方向分区（LEFT/RIGHT/CENTER）+ Y 高度（END/TOP/HIGH/MID/LOW/BOTTOM）。
 */
export const LOCATIONS: Record<string, AnchorWorldPosition> = {
  /** 最左端放卷/主辊高度带：左端主辊半径、卷绕轴2、收卷半径、张力1、
   *  主辊温度反馈、真空规 G201 / G212。 */
  LEFT_END: [-4, 0.9, 0.6],
  /** 最右端收卷端：卷绕轴3、放卷半径、张力2（与 LEFT_END 对称高度）。 */
  RIGHT_END: [4, 0.9, 0.6],
  /** 加热除气带：真空规 G202 + 两个预加热温度反馈。 */
  HEAT_BAND: [-2.6, 2.0, 0.6],
  /** 预处理/离子源带：离子源电流 + 电压反馈 + 真空规 G203。 */
  PRETREAT_BAND: [-1.5, 2.4, 0.6],
  /** 镀膜室正中心高：溅射电源6 + 真空规 G205。 */
  CENTER_HIGH: [0, 1.3, 0.6],
  /** 镀膜室偏左中：溅射电源1 + 真空规 G206。 */
  CENTER_LOW: [0.2, 0.8, 0.6],
  /** 镀膜室偏左底：溅射电源2 + 真空规 G207。 */
  CENTER_BOTTOM: [0.4, 0.3, 0.6],
  /** 卷绕张力后段（中段左上）：卷绕轴4 + 张力3。 */
  MID_LEFT_TOP: [0.5, 2.5, 0.6],
  /** 镀膜室轴1：仅卷绕轴1。 */
  AXIS_1: [0.75, 1.3, 0.6],
  /** 卷绕张力后段（中段右上）：卷绕轴5 + 张力4。 */
  MID_RIGHT_TOP: [1.0, 2.5, 0.6],
  /** 镀膜室偏右底：溅射电源3 + 真空规 G208。 */
  CENTER_RIGHT_BOTTOM: [1.4, 0.3, 0.6],
  /** 镀膜室偏右中：溅射电源4 + 真空规 G209。 */
  CENTER_RIGHT_MID: [1.6, 0.8, 0.6],
  /** 镀膜室偏右上：溅射电源5 + 真空规 G210。 */
  CENTER_RIGHT_HIGH: [1.8, 1.3, 0.6]
};

// ---------- Sputter power actuals (6) ----------
// 溅射电源 1–6 功率——分别对应6个腔室
const sputter: PlcAnchorConfigEntry[] = [
  { plcSymbol: "dbHtg_fPower_Actual[0]", partId: "PowerSupply_SP1", categoryEn: "SputterPowerActual", cnName: "溅射电源1功率", worldPosition: LOCATIONS.CENTER_LOW, defaultVisible: true },
  { plcSymbol: "dbHtg_fPower_Actual[1]", partId: "PowerSupply_SP2", categoryEn: "SputterPowerActual", cnName: "溅射电源2功率", worldPosition: LOCATIONS.CENTER_BOTTOM, defaultVisible: true },
  { plcSymbol: "dbHtg_fPower_Actual[2]", partId: "PowerSupply_SP3", categoryEn: "SputterPowerActual", cnName: "溅射电源3功率", worldPosition: LOCATIONS.CENTER_RIGHT_BOTTOM, defaultVisible: true },
  { plcSymbol: "dbHtg_fPower_Actual[3]", partId: "PowerSupply_SP4", categoryEn: "SputterPowerActual", cnName: "溅射电源4功率", worldPosition: LOCATIONS.CENTER_RIGHT_MID, defaultVisible: true },
  { plcSymbol: "dbHtg_fPower_Actual[4]", partId: "PowerSupply_SP5", categoryEn: "SputterPowerActual", cnName: "溅射电源5功率", worldPosition: LOCATIONS.CENTER_RIGHT_HIGH, defaultVisible: true },
  { plcSymbol: "dbHtg_fPower_Actual[5]", partId: "PowerSupply_SP6", categoryEn: "SputterPowerActual", cnName: "溅射电源6功率", worldPosition: LOCATIONS.CENTER_HIGH, defaultVisible: true }
];

// ---------- Winding actuals (11) ----------
// 卷绕轴速度 1–5、张力 1–4、收/放卷半径——沿长 X 轴在辊轮高度
// 分布，Z 靠近模型前方，让标签浮在辊轮上方。
const winding: PlcAnchorConfigEntry[] = [
  // 卷绕轴速度：5 个轴速度（5 个滚子），数据坐标一致
  { plcSymbol: "HMI_Act_Vel_Axis_1", partId: "Axis_1", categoryEn: "WindingActual", cnName: "卷绕轴1速度", worldPosition: LOCATIONS.AXIS_1, defaultVisible: true },
  // 共享 LEFT_END：轴2 + 张力1 + 收卷半径（用户说明 "和A2数据坐标一致"）
  { plcSymbol: "HMI_Act_Vel_Axis_2", partId: "Axis_2", categoryEn: "WindingActual", cnName: "卷绕轴2速度", worldPosition: LOCATIONS.LEFT_END, defaultVisible: true },
  // 共享 RIGHT_END：轴3 + 张力2 + 放卷半径（"和A3数据坐标一致"）
  { plcSymbol: "HMI_Act_Vel_Axis_3", partId: "Axis_3", categoryEn: "WindingActual", cnName: "卷绕轴3速度", worldPosition: LOCATIONS.RIGHT_END, defaultVisible: true },
  // 共享 MID_LEFT_TOP：轴4 + 张力3
  { plcSymbol: "HMI_Act_Vel_Axis_4", partId: "Axis_4", categoryEn: "WindingActual", cnName: "卷绕轴4速度", worldPosition: LOCATIONS.MID_LEFT_TOP, defaultVisible: true },
  // 共享 MID_RIGHT_TOP：轴5 + 张力4
  { plcSymbol: "HMI_Act_Vel_Axis_5", partId: "Axis_5", categoryEn: "WindingActual", cnName: "卷绕轴5速度", worldPosition: LOCATIONS.MID_RIGHT_TOP, defaultVisible: true },
  // 张力（前侧，Y 较低让标签贴在膜上）
  // 共享 LEFT_END：与轴2同坐标
  { plcSymbol: "Tension_1", partId: "Roller_TensionFro", categoryEn: "WindingActual", cnName: "张力1值", worldPosition: LOCATIONS.LEFT_END, defaultVisible: true },
  // 共享 RIGHT_END：与轴3同坐标
  { plcSymbol: "Tension_2", partId: "Roller_TensionFro_2", categoryEn: "WindingActual", cnName: "张力2值", worldPosition: LOCATIONS.RIGHT_END, defaultVisible: true },
  // 共享 MID_LEFT_TOP：与轴4同坐标
  { plcSymbol: "Tension_3", partId: "Roller_TensionBak", categoryEn: "WindingActual", cnName: "张力3值", worldPosition: LOCATIONS.MID_LEFT_TOP, defaultVisible: true },
  // 共享 MID_RIGHT_TOP：与轴5同坐标
  { plcSymbol: "Tension_4", partId: "Roller_TensionBak_2", categoryEn: "WindingActual", cnName: "张力4值", worldPosition: LOCATIONS.MID_RIGHT_TOP, defaultVisible: true},
  // 半径（卷筒，位于两端）
  // 共享 LEFT_END：与轴2同坐标
  { plcSymbol: "HMI_Act_Wind_R",   partId: "Roller_Wind",   categoryEn: "WindingActual", cnName: "收卷半径值", worldPosition: LOCATIONS.LEFT_END, defaultVisible: true },
  // 共享 RIGHT_END：与轴3同坐标
  { plcSymbol: "HMI_Act_Unwind_R", partId: "Roller_Unwind", categoryEn: "WindingActual", cnName: "放卷半径值", worldPosition: LOCATIONS.RIGHT_END, defaultVisible: true }
];

// ---------- Ion source actuals (2) ----------
// 离子源电流 / 电压反馈——两个条目同坐标，由 cluster 合并为单条 banner。
const ionSource: PlcAnchorConfigEntry[] = [
  // 共享 PRETREAT_BAND：离子源 + G203
  { plcSymbol: "dbEvapSwitch_fIONCur", partId: "IonSource", categoryEn: "IonSourceActual", cnName: "离子源电流反馈", worldPosition: LOCATIONS.PRETREAT_BAND, defaultVisible: true },
  { plcSymbol: "dbEvapSwitch_fIONVol", partId: "IonSource", categoryEn: "IonSourceActual", cnName: "离子源电压反馈", worldPosition: LOCATIONS.PRETREAT_BAND, defaultVisible: true }
];

// ---------- Vacuum gauges (G8–G19 only) ----------
// 真空规 G8–G19（索引 188–199）——用户当前只关心这一段；G1–G7 和
// G20–G26 暂不挂载，需要时再加回。沿 X 轴在腔体高度（Y = 1.4）分布，
// Z 前后交替以保持标签可读。defaultVisible: false 表示开关面板不会
// 列出这些（配置 > 开关面板）；位置确定后改回 true 即可纳入面板。
const vacuumGauges: PlcAnchorConfigEntry[] = [
  // 共享 LEFT_END：G201（与卷绕轴2、主辊温度同坐标）
  { plcSymbol: "dbGauge_fData[7]",  partId: "Gauge_G8",  categoryEn: "VacuumGauge", cnName: "真空规G201读数",  worldPosition: LOCATIONS.LEFT_END, defaultVisible: true },//G201
  // 共享 HEAT_BAND：G202 + 两个预加热温度
  { plcSymbol: "dbGauge_fData[8]",  partId: "Gauge_G9",  categoryEn: "VacuumGauge", cnName: "真空规G202读数",  worldPosition: LOCATIONS.HEAT_BAND, defaultVisible: true },//G202
  // 共享 PRETREAT_BAND：G203 + 离子源
  { plcSymbol: "dbGauge_fData[9]",  partId: "Gauge_G10", categoryEn: "VacuumGauge", cnName: "真空规G203读数", worldPosition: LOCATIONS.PRETREAT_BAND, defaultVisible: true },//G203
  { plcSymbol: "dbGauge_fData[10]", partId: "Gauge_G11", categoryEn: "VacuumGauge", cnName: "真空规G204读数", worldPosition: LOCATIONS.AXIS_1, defaultVisible: true },//G204
  // 共享 CENTER_HIGH：G205 + 溅射电源6
  { plcSymbol: "dbGauge_fData[11]", partId: "Gauge_G12", categoryEn: "VacuumGauge", cnName: "真空规G205读数", worldPosition: LOCATIONS.CENTER_HIGH, defaultVisible: true },//G205
  // 共享 CENTER_LOW：G206 + 溅射电源1
  { plcSymbol: "dbGauge_fData[12]", partId: "Gauge_G13", categoryEn: "VacuumGauge", cnName: "真空规G206读数", worldPosition: LOCATIONS.CENTER_LOW, defaultVisible: true },//G206
  // 共享 CENTER_BOTTOM：G207 + 溅射电源2
  { plcSymbol: "dbGauge_fData[13]", partId: "Gauge_G14", categoryEn: "VacuumGauge", cnName: "真空规G207读数", worldPosition: LOCATIONS.CENTER_BOTTOM, defaultVisible: true },//G207
  // 共享 CENTER_RIGHT_BOTTOM：G208 + 溅射电源3
  { plcSymbol: "dbGauge_fData[14]", partId: "Gauge_G15", categoryEn: "VacuumGauge", cnName: "真空规G208读数", worldPosition: LOCATIONS.CENTER_RIGHT_BOTTOM, defaultVisible: true },//G208
  // 共享 CENTER_RIGHT_MID：G209 + 溅射电源4
  { plcSymbol: "dbGauge_fData[15]", partId: "Gauge_G16", categoryEn: "VacuumGauge", cnName: "真空规G209读数", worldPosition: LOCATIONS.CENTER_RIGHT_MID, defaultVisible: true },//G209
  // 共享 CENTER_RIGHT_HIGH：G210 + 溅射电源5
  { plcSymbol: "dbGauge_fData[16]", partId: "Gauge_G17", categoryEn: "VacuumGauge", cnName: "真空规G210读数", worldPosition: LOCATIONS.CENTER_RIGHT_HIGH, defaultVisible: true },//G210
  { plcSymbol: "dbGauge_fData[17]", partId: "Gauge_G18", categoryEn: "VacuumGauge", cnName: "真空规G211读数", worldPosition: LOCATIONS.MID_LEFT_TOP, defaultVisible: true },//G211
  // 共享 LEFT_END：G212（与 G201 在同一最左端，但语义不同：G201=放卷、G212=收卷半径？）
  { plcSymbol: "dbGauge_fData[18]", partId: "Gauge_G19", categoryEn: "VacuumGauge", cnName: "真空规G212读数", worldPosition: LOCATIONS.LEFT_END, defaultVisible: true }//G212
];

// ---------- Temperature / cold trap (3) ----------
// 温度 · 冷捕集——主辊温度反馈 (PolyCold), 预加热 1/2 (Heater_H1/H2)。
const tempColdTrap: PlcAnchorConfigEntry[] = [
  // 共享 LEFT_END：主辊温度 + G201 + G212
  { plcSymbol: "dbMaRollPar_fTemp", partId: "PolyCold",  categoryEn: "TemperatureOrColdTrap", cnName: "主辊温度反馈",  worldPosition: LOCATIONS.LEFT_END, defaultVisible: true },
  // 共享 HEAT_BAND：H1 + H2 + G202
  { plcSymbol: "dbHf_ParPV1",       partId: "Heater_H1", categoryEn: "TemperatureOrColdTrap", cnName: "预加热1温度反馈", worldPosition: LOCATIONS.HEAT_BAND, defaultVisible: true },
  { plcSymbol: "dbHf_ParPV2",       partId: "Heater_H2", categoryEn: "TemperatureOrColdTrap", cnName: "预加热2温度反馈", worldPosition: LOCATIONS.HEAT_BAND, defaultVisible: true }
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