import { useSyncExternalStore } from "react";
import { MINUTE } from "#/lib/schedule.ts";

export const JOIN_EARLY = 10 * MINUTE;

export const countdown = (startsAt: number, now: number) =>
  startsAt <= now ? "Now" : `In ${Math.ceil((startsAt - now) / MINUTE)} min`;

const subscribe = (onTick: () => void) => {
  const timer = setInterval(onTick, MINUTE / 4);
  return () => clearInterval(timer);
};

const thisMinute = () => Math.floor(Date.now() / MINUTE) * MINUTE;

export const useMinute = () => useSyncExternalStore(subscribe, thisMinute);
