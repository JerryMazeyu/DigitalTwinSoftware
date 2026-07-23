import json
import math
import os
from pathlib import Path

import bpy
from mathutils import Vector


SOURCE = Path(r"C:\Users\silicon\Desktop\镀膜机20260702-1_optimized.obj")
OUTPUT = Path(r"C:\Users\silicon\Desktop\镀膜机20260702-1_visual.obj")
BLEND_OUTPUT = OUTPUT.with_suffix(".blend")
PREVIEW_OUTPUT = OUTPUT.with_name(OUTPUT.stem + "_preview.png")


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def import_obj(path):
    if not path.exists():
        raise FileNotFoundError(path)
    bpy.ops.wm.obj_import(filepath=str(path), forward_axis="NEGATIVE_Z", up_axis="Y")
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def make_material(name, base_color, metallic=0.0, roughness=0.45, transmission=0.0, alpha=1.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*base_color, alpha)
    mat.surface_render_method = "DITHERED" if alpha < 1.0 else "DITHERED"
    nodes = mat.node_tree.nodes
    principled = nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (*base_color, 1.0)
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    if "Transmission Weight" in principled.inputs:
        principled.inputs["Transmission Weight"].default_value = transmission
    if "Alpha" in principled.inputs:
        principled.inputs["Alpha"].default_value = alpha
    if alpha < 1.0:
        mat.surface_render_method = "DITHERED"
    return mat


def build_palette():
    return {
        "metal": make_material("CM_Metal", (0.34, 0.39, 0.44), metallic=0.82, roughness=0.38),
        "graphite": make_material("CM_Graphite", (0.045, 0.06, 0.075), metallic=0.42, roughness=0.30),
        "roller": make_material("CM_Roller", (0.075, 0.085, 0.09), metallic=0.12, roughness=0.48),
        "glass": make_material("CM_Glass", (0.08, 0.30, 0.40), metallic=0.08, roughness=0.18, transmission=0.35, alpha=0.72),
        "cyan": make_material("CM_Cyan", (0.02, 0.42, 0.58), metallic=0.38, roughness=0.28),
        "amber": make_material("CM_Amber", (0.72, 0.30, 0.055), metallic=0.18, roughness=0.32),
    }


def classify_material(mat):
    name = (mat.name if mat else "").lower()
    color = tuple(mat.diffuse_color[:3]) if mat else (1.0, 1.0, 1.0)
    if "glass" in name or "translucent" in name:
        return "glass"
    if "204_204_102" in name or (color[0] > 0.65 and color[1] > 0.55 and color[2] < 0.5):
        return "amber"
    if "191_255" in name or (color[2] > 0.75 and color[1] > 0.55 and color[0] < 0.25):
        return "cyan"
    if "76_153_133" in name or (0.25 < color[1] < 0.75 and color[2] > 0.35 and color[0] < 0.4):
        return "cyan"
    if "0_63_127" in name or (color[2] > 0.25 and color[0] < 0.1 and color[1] < 0.4):
        return "graphite"
    if "h02" in name:
        return "glass"
    return "metal"


def apply_visual_materials(objects, palette):
    for obj in objects:
        if obj.type != "MESH":
            continue
        for slot in obj.material_slots:
            slot.material = palette[classify_material(slot.material)]
        if not obj.material_slots:
            obj.data.materials.append(palette["metal"])
        for poly in obj.data.polygons:
            poly.use_smooth = True
        if len(obj.data.polygons) < 12000:
            bevel = obj.modifiers.new("CM_SubtleEdge", "BEVEL")
            bevel.width = 0.0015
            bevel.segments = 2
            bevel.limit_method = "ANGLE"
            bevel.angle_limit = math.radians(28.0)


def bounds(objects):
    points = [Vector(corner) for obj in objects for corner in obj.bound_box]
    if not points:
        raise RuntimeError("Imported scene contains no mesh bounds")
    min_v = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    max_v = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return min_v, max_v


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def setup_preview(objects):
    min_v, max_v = bounds(objects)
    center = (min_v + max_v) / 2.0
    size = max(max_v - min_v)
    camera_data = bpy.data.cameras.new("CM_PreviewCamera")
    camera = bpy.data.objects.new("CM_PreviewCamera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = center + Vector((size * 1.45, -size * 1.55, size * 0.95))
    camera_data.lens = 52
    camera_data.clip_start = max(size * 0.00001, 0.001)
    camera_data.clip_end = size * 20.0
    look_at(camera, center)
    bpy.context.scene.camera = camera

    def area(name, location, energy, color, size_value):
        light_data = bpy.data.lights.new(name, "AREA")
        light_data.energy = energy
        light_data.color = color
        light_data.shape = "DISK"
        light_data.size = size_value
        light = bpy.data.objects.new(name, light_data)
        bpy.context.collection.objects.link(light)
        light.location = center + Vector(location)
        look_at(light, center)

    def sun(name, rotation, energy, color):
        light_data = bpy.data.lights.new(name, "SUN")
        light_data.energy = energy
        light_data.color = color
        light = bpy.data.objects.new(name, light_data)
        bpy.context.collection.objects.link(light)
        light.rotation_euler = rotation

    sun("CM_SunKey", (math.radians(32), math.radians(-24), math.radians(-38)), 2.8, (0.86, 0.92, 1.0))
    sun("CM_SunFill", (math.radians(-28), math.radians(22), math.radians(142)), 1.4, (0.52, 0.68, 0.82))

    area("CM_Key", (size * 0.55, -size * 0.8, size * 1.35), 1300, (0.82, 0.91, 1.0), size * 0.9)
    area("CM_Fill", (-size * 1.1, -size * 0.35, size * 0.45), 850, (0.55, 0.75, 0.95), size * 0.75)
    area("CM_Rim", (size * 0.4, size * 0.85, size * 0.95), 1150, (1.0, 0.48, 0.18), size * 0.65)

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(PREVIEW_OUTPUT)
    scene.world.color = (0.035, 0.045, 0.055)
    scene.view_settings.look = "AgX - Medium High Contrast"


def stats(objects):
    min_v, max_v = bounds(objects)
    return {
        "objects": len(objects),
        "materials": len({slot.material.name for obj in objects for slot in obj.material_slots if slot.material}),
        "vertices": sum(len(obj.data.vertices) for obj in objects),
        "polygons": sum(len(obj.data.polygons) for obj in objects),
        "bounds_min": [round(v, 6) for v in min_v],
        "bounds_max": [round(v, 6) for v in max_v],
    }


def export_obj(objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.wm.obj_export(
        filepath=str(OUTPUT),
        export_materials=True,
        export_triangulated_mesh=True,
        export_normals=True,
        export_uv=True,
        export_selected_objects=True,
    )


def main():
    clear_scene()
    objects = import_obj(SOURCE)
    source_stats = stats(objects)
    palette = build_palette()
    apply_visual_materials(objects, palette)
    setup_preview(objects)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_OUTPUT))
    bpy.context.scene.render.filepath = str(PREVIEW_OUTPUT)
    bpy.ops.render.render(write_still=True)
    export_obj(objects)

    clear_scene()
    exported_objects = import_obj(OUTPUT)
    export_stats = stats(exported_objects)
    if export_stats["polygons"] == 0 or export_stats["objects"] == 0:
        raise RuntimeError("Exported OBJ re-imported empty")
    print(json.dumps({"source": source_stats, "exported": export_stats, "outputs": [str(OUTPUT), str(BLEND_OUTPUT), str(PREVIEW_OUTPUT)]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
