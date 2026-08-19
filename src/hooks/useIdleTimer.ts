import { useEffect, useState } from "react";

/**
 * 触发「用户有操作」的事件类型。以鼠标点击（pointerdown）为准——用户要求
 * "无鼠标点击"即空闲；滚轮 / 键盘也属于操作，一并打断，避免缩放 / 快捷键
 * 期间误入空闲。如需严格限定鼠标点击，把下面常量收敛为 ["pointerdown"]。
 * 不监听 pointermove（连续移动会导致永不空闲）。
 */
export const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel"] as const;

/**
 * 空闲计时：返回 true 当且仅当 idleMs 毫秒内没有任何用户操作。
 * 任一操作（点击 / 键盘 / 滚轮）都会立即退出空闲并从头重新计时。
 * capture + passive 监听：提前干预且不阻塞滚动。StrictMode 双挂载下
 * cleanup 会正确清掉过期 timer，不会留下孤儿计时。
 */
export function useIdleTimer(idleMs: number): boolean {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    let timer: number | null = null;

    const startTimer = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), idleMs);
    };

    const onActivity = () => {
      setIdle(false);
      startTimer();
    };

    startTimer();
    for (const type of ACTIVITY_EVENTS) {
      window.addEventListener(type, onActivity, { capture: true, passive: true });
    }

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      for (const type of ACTIVITY_EVENTS) {
        window.removeEventListener(type, onActivity, { capture: true });
      }
    };
  }, [idleMs]);

  return idle;
}