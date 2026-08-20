// 用 Blender CLI 把 models-source/coater-20260819.blend 导出为
// public/models/coater-20260819/coater.glb。
//
// 调用方式：node scripts/export-coater-glb.mjs
//
// 依赖：Blender 5.2+ 安装在标准位置，或通过 BLENDER_BIN 环境变量指定。
//
// 导出策略：
//   - GLB 二进制（单文件，自带纹理）
//   - 应用修改器（export_apply）
//   - 材质保留（export_materials=EXPORT），sRGB 颜色由导出器默认处理
//   - 相机/灯光忽略——本项目用代码内置的相机和光源
//   - 动画保留——用户的"渐变动画"依赖 NLA tracks + 单骨架动作
//   - 不导出 morph / skin（这台机器没有顶点动画或骨骼蒙皮）
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const BLENDER = process.env.BLENDER_BIN
  || "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe";

const SRC = resolve("models-source/coater-20260819.blend");
const OUT_DIR = resolve("public/models/coater-20260819");
const OUT_FILE = resolve(OUT_DIR, "coater.glb");

if (!existsSync(SRC)) {
  console.error(`源 .blend 不存在: ${SRC}`);
  process.exit(1);
}
if (!existsSync(BLENDER)) {
  console.error(`找不到 Blender 可执行文件: ${BLENDER}（设置 BLENDER_BIN 环境变量）`);
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });

const pythonExpr = `
import bpy, sys

out_path = r"${OUT_FILE.replace(/\\/g, "\\\\")}"

# 隐藏相机/灯光——它们由代码内置提供
for obj in list(bpy.context.scene.objects):
    if obj.type in ('CAMERA', 'LIGHT'):
        obj.hide_render = True
        obj.hide_viewport = True

# 清理杂物（真正删除而不是隐藏——glTF exporter 不一定遵守 hide_render）：
#   - IndustrialFloor: 21×21 地面平面,不是镀膜机本体
#   - 所有 origin 精确位于 (-6.71, -0.81, -1.23) 的 mesh: 24 个 mesh 共享同一个
#     摆放点(13× Extrusion__055-067 + 6× 图块_02__实体47-52 +
#     4× 零部件23__实体2-5__050-053),全部堆叠——肉眼看上去仍然只是一个 mesh,
#     在 GLB 里纯属冗余。
#   - KEEP_NAMES: 显式保留——Brep__054 主腔体恰好也 origin 在该点,
#     但 8.80 宽 × 2.75 高,是模型主体,绝不能误删。
JUNK_POSITION = (-6.71, -0.81, -1.23)
JUNK_NAMES = {'IndustrialFloor'}
KEEP_NAMES = {'Brep__054'}
to_remove = []

for obj in list(bpy.context.scene.objects):
    if obj.type != 'MESH':
        continue
    if obj.name in KEEP_NAMES:
        continue
    loc = obj.matrix_world.translation
    is_junk = (
        obj.name in JUNK_NAMES
        or (round(loc.x, 2) == JUNK_POSITION[0]
            and round(loc.y, 2) == JUNK_POSITION[1]
            and round(loc.z, 2) == JUNK_POSITION[2])
    )
    if is_junk:
        to_remove.append(obj)

# 必须先取消父子关系再删,否则子节点可能阻止删除
for obj in to_remove:
    if obj.parent:
        obj.parent = None

removed_names = [o.name for o in to_remove]
for obj in to_remove:
    bpy.data.objects.remove(obj, do_unlink=True)

sys.stdout.write(f'JUNK_REMOVED: {len(removed_names)} meshes\\n')
for n in sorted(removed_names):
    sys.stdout.write(f'  - {n}\\n')

if bpy.context.scene.objects:
    bpy.context.view_layer.objects.active = bpy.context.scene.objects[0]

bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    export_apply=True,
    export_materials='EXPORT',
    export_cameras=False,
    export_lights=False,
    export_animations=True,
    export_animation_mode='NLA_TRACKS',
    export_nla_strips=True,
    export_anim_single_armature=True,
    export_skins=False,
    export_morph=False,
)
sys.stdout.write(f'GLB_EXPORTED: {out_path}\\n')
`;

const args = [
  SRC,
  "--background",
  "--python-expr",
  pythonExpr
];

console.log(`[export-glb] 调用: ${BLENDER}`);
console.log(`[export-glb] 源:   ${SRC}`);
console.log(`[export-glb] 目标: ${OUT_FILE}`);

const proc = spawn(BLENDER, args, { stdio: "inherit" });
proc.on("exit", (code) => {
  if (code === 0) {
    console.log(`[export-glb] 完成。`);
  } else {
    console.error(`[export-glb] Blender 退出码 ${code}`);
  }
  process.exit(code ?? 1);
});