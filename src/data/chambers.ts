/**
 * 6 个物理腔室的筛选配置：放卷 / 加热除气 / 预处理 / 镀膜 / 质量检查 / 收卷。
 *
 * 每个腔室关联一组 plcSymbol（与 PLC_ANCHOR_CONFIG 同源），用来：
 *  - 在右侧数据面板里按腔室过滤 + 排序（首项高亮加粗）
 *  - 在 3D 上对腔室对应的圆点做高亮
 *  - 缩小 usePlcSensors 的轮询范围到该腔室的 anchor
 *
 * 大多数腔室只声明一个主锚点（一般是该腔室的真空规），运行时再按
 * worldPosition 把同坐标的其他数据点（卷绕轴速度、张力、半径等）一起聚合
 * 进来。镀膜室跨多个物理位置，所以保留显式列表 override。
 *
 * 首项作为该腔室的"主锚点"，选中时在右侧面板加粗展示在第一排。
 */

import { PLC_ANCHOR_CONFIG } from "./plcAnchorConfig";

export type ChamberId =
  | "unwind"
  | "heat-degas"
  | "pretreat"
  | "coating"
  | "inspect"
  | "rewind";

export type ChamberDef = {
  id: ChamberId;
  label: string;
  /** 主锚点 plcSymbol——它在右侧面板加粗放第一排，且它的 worldPosition
   *  用于聚合同坐标的其他锚点（如果未指定 anchorPlcSymbolsOverride）。 */
  primaryPlcSymbol: string;
  /**
   * 显式锚点列表（覆盖自动按同坐标聚合的逻辑）。镀膜室跨多个位置，
   * 所以保留显式列表并指定顺序。
   */
  anchorPlcSymbolsOverride?: readonly string[];
};

/** 同一 worldPosition 上的全部 plcSymbol（按 PLC_ANCHOR_CONFIG 顺序）。 */
function plcSymbolsAtPosition(worldPosition: readonly [number, number, number]): string[] {
  return PLC_ANCHOR_CONFIG
    .filter(
      (a) =>
        a.worldPosition[0] === worldPosition[0] &&
        a.worldPosition[1] === worldPosition[1] &&
        a.worldPosition[2] === worldPosition[2]
    )
    .map((a) => a.plcSymbol);
}

/** 把主锚点放到第一位，其它同坐标的保持 PLC_ANCHOR_CONFIG 原顺序。 */
function primaryFirst(primary: string, others: string[]): string[] {
  const filtered = others.filter((s) => s !== primary);
  return [primary, ...filtered];
}

const PRIMARY_BY_ID: Record<ChamberId, string> = {
  unwind: "dbGauge_fData[7]",
  "heat-degas": "dbGauge_fData[8]",
  pretreat: "dbGauge_fData[9]",
  coating: "dbGauge_fData[10]",
  inspect: "dbGauge_fData[17]",
  rewind: "dbGauge_fData[18]"
};

export const CHAMBERS: readonly ChamberDef[] = (
  Object.keys(PRIMARY_BY_ID) as ChamberId[]
).map((id) => {
  const primary = PRIMARY_BY_ID[id];
  if (id === "coating") {
    // 镀膜室跨多坐标：显式列表 override（卷绕轴 1/4/5、张力 3/4、真空规
    // 204–210、溅射电源 1–6），保留用户指定的顺序。
    return {
      id,
      label: id === "coating" ? "镀膜室" : id,
      primaryPlcSymbol: primary,
      anchorPlcSymbolsOverride: [
        // 卷绕轴 1, 4, 5 速度
        "HMI_Act_Vel_Axis_1",
        "HMI_Act_Vel_Axis_4",
        "HMI_Act_Vel_Axis_5",
        // 张力 3, 4
        "Tension_3",
        "Tension_4",
        // 真空规 204–210
        "dbGauge_fData[10]",
        "dbGauge_fData[11]",
        "dbGauge_fData[12]",
        "dbGauge_fData[13]",
        "dbGauge_fData[14]",
        "dbGauge_fData[15]",
        "dbGauge_fData[16]",
        // 溅射电源 1–6
        "dbHtg_fPower_Actual[0]",
        "dbHtg_fPower_Actual[1]",
        "dbHtg_fPower_Actual[2]",
        "dbHtg_fPower_Actual[3]",
        "dbHtg_fPower_Actual[4]",
        "dbHtg_fPower_Actual[5]"
      ]
    };
  }
  // 其它腔室：按主锚点同坐标自动聚合所有数据点。
  const labels: Record<ChamberId, string> = {
    unwind: "放卷室",
    "heat-degas": "加热除气室",
    pretreat: "预处理室",
    coating: "镀膜室",
    inspect: "质量检查室",
    rewind: "收卷室"
  };
  const anchor = PLC_ANCHOR_CONFIG.find((a) => a.plcSymbol === primary);
  const symbols = anchor
    ? primaryFirst(primary, plcSymbolsAtPosition(anchor.worldPosition))
    : [primary];
  return {
    id,
    label: labels[id],
    primaryPlcSymbol: primary,
    anchorPlcSymbolsOverride: symbols
  };
});

/** 主锚点 plcSymbol（每个腔室的第一项）。 */
export const CHAMBER_PRIMARY_SYMBOL: ReadonlyMap<ChamberId, string> = new Map(
  CHAMBERS.map((c) => [c.id, c.primaryPlcSymbol])
);

/** 腔室 id → 该腔室所有 plcSymbol 集合（含同坐标自动聚合）。 */
export const CHAMBER_SYMBOLS: ReadonlyMap<ChamberId, ReadonlySet<string>> =
  new Map(
    CHAMBERS.map((c) => [
      c.id,
      new Set(c.anchorPlcSymbolsOverride ?? [c.primaryPlcSymbol])
    ])
  );