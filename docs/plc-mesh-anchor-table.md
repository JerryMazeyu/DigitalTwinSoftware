# PLC 传感器 ↔ 3D 模型部件 锚点对照表

> **交付对象**：负责 `public/models/coater-20260721/coater.glb` 的建模/渲染同学
> **目的**：在 GLB 中为每个有意义的设备部件添加或重命名 anchor（锚点对象），使前端可以按部件挂载 PLC 实时传感器数据
> **关联文件**：
> - GLB 当前 mesh 清单：`src/domain/generatedModelLayers.ts`
> - 传感器元数据来源：`C:\Users\silicon\Desktop\readVars\BeckhoffJMJReader\JCD1300传感器只读点位中文对照表.md`
> - 运行时锚点扫描逻辑：将在 `src/components/PlcSensorLayer.tsx` 通过 `object.traverse()` + `child.name === partId` 实现

---

## 一、约定（请建模同学遵守）

### 推荐形式：**新增 Empty 锚点对象**（不动现有 mesh）

```
在 Blender 中，每个需要被传感器数据锚定的部件旁边，添加一个 Empty 对象，命名格式：
    anchor:<partId>

例：anchor:Chamber_1
     anchor:PowerSupply_SP1
     anchor:Roller_Main
```

**为什么用 Empty 而不是直接重命名 mesh**：
1. 不破坏现有 `Mesh1 Group1 Model` / 图层 ID（`___01` / `___02`）/ `prepareObject()` 的归一化逻辑
2. 与现有 mesh 命名约定解耦，方便建模同学后续调整 mesh 结构
3. Empty 对象在 GLB 里几乎没有渲染开销

### `partId` 命名规则

- 全部使用 **PascalCase** 英文
- 与物理设备位号 / 对照表语义一致
- 例：`Chamber_1`、`MolecularPump_1`、`PowerSupply_SP1`、`Roller_Main`

### anchor 在 GLB 中的位置

- 放在部件 mesh 的**中心位置**
- 如果是旋转体（如辊子），放在**轴线中点**
- 如果是大部件，把 anchor 放在**正面外侧** 0.1~0.3 偏移处，方便日后放标签（避免穿模）

---

## 二、GLB 已有的语义 mesh（直接重命名 / 加同位 Empty 即可）

下表是 `src/domain/generatedModelLayers.ts` 里**已经带语义名字**的 mesh，可以直接以这些名字为 `partId` 加 Empty 锚点：

