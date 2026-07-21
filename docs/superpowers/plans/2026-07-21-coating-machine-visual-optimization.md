# Coating Machine Visual Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a visually improved, Blender-compatible OBJ/MTL copy of the coating machine with a preview Blend file and verified re-import.

**Architecture:** A single standalone Blender Python script imports the source model, classifies existing materials by their names/colors, creates a small controlled material palette, applies smooth shading and conservative surface modifiers, then exports the OBJ/MTL and a preview Blend/PNG. A second verification pass re-imports the exported OBJ into a clean scene and reports structural counts and bounds.

**Tech Stack:** Blender 5.2 Python API, Wavefront OBJ/MTL, PowerShell, existing Blender MCP socket at `127.0.0.1:9876`.

---

### Task 1: Create the repeatable Blender optimization script

**Files:**
- Create: `F:\DigitalTwinSoftware\tools\optimize_coating_machine.py`

- [ ] **Step 1: Add import, material, classification, preview, export, and verification functions.**

  The script must use absolute input/output paths, fail if the source OBJ or MTL is missing, never write to the source paths, import with Blender's OBJ operator, rebuild materials named `CM_Metal`, `CM_Graphite`, `CM_Roller`, `CM_Glass`, `CM_Cyan`, and `CM_Amber`, classify original materials using their names and diffuse colors, apply smooth shading plus a conservative weighted-normal/bevel treatment, create a camera and three area lights, save the Blend, render a 1280x720 PNG, export OBJ/MTL, clear the scene, re-import the exported OBJ, and print JSON-like counts for objects, materials, vertices, polygons, and bounds.

- [ ] **Step 2: Run Blender in background mode against the script.**

  Run `& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python 'F:\DigitalTwinSoftware\tools\optimize_coating_machine.py'`. Expected result: exit code `0`, output files exist, and the script prints non-zero imported/exported object and polygon counts.

### Task 2: Inspect the generated visual asset

**Files:**
- Create: `C:\Users\silicon\Desktop\镀膜机20260702-1_visual.obj`
- Create: `C:\Users\silicon\Desktop\镀膜机20260702-1_visual.mtl`
- Create: `C:\Users\silicon\Desktop\镀膜机20260702-1_visual.blend`
- Create: `C:\Users\silicon\Desktop\镀膜机20260702-1_visual_preview.png`

- [ ] **Step 1: Verify output file sizes and material references.**

  Confirm OBJ, MTL, Blend, and PNG exist and are non-trivial; confirm the OBJ references the generated MTL and contains `usemtl` entries.

- [ ] **Step 2: Re-import and compare structure.**

  Use the script's clean-scene re-import report to confirm the exported model has non-zero objects and polygons, a finite bounding box, and an object count within the same order of magnitude as the source.

- [ ] **Step 3: View the rendered PNG.**

  Open the preview image with the image viewer and inspect that the machine is visible, not clipped, has readable silhouette separation, and does not show excessive glow or transparency.

### Task 3: Record completion details

**Files:**
- Modify: `F:\DigitalTwinSoftware\docs\superpowers\plans\2026-07-21-coating-machine-visual-optimization.md`

- [ ] **Step 1: Mark verified plan steps complete and record any Blender warnings.**

  Keep any warnings that do not invalidate the output visible in the final handoff; do not claim success without the exit code and file checks.
