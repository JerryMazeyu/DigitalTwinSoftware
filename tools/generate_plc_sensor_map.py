"""Generate src/data/plcSensorMap.ts from the JCD1300 sensor reference markdown.

Run:
    python tools/generate_plc_sensor_map.py

Reads:
    C:/Users/silicon/Desktop/readVars/BeckhoffJMJReader/JCD1300传感器只读点位中文对照表.md

Writes:
    src/data/plcSensorMap.ts
"""

from __future__ import annotations

import re
from collections import OrderedDict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE_MD = Path(r"C:/Users/silicon/Desktop/readVars/BeckhoffJMJReader/JCD1300传感器只读点位中文对照表.md")
OUTPUT_TS = REPO_ROOT / "src" / "data" / "plcSensorMap.ts"


def parse_markdown(text: str) -> list[dict]:
    """Extract every table row from the '传感器对照表' section."""
    rows: list[dict] = []
    in_section = False
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if line.startswith("## 传感器对照表"):
            in_section = True
            continue
        if not in_section:
            continue
        if not line.startswith("|"):
            continue
        # skip header separator like | --- | --- |
        if re.match(r"^\|\s*-+", line):
            continue
        # the first row is the header (序号 | 分类中文 | ...); skip it
        if "序号" in line and "分类中文" in line:
            continue

        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) < 12:
            continue
        try:
            no = int(cells[0])
        except ValueError:
            continue
        rows.append({
            "no": no,
            "categoryCn": cells[1],
            "categoryEn": cells[2],
            "cnName": cells[3],
            "enName": cells[4],
            "plcSymbol": cells[5],
            "opcAddress": cells[6],
            "dataType": cells[7],
            "scanPeriodMs": int(cells[8]) if cells[8].isdigit() else 0,
            "unit": cells[9],
            "valueMeaning": cells[10],
            "remark": cells[11],
        })
    return rows


def derive_categories(rows: list[dict]) -> list[dict]:
    """Build ordered unique category list with counts, preserving first-seen order."""
    seen: "OrderedDict[str, dict]" = OrderedDict()
    for r in rows:
        key = r["categoryEn"]
        if key not in seen:
            seen[key] = {"en": key, "cn": r["categoryCn"], "count": 0}
        seen[key]["count"] += 1
    return list(seen.values())


def ts_string(value: str) -> str:
    """Encode a Python str as a TS double-quoted string literal (UTF-8 safe)."""
    escaped = (
        value.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("\t", "\\t")
    )
    return f'"{escaped}"'


def render_ts(rows: list[dict], categories: list[dict]) -> str:
    lines: list[str] = []
    lines.append("// Auto-generated from JCD1300传感器只读点位中文对照表.md")
    lines.append("// Regenerate with: python tools/generate_plc_sensor_map.py")
    lines.append("// Do not edit by hand.")
    lines.append("")
    lines.append("export type PlcSensorMeta = {")
    lines.append("  no: number;")
    lines.append("  categoryCn: string;")
    lines.append("  categoryEn: string;")
    lines.append("  cnName: string;")
    lines.append("  enName: string;")
    lines.append("  plcSymbol: string;")
    lines.append("  opcAddress: string;")
    lines.append("  dataType: string;")
    lines.append("  scanPeriodMs: number;")
    lines.append("  unit: string;")
    lines.append("  valueMeaning: string;")
    lines.append("  remark: string;")
    lines.append("  /** 3D 模型 anchor（v2 用，v1 留空）。partId 见 docs/plc-mesh-anchor-table.md。 */")
    lines.append("  anchor?: { partId: string; offset?: [number, number, number] };")
    lines.append("};")
    lines.append("")
    lines.append("export const PLC_SENSOR_META: PlcSensorMeta[] = [")
    for r in rows:
        lines.append("  {")
        lines.append(f"    no: {r['no']},")
        lines.append(f"    categoryCn: {ts_string(r['categoryCn'])},")
        lines.append(f"    categoryEn: {ts_string(r['categoryEn'])},")
        lines.append(f"    cnName: {ts_string(r['cnName'])},")
        lines.append(f"    enName: {ts_string(r['enName'])},")
        lines.append(f"    plcSymbol: {ts_string(r['plcSymbol'])},")
        lines.append(f"    opcAddress: {ts_string(r['opcAddress'])},")
        lines.append(f"    dataType: {ts_string(r['dataType'])},")
        lines.append(f"    scanPeriodMs: {r['scanPeriodMs']},")
        lines.append(f"    unit: {ts_string(r['unit'])},")
        lines.append(f"    valueMeaning: {ts_string(r['valueMeaning'])},")
        lines.append(f"    remark: {ts_string(r['remark'])},")
        lines.append("  },")
    lines.append("];")
    lines.append("")
    lines.append("export type PlcCategoryEn =")
    lines.append("  | " + "\n  | ".join(ts_string(c["en"]) for c in categories) + ";")
    lines.append("")
    lines.append("export interface PlcCategory {")
    lines.append("  en: PlcCategoryEn;")
    lines.append("  cn: string;")
    lines.append("  count: number;")
    lines.append("}")
    lines.append("")
    lines.append("export const PLC_CATEGORIES: PlcCategory[] = [")
    for c in categories:
        lines.append(f"  {{ en: {ts_string(c['en'])}, cn: {ts_string(c['cn'])}, count: {c['count']} }},")
    lines.append("];")
    lines.append("")
    lines.append(f"export const PLC_TOTAL_SENSORS = {len(rows)};")
    return "\n".join(lines)


def main() -> int:
    if not SOURCE_MD.exists():
        print(f"ERROR: source markdown not found: {SOURCE_MD}")
        return 1
    text = SOURCE_MD.read_text(encoding="utf-8")
    rows = parse_markdown(text)
    if not rows:
        print("ERROR: no rows parsed — markdown format may have changed.")
        return 1
    categories = derive_categories(rows)
    OUTPUT_TS.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_TS.write_text(render_ts(rows, categories), encoding="utf-8")
    print(f"wrote {OUTPUT_TS.relative_to(REPO_ROOT)}: {len(rows)} rows, {len(categories)} categories")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())