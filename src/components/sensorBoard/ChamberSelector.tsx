import { CHAMBERS, type ChamberId } from "../../data/chambers";

export type ChamberSelectorProps = {
  /** 当前选中的腔室 id；null = 显示全部。 */
  selected: ChamberId | null;
  /**
   * 用户点击按钮按钮 / 再次点击当前选中按钮时的回调：
   *   - 点未选中的按钮 → 传入对应 id
   *   - 再次点已选中的按钮 → 传入 null（取消选中，恢复显示全部）
   */
  onSelect: (id: ChamberId | null) => void;
};

/**
 * 数字孪生画布下方的腔室筛选按钮组。6 个按钮横向排布，激活状态填充青色。
 * 再次点击已激活按钮取消选中。
 */
export function ChamberSelector({ selected, onSelect }: ChamberSelectorProps) {
  return (
    <div className="chamber-selector" role="group" aria-label="腔室筛选">
      {CHAMBERS.map((c) => {
        const isActive = selected === c.id;
        return (
          <button
            key={c.id}
            type="button"
            className={`chamber-btn${isActive ? " is-active" : ""}`}
            onClick={() => onSelect(isActive ? null : c.id)}
            aria-pressed={isActive}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}