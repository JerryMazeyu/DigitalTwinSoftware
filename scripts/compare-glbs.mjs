// 在 Blender 中分别加载两个 GLB 并打印场景级的对比信息：
//   - mesh 总数
//   - 整体包围盒（含/排除地板类超薄 mesh）
//   - 每个轴向的极端 mesh（最左/最右/最前/最后/最高/最低）
//   - 类辊轮柱体沿 X 轴的位置列表
//
// 用法：node scripts/compare-glbs.mjs
// 依赖：Blender 5.2+ 安装在标准位置（与 export-coater-glb.mjs 相同）。
//
// 准备：从 git 历史各取一份 GLB 到 /tmp/glb-compare/ 后运行：
//   git show 7f82f8d:public/models/coater-20260721/coater.glb > /tmp/glb-compare/old-coater.glb
//   git show ea034bb:public/models/coater-20260819/coater.glb > /tmp/glb-compare/new-coater.glb
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";

// Git Bash 把 /tmp 映射到 C:\Users\<user>\AppData\Local\Temp。
// Blender 在 Windows 上需要 Win32 路径，所以做一次转换。
const oldGlbBash = "/tmp/glb-compare/old-coater.glb";
const newGlbBash = "/tmp/glb-compare/new-coater.glb";
const winTmp = `${tmpdir()}\\glb-compare`;
const oldWin = `${winTmp}\\old-coater.glb`;
const newWin = `${winTmp}\\new-coater.glb`;

const BLENDER =
 process.env.BLENDER_BIN ||
 "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe";

if (!existsSync(BLENDER)) {
 console.error(`找不到 Blender: ${BLENDER}`);
 process.exit(1);
}
if (!existsSync(oldWin) || !existsSync(newWin)) {
 console.error(`GLB 文件未就位: ${oldWin} / ${newWin}`);
 console.error("请先从 git 提取两个 GLB：");
 console.error("  git show 7f82f8d:public/models/coater-20260721/coater.glb > /tmp/glb-compare/old-coater.glb");
 console.error("  git show ea034bb:public/models/coater-20260819/coater.glb > /tmp/glb-compare/new-coater.glb");
 process.exit(1);
}

