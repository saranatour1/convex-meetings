import { ConvexError } from "convex/values";

export const describeError = (error: unknown) =>
  error instanceof ConvexError && typeof error.data === "string"
    ? error.data
    : "Something went wrong. Try again.";
