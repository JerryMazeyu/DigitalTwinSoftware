import { useEffect, useRef, useState } from "react";

import { advanceSnapshot, createInitialSnapshot } from "../domain/mockAdapter";
import type { SimulationMode } from "../domain/models";

export const useLiveSnapshot = (mode: SimulationMode) => {
  const tickRef = useRef(1);
  const [snapshot, setSnapshot] = useState(() => createInitialSnapshot(new Date(), mode));

  useEffect(() => {
    tickRef.current = 1;
    setSnapshot(createInitialSnapshot(new Date(), mode));
  }, [mode]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setSnapshot((current) => advanceSnapshot(current, tickRef.current, mode));
      tickRef.current += 1;
    }, 1200);

    return () => window.clearInterval(intervalId);
  }, [mode]);

  return snapshot;
};
