import { useSyncExternalStore } from "react";

export type Step = { kind: "add" | "remove"; ids: string[] };
export type History = { undo: Step[]; redo: Step[] };

const LIMIT = 100;
const EMPTY: History = { undo: [], redo: [] };
const histories = new Map<string, History>();
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const historyOf = (shareId: string) => histories.get(shareId) ?? EMPTY;

export const record = (shareId: string, step: Step) => {
  histories.set(shareId, { undo: [...historyOf(shareId).undo, step].slice(-LIMIT), redo: [] });
  emit();
};

export const forget = (shareId: string) => {
  histories.delete(shareId);
  emit();
};

export const takeStep = (shareId: string, from: keyof History) => {
  const history = historyOf(shareId);
  const step = history[from].at(-1);
  if (!step) return undefined;
  histories.set(shareId, { ...history, [from]: history[from].slice(0, -1) });
  emit();
  return step;
};

export const putStep = (shareId: string, to: keyof History, step: Step) => {
  const history = historyOf(shareId);
  histories.set(shareId, { ...history, [to]: [...history[to], step] });
  emit();
};

export const useHistory = (shareId: string) =>
  useSyncExternalStore(
    subscribe,
    () => historyOf(shareId),
    () => EMPTY,
  );