| mesh 名称 | 中文部件名 | 物理位置 | partId | 备注 |
| --- | --- | --- | --- | --- |
| `Mesh141 ___1_1 ____2 Group2 Model` | 腔体 1 | 主腔体左 1 | `Chamber_1` | 高/低真空状态主腔体 |
| `Mesh142 ___2_1 ____2 Group2 Model` | 腔体 2-1 | 主腔体 2-1 | `Chamber_2_1` | |
| `Mesh143 ___2_2 ____2 Group2 Model` | 腔体 2-2 | 主腔体 2-2 | `Chamber_2_2` | |
| `Mesh144 ___3_1 ____2 Group2 Model` | 腔体 3 | 主腔体 3 | `Chamber_3` | |
| `Mesh145 ___4_1_4 ____2 Group2 Model` | 腔体 4 | 主腔体 4 | `Chamber_4` | 注：命名是 ___4_1_4，疑似手动编号 |
| `Mesh146 ___1_1_1 ____2_1 Group2 Model` | 腔体 1 子部件 | Chamber_1 辅件 | `Chamber_1_Sub` | 待建模/工艺确认具体语义 |
| `Mesh147 ___2_1_1 ____2_1 Group2 Model` | 腔体 2-1 子部件 | Chamber_2_1 辅件 | `Chamber_2_1_Sub` | 同上 |
| `Mesh148 ___2_2_1 ____2_1 Group2 Model` | 腔体 2-2 子部件 | Chamber_2_2 辅件 | `Chamber_2_2_Sub` | 同上 |
| `Mesh149 ___3_1_1 ____2_1 Group2 Model` | 腔体 3 子部件 | Chamber_3 辅件 | `Chamber_3_Sub` | 同上 |
| `Mesh150 ___4_1_5 ____2_1 Group2 Model` | 腔体 4 子部件 | Chamber_4 辅件 | `Chamber_4_Sub` | 同上 |
| `Mesh172 block_2_1 ________dwg1 Model` | 电源外壳 1 | ___02 层第 1 个 block | `PowerSupply_SP1` | 6 路溅射电源外壳，需建模/工艺确认 1↔SP1 对应关系 |
| `Mesh173 block_2_1 ________dwg1 Model` | 电源外壳 2 | ___02 层第 2 个 block | `PowerSupply_SP2` | 同上 |
| `Mesh174 block_2_1 ________dwg1 Model` | 电源外壳 3 | ___02 层第 3 个 block | `PowerSupply_SP3` | 同上 |
| `Mesh175 block_2_1 ________dwg1 Model` | 电源外壳 4 | ___02 层第 4 个 block | `PowerSupply_SP4` | 同上 |
| `Mesh176 block_2_1 ________dwg1 Model` | 电源外壳 5 | ___02 层第 5 个 block | `PowerSupply_SP5` | 同上 |
| `Mesh177 block_2_1 ________dwg1 Model` | 电源外壳 6 | ___02 层第 6 个 block | `PowerSupply_SP6` | 同上 |

> ⚠️ `Mesh172-177` 的命名完全相同（都是 `block_2_1 ________dwg1 Model`），需要建模同学在 Blender 里**先把这 6 个 mesh 区分开**，再加 Empty。

---

## 三、需要在 GLB 中**新增 anchor Empty** 的部件

下表列出的部件在 GLB 里**没有对应 mesh**，需要建模同学新增 Empty 锚点：

### A. 真空泵（前级泵 + 分子泵）

| 中文部件 | 建议 partId | 数量 | 物理位置（建议） | 备注 |
| --- | --- | --- | --- | --- |
| 前级泵 P1-P9 | `Pump_P1` ~ `Pump_P9` | 9 | 主腔体下方/侧方一字排开 | 9 个 P 泵，对应 9 个 `nP*OpStatus` |
| 分子泵 MP1-MP28 | `MolecularPump_1` ~ `MolecularPump_28` | 28 | 各腔体下方 | 28 个分子泵，命名按设备实际位号 |
| 冷捕集 Polycold | `PolyCold` | 1 | 主腔体附近 | 主辊冷捕集系统 |

### B. 阀门

| 中文部件 | 建议 partId | 数量 | 物理位置（建议） | 备注 |
| --- | --- | --- | --- | --- |
| 粗抽阀 CRV1-CRV5 | `Valve_CRV1` ~ `Valve_CRV5` | 5 | 各腔体粗抽管路 | `nCRV*OpStatus` |
| RV 阀 1-4 | `Valve_RV1` ~ `Valve_RV4` | 4 | 主抽管路 | `nRV*OpStatus` |
| 高真空阀 HVV1-HVV8 | `Valve_HVV1` ~ `Valve_HVV8` | 8 | 腔体与主抽之间 | `nHVV*OpStatus` |
| 隔离阀 ISOV1-2 | `Valve_ISOV1` ~ `Valve_ISOV2` | 2 | 腔体隔离 | `nISOV*OpStatus` |
| 放气阀 VV1-3 | `Valve_VV1` ~ `Valve_VV3` | 3 | 各腔体放气口 | `nVV*OpStatus` |
| GBV 阀 1-4 | `Valve_GBV1` ~ `Valve_GBV4` | 4 | 前级管路 | `nGBV*OpStatus` |
| 离子源阀 | `Valve_IonSource` | 1 | 离子源管路 | 对应 `bIonVac` |

### C. 真空规（Pirani + 复合规）

