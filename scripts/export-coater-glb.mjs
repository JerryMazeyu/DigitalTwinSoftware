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

# 仅选择可见 mesh（避免把被禁用的对象也塞进 GLB）
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH':
        obj.select_set(True)
        obj.hide_render = False
        obj.hide_viewport = False

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