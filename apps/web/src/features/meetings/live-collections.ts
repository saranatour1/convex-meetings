import { createCollection } from "@tanstack/db";
import {
  convexCollectionOptions,
  convexPaginatedCollectionOptions,
} from "@tanstack/convex-db-collection";
import type { ConvexReactClient } from "convex/react";
import { api, type Id } from "@meetings/backend";
import { shared } from "../data/live-query.ts";

type Pass = { guest?: string };

export const meetingPeople = (client: ConvexReactClient, code: string, pass: Pass) =>
  shared(`people:${code}:${pass.guest ?? ""}`, (id) =>
    createCollection(
      convexCollectionOptions({
        id,
        client,
        query: api.meetings.get,
        queryArgs: { code, ...pass },
        select: (meeting) => meeting?.people ?? [],
        getKey: (person) => person._id,
      }),
    ),
  );

export const liveTranscript = (client: ConvexReactClient, meetingId: Id<"meetings">, pass: Pass) =>
  shared(`transcript:${meetingId}:${pass.guest ?? ""}`, (id) =>
    createCollection(
      convexPaginatedCollectionOptions({
        id,
        client,
        query: api.transcripts.live,
        queryArgs: { meetingId, ...pass },
        pageSize: 200,
        maxRows: 5_000,
        getKey: (line) => line._id,
      }),
    ),
  );

export const meetingChat = (client: ConvexReactClient, meetingId: Id<"meetings">, pass: Pass) =>
  shared(`chat:${meetingId}:${pass.guest ?? ""}`, (id) =>
    createCollection(
      convexPaginatedCollectionOptions({
        id,
        client,
        query: api.messages.list,
        queryArgs: { meetingId, ...pass },
        syncMode: "on-demand",
        queryOrder: { field: "_creationTime", direction: "desc" },
        pageSize: 50,
        getKey: (message) => message._id,
      }),
    ),
  );