| 中文部件 | 建议 partId | 数量 | 物理位置（建议） | 备注 |
| --- | --- | --- | --- | --- |
| 真空规 G1-G26 | `Gauge_G1` ~ `Gauge_G26` | 26 | 各腔体顶部/侧面法兰 | `dbGauge_fData[0..25]` + 状态码 |

### D. 磁控阴极（MAG）

| 中文部件 | 建议 partId | 数量 | 物理位置（建议） | 备注 |
| --- | --- | --- | --- | --- |
| MAG 磁控电源 1-28 | `MAG_Cathode_1` ~ `MAG_Cathode_28` | 28 | 各腔体内壁 | 28 个 MAG（频率 + 故障码各 28 个） |

### E. 卷绕系统（**不在 GLB 范围内**，需建模同学确认）

⚠️ `TwinMachine3D.tsx` 里**程序化绘制**了 7 个 Roller（Bearing + FilmSegment），但 GLB **没有**对应 mesh。需要在源文件 Blender 中给 Roller 加 anchor，或者改用 R3F 程序化组件挂 anchor。

| 中文部件 | 建议 partId | 数量 | 物理位置（建议） | 备注 |
| --- | --- | --- | --- | --- |
| 放卷轴 | `Roller_Unwind` | 1 | 最左 -3.22 | `HMI_Act_Unwind_R`、`Real_Unwind_TensSV` |
| 张力辊（前后） | `Roller_TensionFro` / `Roller_TensionBak` | 2 | 左 -2.25 / 右 2.42 | `g_ibFroTension*` / `g_ibBakTension*` |
| 主辊（工艺辊） | `Roller_Main` | 1 | 中 -1.28 | `dbMaRollPar_fTemp`、`g_ibMaRoll*` 全部联锁 |
| 涂布辊 | `Roller_Coating` | 1 | 中 -0.06 | 工艺核心辊 |
| 烘干辊 | `Roller_Dryer` | 1 | 中 1.18 | |
| 收卷轴 | `Roller_Wind` | 1 | 最右 3.28 | `HMI_Act_Wind_R`、`Real_Wind_TensSV`、`Tension_1` ~ `Tension_4` |
| 收放卷轴 1-5 | `Axis_1` ~ `Axis_5` | 5 | 卷绕系统各处 | `Axis_*_Operation_Mode`、`Power_Status_Axis_*`、`Status_Axis_*`、`HMI_Act_Vel_Axis_*` |

### F. MKS 流量计 + 离子源 + 温度

| 中文部件 | 建议 partId | 数量 | 物理位置（建议） | 备注 |
| --- | --- | --- | --- | --- |
| MKS 流量计 1-30 | `MKS_Flow_1` ~ `MKS_Flow_30` | 30 | 工艺管路各处 | `Flow1[0..29]` |
| 离子源 | `IonSource` | 1 | 主腔体附近 | `dbEvapSwitch_fIONCur` / `_fIONVol` / `_fIONVCR` |
| 预加热 H1 / H2 | `Heater_H1` / `Heater_H2` | 2 | 烘干段 | `dbHf_ParPV1` / `dbHf_ParPV2` |

---

## 四、每个 anchor 需要挂载的传感器

下面是**已经映射好**的 anchor → PLC 符号清单。建模同学只需要按 partId 加 anchor，**传感器绑定由前端代码完成**（不需要建模同学在 GLB 里硬编码）。

### 真空腔体（`Chamber_*`）

