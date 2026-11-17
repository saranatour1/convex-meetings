import { DirectAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

export type WaitingRoomCount = "waiting" | "joined" | "admitted";

export const waitingRoomCounts = new DirectAggregate<{
  Namespace: [Id<"meetings">, WaitingRoomCount];
  Key: null;
  Id: Id<"users">;
}>(components.waitingRoom);
