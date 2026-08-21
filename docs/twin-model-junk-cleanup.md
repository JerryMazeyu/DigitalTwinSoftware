# Twin 3D 模型杂物排查与清理指南

> 当 3D 镀膜机画面出现非模型本体的"杂物"时，按本文档的流程排查。本指南
> 基于 2026-08-21 的一次杂物排查实战整理。

---

## 1. 问题症状

3D 镀膜机渲染后，画面上出现不属于机器本体的杂物。常见形态：
- 一块面积不大、水平悬空放置的玻璃材质类地板物体
- 一根细长的发光棍/方体（emissive 强）
- 一个发光球体（emissive 强）

杂物位置固定（在某些 X/Y 范围内），与相机视角/旋转无关。

---

## 2. 排查流程（按顺序尝试）

### 步骤 1：先检查 GLB 几何体

GLB 是 R3F 加载的 3D 模型，所有 GLB 内的 mesh 都可能成为杂物源。

**导出当前 GLB 并用 Blender 渲染对比**：
```bash
# 重新导出最新 GLB（执行 scripts/export-coater-glb.mjs 里已有的清理逻辑）
node scripts/export-coater-glb.mjs

# Blender 后台渲染 GLB 到 PNG（模拟 R3F 视角）
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --python-expr "
import bpy
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r'F:\\DigitalTwinSoftware\\public\\models\\coater-20260821\\coater.glb')

# R3F 端：box 居中 + group position [0, 1.9, 0] + scale 1.0
GLB_CENTER = Vector((0, -0.008, 0))
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH': continue
    obj.location = obj.matrix_world.translation - GLB_CENTER
    obj.location.y += 1.9

# 相机 (0, 1.52, 12) fov 30
bpy.ops.object.camera_add(location=(0, 1.52, 18))
cam = bpy.context.object
cam.data.lens = 28
cam.data.sensor_width = 36
cam.rotation_euler = (Vector((0, 1.52, 0)) - cam.location).to_track_quat('-Z', 'Y').to_euler()

# 默认灰色材质便于观察
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH': continue
    if obj.data.materials:
        for mat in obj.data.materials:
            if mat and mat.use_nodes:
                for node in mat.node_tree.nodes:
                    if node.type == 'BSDF_PRINCIPLED':
                        node.inputs['Base Color'].default_value = (0.8, 0.8, 0.8, 1)

scene = bpy.context.scene
scene.render.resolution_x = 1280; scene.render.resolution_y = 560
scene.render.engine = 'BLENDER_EEVEE'
scene.camera = cam
scene.render.filepath = r'F:\\tmp\\glb_check.png'
bpy.ops.render.render(write_still=True)
"
```

**关键检查点**：
- GLB bbox = `(8.80, 2.05, 3.62)` 附近（镀膜机标准尺寸），scale ≈ 1.0
- 任何**凸出**、**错位**、**形态怪异**的可见 mesh = 可能是杂物源
- 用 Blender 列出所有 mesh 实际顶点位置（不是 `matrix_world.translation`！）：
  ```python
  mesh = obj.data
  verts = [obj.matrix_world @ v.co for v in mesh.vertices]
  # ⚠ obj.matrix_world.translation 是 GLTF node transform，不一定是 mesh
  #   几何中心。如果父子嵌套有内部旋转/缩放，二者会差很大。
  ```

如果 Blender 渲染图已显示出杂物 → 杂物在 GLB 里。继续到步骤 2。
如果 Blender 渲染图**没有**杂物，但浏览器有 → 杂物不在 GLB 里，跳到步骤 3。

### 步骤 2：GLB 端杂物清理

在 `scripts/export-coater-glb.mjs` 的 Python 内联脚本里加规则：

```python
to_remove = []
for obj in list(bpy.context.scene.objects):
    if obj.type != 'MESH':
        continue
    if obj.name == 'IndustrialFloor':     # 21×21 地面平面
        to_remove.append(obj)
        continue
    # 例：删除所有空 mesh（vertices 数 = 0）
    if len(obj.data.vertices) == 0:
        to_remove.append(obj)
        continue
    # 例：删除所有 origin 在某点的 stack mesh
    loc = obj.matrix_world.translation
    if (round(loc.x, 2) == -6.71 and round(loc.y, 2) == -0.81 and round(loc.z, 2) == -1.23):
        if obj.name != 'Brep__054':       # 保留主腔体
            to_remove.append(obj)
```

重跑 `node scripts/export-coater-glb.mjs`，回到步骤 1 重新渲染验证。

### 步骤 3：检查 R3F 端 inline 几何体

如果步骤 1 / 2 都查不到杂物源，杂物大概率是 **R3F JSX 内联的 `<mesh>`**：
- `<boxGeometry>` / `<sphereGeometry>` / `<cylinderGeometry>` / `<planeGeometry>` 等

**搜索关键字**（在 `src/components/` 下的 R3F 文件里）：
```bash
grep -rE 'boxGeometry|sphereGeometry|cylinderGeometry|planeGeometry|circleGeometry' src/
```

