import { ConvexError } from "convex/values";
import { toastManager } from "@meetings/ui/components/toast";

export const describeError = (error: unknown) =>
  error instanceof ConvexError && typeof error.data === "string"
    ? error.data
    : "Something went wrong. Try again.";

export const showError = (error: unknown) =>
  toastManager.add({ title: describeError(error), type: "error" });

export const copyWithToast = (text: string, title: string) =>
  navigator.clipboard
    .writeText(text)
    .then(() => toastManager.add({ title, type: "success" }))
    .catch(() => toastManager.add({ title: "Couldn't copy. Copy it by hand.", type: "error" }));