| anchor | 挂载的传感器（plcSymbol） | 说明 |
| --- | --- | --- |
| `Chamber_1` | `dbVacOpStatus_bChbHiVac1`<br>`dbVacOpStatus_bChbLoVac1_1`<br>`dbVacOpStatus_bChbLoVac1_2` | 高/低真空状态 |
| `Chamber_2_1` | `dbVacOpStatus_bChbHiVac2`<br>`dbVacOpStatus_bChbLoVac2_1`<br>`dbVacOpStatus_bChbLoVac2_2`<br>`dbVacOpStatus_bMPLoVac1`<br>`dbVacOpStatus_nMP1OpStatus` ~ `nMP4OpStatus` | 含前几个分子泵 |
| `Chamber_2_2` | `dbVacOpStatus_bChbLoVac2_1` ~ 已映射到 Chamber_2_1<br>可补充其他 LoVac 变体 | 由建模/工艺决定是否拆分 |
| `Chamber_3` | `dbVacOpStatus_bChbHiVac3`<br>`dbVacOpStatus_bChbLoVac3_1`<br>`dbVacOpStatus_bChbLoVac3_2`<br>`dbVacOpStatus_nMP5OpStatus` ~ `nMP12OpStatus` | |
| `Chamber_4` | `dbVacOpStatus_bChbLoVac4_1`<br>`dbVacOpStatus_bChbLoVac4_2`<br>`dbVacOpStatus_nMP13OpStatus` ~ `nMP28OpStatus` | 分子泵后半段集中于此 |

> 注：腔体具体编号（Chamber_1_1、___2_2 等）需要建模同学与工艺工程师确认设备实际腔体分布。

### 真空泵

| anchor | 挂载的传感器 |
| --- | --- |
| `Pump_P1` ~ `Pump_P9` | `dbVacOpStatus_nP1OpStatus` ~ `nP9OpStatus` |
| `MolecularPump_1` ~ `MolecularPump_28` | `dbVacOpStatus_nMP1OpStatus` ~ `nMP28OpStatus`<br>+ 各自 `dbVacOpStatus_bMPLoVac*`（如能定位） |

### 阀门

| anchor | 挂载的传感器 |
| --- | --- |
| `Valve_CRV1` ~ `Valve_CRV5` | `dbVacOpStatus_nCRV1OpStatus` ~ `nCRV5OpStatus` |
| `Valve_RV1` ~ `Valve_RV4` | `dbVacOpStatus_nRV1OpStatus` ~ `nRV4OpStatus` |
| `Valve_HVV1` ~ `Valve_HVV8` | `dbVacOpStatus_nHVV1OpStatus` ~ `nHVV8OpStatus` |
| `Valve_ISOV1`, `Valve_ISOV2` | `dbVacOpStatus_nISOV1OpStatus`, `nISOV2OpStatus` |
| `Valve_VV1` ~ `Valve_VV3` | `dbVacOpStatus_nVV1OpStatus` ~ `nVV3OpStatus` |
| `Valve_GBV1` ~ `Valve_GBV4` | `dbVacOpStatus_nGBV1OpStatus` ~ `nGBV4OpStatus` |
| `Valve_IonSource` | `dbVacOpStatus_bIonVac` |

### 真空规

| anchor | 挂载的传感器 |
| --- | --- |
| `Gauge_G1` ~ `Gauge_G26` | `dbGauge_fData[0]` ~ `[25]`<br>+ `Gauge_Pirani_Status[1]` ~ `[7]`（G1-G7）/ `Gauge_Comp_Status[1]` ~ `[13]`（G8-G20）/ `dbGauge_nStatus[20]` ~ `[25]`（G21-G26） |

### 磁控阴极

| anchor | 挂载的传感器 |
| --- | --- |
| `MAG_Cathode_1` ~ `MAG_Cathode_28` | `MAG_Frequency[0]` ~ `[27]`<br>+ `MAG_Error_Code[0]` ~ `[27]` |

### 卷绕系统

