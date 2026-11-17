import { useSyncExternalStore } from "react";
import { MINUTE } from "#/lib/schedule.ts";

const subscribe = (onTick: () => void) => {
  const timer = setInterval(onTick, MINUTE / 4);
  return () => clearInterval(timer);
};

const thisMinute = () => Math.floor(Date.now() / MINUTE) * MINUTE;

export const useMinute = () => useSyncExternalStore(subscribe, thisMinute);