const pythonExpr = `
import bpy, sys
from mathutils import Vector

def analyze(label, glb_path):
    # 清空场景，避免上一轮的 mesh 残留
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb_path)

    sys.stdout.write(f'\\n===== {label} =====\\n')
    sys.stdout.write(f'GLB: {glb_path}\\n')

    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    sys.stdout.write(f'MESH_COUNT: {len(meshes)}\\n')
    sys.stdout.write(f'EXTRUSION_COUNT: {sum(1 for o in meshes if \"Extrusion\" in o.name)}\\n')
    sys.stdout.write(f'ROLLER_LIKE_COUNT: {sum(1 for o in meshes if \"辊\" in o.name or \"roller\" in o.name.lower() or \"图块\" in o.name)}\\n')
    sys.stdout.write(f'CAVITY_LIKE_COUNT: {sum(1 for o in meshes if \"cavity\" in o.name.lower() or \"cavity_\" in o.name.lower())}\\n')

    # 每个 mesh 的详细信息：名字、verts、polys、bbox（在 Blender 本地坐标系里）
    for o in meshes:
        bb_min = [float(\"inf\")] * 3
        bb_max = [-float(\"inf\")] * 3
        for corner in o.bound_box:
            wc = o.matrix_world @ Vector(corner)
            for i in range(3):
                bb_min[i] = min(bb_min[i], wc[i])
                bb_max[i] = max(bb_max[i], wc[i])
        size = [bb_max[i] - bb_min[i] for i in range(3)]
        sys.stdout.write(f'  MESH \"{o.name[:35]}\" verts={len(o.data.vertices)} polys={len(o.data.polygons)} '
                         f'pos=({o.matrix_world.translation[0]:.2f},{o.matrix_world.translation[1]:.2f},{o.matrix_world.translation[2]:.2f}) '
                         f'size=({size[0]:.2f},{size[1]:.2f},{size[2]:.2f})\\n')

    # 全部 mesh 的整体包围盒（取 mesh.matrix_world @ corner）
    box_min = [float(\"inf\")] * 3
    box_max = [-float(\"inf\")] * 3
    for obj in meshes:
        for corner in obj.bound_box:
            wc = obj.matrix_world @ Vector(corner)
            for i in range(3):
                box_min[i] = min(box_min[i], wc[i])
                box_max[i] = max(box_max[i], wc[i])
    size = [box_max[i] - box_min[i] for i in range(3)]
    sys.stdout.write(f'BBOX_ALL min=({box_min[0]:.3f},{box_min[1]:.3f},{box_min[2]:.3f}) '
                     f'max=({box_max[0]:.3f},{box_max[1]:.3f},{box_max[2]:.3f}) '
                     f'size=({size[0]:.3f},{size[1]:.3f},{size[2]:.3f})\\n')

    # 排除地板（薄板 z 厚度 ≈ 0）+ 灯空轴（名字带 __054/__055 等超长 extrusion）：
    # 只保留"机器本体"——每个 mesh 的体积 > 一定阈值的
    body_meshes = [o for o in meshes if (o.dimensions[0]*o.dimensions[1]*o.dimensions[2]) > 0.001]
    box_min2 = [float(\"inf\")] * 3
    box_max2 = [-float(\"inf\")] * 3
    for obj in body_meshes:
        for corner in obj.bound_box:
            wc = obj.matrix_world @ Vector(corner)
            for i in range(3):
                box_min2[i] = min(box_min2[i], wc[i])
                box_max2[i] = max(box_max2[i], wc[i])
    size2 = [box_max2[i] - box_min2[i] for i in range(3)]
    sys.stdout.write(f'BBOX_BODY min=({box_min2[0]:.3f},{box_min2[1]:.3f},{box_min2[2]:.3f}) '
                     f'max=({box_max2[0]:.3f},{box_max2[1]:.3f},{box_max2[2]:.3f}) '
                     f'size=({size2[0]:.3f},{size2[1]:.3f},{size2[2]:.3f})\\n')

    # 找每个轴向极端
    def extreme(axis, fn):
        return fn(meshes, key=lambda o: (obj_axis(o, axis)))
    def obj_axis(o, a):
        return (o.matrix_world.translation[a])

    leftmost = min(meshes, key=lambda o: obj_axis(o, 0))
    rightmost = max(meshes, key=lambda o: obj_axis(o, 0))
    frontmost = max(meshes, key=lambda o: obj_axis(o, 1))
    backmost = min(meshes, key=lambda o: obj_axis(o, 1))
    topmost = max(meshes, key=lambda o: obj_axis(o, 2))
    bottommost = min(meshes, key=lambda o: obj_axis(o, 2))
    sys.stdout.write(f'X_EXTREMES: left={leftmost.name}({obj_axis(leftmost,0):.2f}) right={rightmost.name}({obj_axis(rightmost,0):.2f})\\n')
    sys.stdout.write(f'Y_EXTREMES: front={frontmost.name}({obj_axis(frontmost,1):.2f}) back={backmost.name}({obj_axis(backmost,1):.2f})\\n')
    sys.stdout.write(f'Z_EXTREMES: top={topmost.name}({obj_axis(topmost,2):.2f}) bottom={bottommost.name}({obj_axis(bottommost,2):.2f})\\n')

    # 类辊轮柱体（cylinder / Extrusion__05x 长轴垂直）
    cylinders = []
    for o in meshes:
        d = o.dimensions
        # 长轴 z (Blender)，其余两轴较小
        if max(d) == d[2] and d[2] > 1.5 and d[0] < d[2] * 0.7 and d[1] < d[2] * 0.7:
            cylinders.append(o)
    cylinders.sort(key=lambda o: obj_axis(o, 0))
    sys.stdout.write(f'CYLINDER_VERTICAL_COUNT: {len(cylinders)}\\n')
    for c in cylinders[:8]:
        sys.stdout.write(f'  cyl {c.name[:30]:<30} pos=({obj_axis(c,0):.2f},{obj_axis(c,1):.2f},{obj_axis(c,2):.2f}) dim={c.dimensions[:]}\\n')
    if len(cylinders) > 8:
        sys.stdout.write(f'  ... +{len(cylinders)-8} more\\n')

analyze('OLD GLB', r'${oldWin.replace(/\\\\/g, "\\\\\\\\")}')
analyze('NEW GLB', r'${newWin.replace(/\\\\/g, "\\\\\\\\")}')
`;

const proc = spawn(BLENDER, ["--background", "--python-expr", pythonExpr], { stdio: "inherit" });
proc.on("exit", (code) => process.exit(code ?? 1));