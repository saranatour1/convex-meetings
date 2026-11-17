import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("enforce free usage limits", { minutes: 1 }, internal.internal.usage.enforce, {});

export default crons;