每个匹配点都是潜在的杂物源。**检查逻辑**：
1. mesh 位置是否**硬编码**为绝对坐标（`position={[X, Y, Z]}`）？
   - 是 → 风险高（可能与新模型坐标对不上）
   - 否（用 prop 传）→ 通常是 fallback / decorative，正确
2. mesh 颜色是否 `riskColor[riskLevel]` 或其他状态色（绿/橙/红）？
   - 是 → 装饰用途，可能被误认为杂物
3. mesh 是否带 `emissive` 或 `transparent`？
   - 是 → 高亮/光晕用途，容易被误认为杂物

**典型错位案例**（2026-08-21 已发生）：

| 几何体 | 位置 | 颜色 | 用途 | 问题 |
|------|------|------|------|------|
| `<boxGeometry args={[0.06, 0.06, 1.12]}>` | `[1.82, 0.9, 0.78]` | `riskColor` | 装饰棒 | 位置是旧 fallback 场景的硬编码 |
| `<sphereGeometry args={[0.095, 24, 24]}>` | `[3.05, 1.98, -0.48]` | `riskColor` | 装饰球 | 同上 |
| `<boxGeometry args={[1.32, 0.032, 1.06]}>` | `[-2.74, 0.46, 0]` | `#c0d3d6` 半透明 | 装饰玻璃板 | 同上 |

这三个 mesh 来自 `src/components/TwinMachine3D.tsx` 的 `<ModelStatusLayer>` 组件，
位置基于旧 fallback 场景的 `Beam/Roller/Bearing` 坐标。新 GLB 模型经过 Box3 居中
+ `Y + 1.9` 抬升后，模型位置已经变了，所以这三个 mesh "漂"在画面里被误认为杂物。

**修复**：删除 `<ModelStatusLayer>` 内三个 mesh，保留空 `<group />` 不破坏外部引用。

---

## 3. 当前导出脚本能自动清理的 .blend 端杂物

| 名称 | 规则 | 已处理 |
|------|------|------|
| `IndustrialFloor` | 21×21 地面平面 | ✓ |
| 任意空 mesh（`len(vertices) == 0`） | 占位 mesh，无渲染数据 | ✗（脚本未启用，潜在杂物） |
| 任意 stack mesh（同一 origin + 多 mesh） | 父级 transform 偏移后顶点重叠在画面 | ✗（需要人工判断） |

**建议：未来在 export 脚本里加上空 mesh 删除规则**：
```python
if len(obj.data.vertices) == 0:
    to_remove.append(obj)
```

这是无害的清理——空 mesh 渲染什么都不显示，删除只是减小 GLB 文件。

---

## 4. R3F 端"装饰组件"清单

下列组件是装饰用途，**位置与硬编码相关**——未来换 GLB 时要重新校验：

- `src/components/TwinMachine3D.tsx`:
  - `<ModelStatusLayer>` — alert 状态装饰，已清空
  - `<MachineScene>` — fallback 场景（用 `<Roller>`/`<Beam>` 等内联组件构建完整场景），仅在 GLB 加载失败时显示
  - `<ChamberMask>` — 选中腔室时的 2D 蒙版，坐标来自 `chamberMaskConfig.ts`，与 GLB 模型独立
  - `<MeshPlcLabelBannerTracker>` — 锚点 banner，跟随 cluster.worldPosition，由 PLC 数据驱动

如果将来重做 GLB 后看到画面里有"漂的"几何体：
1. 在浏览器 F12 → Sources / React DevTools 找到对应组件
2. 检查 `<mesh position={[X, Y, Z]}>` 是否硬编码
3. 删除该 mesh 或调整坐标

---

## 5. 验证清单

每次换 GLB 后，按顺序验证：
- [ ] `npm run build` 通过（typecheck）
- [ ] 启动 dev server，打开应用
- [ ] 旋转 3D 视角 → 没有"漂的"装饰几何体
- [ ] 切换 chamber selector（如果启用） → chamber mask 与模型腔室位置对应
- [ ] 闲置 15s → 视频覆盖整个画布，高度对齐数据面板

---

## 6. 已知 .blend → GLB 工具与文件

| 文件 | 作用 |
|------|------|
| `scripts/export-coater-glb.mjs` | .blend → .glb 导出（已含 IndustrialFloor 删除） |
| `models-source/coater-20260821.blend` | 当前 .blend 源文件 |
| `public/models/coater-20260821/coater.glb` | 当前 GLB 输出（70 个 mesh） |
| `scripts/compare-glbs.mjs` | 对比新旧 GLB 差异（mesh 数量、bbox、extremal mesh） |

切换 .blend 时：
1. 复制到 `models-source/coater-<日期>.blend`
2. 更新 `scripts/export-coater-glb.mjs` 的 `SRC` 常量
3. 更新 `OUT_DIR` 到新的目录名
4. 更新 `src/components/CoaterObjModel.tsx` 的 `MODEL_DIR`
5. 更新 `server/model-assets.test.mjs` 的 `modelDir`
6. 跑 `node scripts/export-coater-glb.mjs`
7. `npm run build` + 浏览器验证