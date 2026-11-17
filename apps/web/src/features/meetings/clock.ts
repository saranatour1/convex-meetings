import { useSyncExternalStore } from "react";
import { MINUTE } from "#/lib/schedule.ts";

export const JOIN_EARLY = 10 * MINUTE;

export const countdown = (startsAt: number, now: number) =>
  startsAt <= now ? "Now" : `In ${Math.ceil((startsAt - now) / MINUTE)} min`;

const ticker = (every: number) => ({
  subscribe: (onTick: () => void) => {
    const timer = setInterval(onTick, every / 4);
    return () => clearInterval(timer);
  },
  current: () => Math.floor(Date.now() / every) * every,
});

const minute = ticker(MINUTE);
const second = ticker(1000);

export const useMinute = () => useSyncExternalStore(minute.subscribe, minute.current);

export const useSecond = () => useSyncExternalStore(second.subscribe, second.current);