| anchor | 挂载的传感器 |
| --- | --- |
| `Roller_Unwind` | `HMI_Act_Unwind_R`、`Real_Unwind_TensSV` |
| `Roller_Main` | `dbMaRollPar_fTemp`、所有 `g_ibMaRoll*` 联锁（5 项） |
| `Roller_TensionFro` | `g_ibFroTensionAdd`、`g_ibFroTensionDec` |
| `Roller_TensionBak` | `g_ibBakTensionAdd`、`g_ibBakTensionDec` |
| `Roller_Wind` | `HMI_Act_Wind_R`、`Real_Wind_TensSV`、`Tension_1` ~ `Tension_4` |
| `Axis_1` ~ `Axis_5` | `Axis_*_Operation_Mode`、`Power_Status_Axis_*`、`Status_Axis_*`、`HMI_Act_Vel_Axis_*` |

### MKS / 离子源 / 温度

| anchor | 挂载的传感器 |
| --- | --- |
| `MKS_Flow_1` ~ `MKS_Flow_30` | `Flow1[0]` ~ `[29]` |
| `IonSource` | `dbEvapSwitch_fIONCur`、`dbEvapSwitch_fIONVol`、`dbEvapSwitch_fIONVCR` |
| `PolyCold` | `TP_PolyCold_Com`、`TP_PolyCold_RTN_T`、`TP_PolyCold_FEED_T`、`TP_PolyCold_Lig_T`、`TP_PolyCold_MODE`、`TP_PolyCold_ACTIVE_ALARMS` |
| `Heater_H1` | `dbHf_ParPV1` |
| `Heater_H2` | `dbHf_ParPV2` |

### 溅射电源（`PowerSupply_SP1` ~ `SP6`）

| anchor | 挂载的传感器 |
| --- | --- |
| `PowerSupply_SP1` | `SP1_nPV_P`、`SP1_nPV_V`、`SP1_nPV_C`、`SP1_nArcRate`<br>+ 对应 `g_ibMCT1PwrWatOk`、`g_ibMCT1PwrVacOk`、`g_ibMCT1WatOk` |
| `PowerSupply_SP2` ~ `SP6` | 同上模式（每个电源 4 项数值 + 3 项联锁） |

---

## 五、不挂 3D，仅看板显示的传感器

以下传感器**没有清晰物理位置**或 GLB 里没有对应部件，前端只在"传感器看板"中按分类展示，**不上 3D**：

- **联锁输入** (47 项)：空气、水冷、张力等通用信号，没有专属 3D 部件 → 看板 only
- **真空流程状态**（A 室 / B 室 / C 室的 `nPumpChillStatus*` / `fPumpChillRunTime*` / `nAutoPumpStatus*` / `fAutoVentRunTime*` 等）：抽象流程，**看板 only**
- `nManOpStatus` 手动操作状态
- `bStatusCheckKey` 状态检查触发键
- 任何建模同学评估后认为"找不到合适 anchor"的传感器

---

## 六、交付物 checklist

建模同学交付新 GLB 时，请同时附一份简短的对照说明（Markdown 即可），格式如下：

```markdown
## anchor 清单（按 partId 排序）

| partId | 中文部件 | GLB 中位置（简要） |
| --- | --- | --- |
| Chamber_1 | 腔体 1 | ___01 层第 141 mesh 旁，[0,0,0] 偏移 |
| Chamber_2_1 | 腔体 2-1 | ___01 层第 142 mesh 旁 |
| ... |
| PowerSupply_SP1 | 电源外壳 1 | ___02 层第 172 mesh 旁 |
| ... |
| Roller_Main | 主辊 | 在 Blender 中新增 Empty |
| ... |
```

---

## 七、预估工作量

- **直接用 Empty 命名**：~15 个（已有的语义 mesh + 6 个电源外壳）
- **新增 Empty**：~120 个（泵 + 阀门 + 真空规 + 磁控 + 卷绕 + 流量 + 温控 + 离子源）
- **不需要 anchor**：~250 个（联锁 + 流程状态 + 抽象信号）

总计 **387 个传感器中**：
- ~140 个有 anchor（36%）→ 可以上 3D
- ~250 个没有 anchor（64%）→ 看板 only

完成新 GLB 后，前端 `PLC_SENSOR_META.ts` 里加 `anchor: { partId, offset? }` 字段即可，无需改其他代码。