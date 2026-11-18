import { createCollection, localOnlyCollectionOptions } from "@tanstack/db";
import {
  convexCollectionOptions,
  convexPaginatedCollectionOptions,
} from "@tanstack/convex-db-collection";
import { useLiveInfiniteQuery, useLiveQuery } from "@tanstack/react-db";
import { type ConvexReactClient, useConvex } from "convex/react";
import {
  type FunctionArgs,
  type FunctionReference,
  type FunctionReturnType,
  getFunctionName,
  type PaginationOptions,
  type PaginationResult,
} from "convex/server";

type Query = FunctionReference<"query">;
type PagedQuery = FunctionReference<
  "query",
  "public",
  { paginationOpts: PaginationOptions },
  PaginationResult<object>
>;
type PagedArgs<Q extends PagedQuery> = Omit<FunctionArgs<Q>, "paginationOpts">;
type PagedRow<Q extends PagedQuery> = FunctionReturnType<Q>["page"][number];
type Value<Q extends Query> = { key: "value"; value: FunctionReturnType<Q> };
type Ordered<Q extends PagedQuery> = PagedRow<Q> & { _order: number };

const collections = new Map<string, { status: string }>();

export const shared = <T extends { status: string }>(key: string, create: (id: string) => T): T => {
  const found = collections.get(key) as T | undefined;
  if (found && found.status !== "cleaned-up") return found;
  const created = create(`${key}:${crypto.randomUUID()}`);
  collections.set(key, created);
  return created;
};

const keyOf = (query: Query, args: unknown) => `${getFunctionName(query)}:${JSON.stringify(args)}`;

export const valueCollection = <Q extends Query>(
  client: ConvexReactClient,
  query: Q,
  args: FunctionArgs<Q>,
) =>
  shared(`value:${keyOf(query, args)}`, (id) =>
    createCollection(
      convexCollectionOptions<Q, Value<Q>, "value">({
        id,
        client,
        query,
        queryArgs: args,
        select: (value) => [{ key: "value", value }],
        getKey: (row) => row.key,
      }),
    ),
  );

export const pagesCollection = <Q extends PagedQuery>(
  client: ConvexReactClient,
  query: Q,
  args: PagedArgs<Q>,
) =>
  shared(
    `pages:${keyOf(query, args)}`,
    (id) =>
      createCollection(
        convexPaginatedCollectionOptions<PagedQuery, { _order: number }, number>({
          id,
          client,
          query,
          queryArgs: args,
          pageSize: 100,
          select: (rows) => rows.map((row, index) => ({ ...row, _order: index })),
          getKey: (row) => row._order,
        }),
      ) as unknown as ReturnType<typeof createCollection<Ordered<Q>, number>>,
  );

const nothing = createCollection(
  localOnlyCollectionOptions<{ _order: number }, number>({
    id: "nothing",
    getKey: (row) => row._order,
  }),
);

export const useConvexValue = <Q extends Query>(
  query: Q,
  args: FunctionArgs<Q> | "skip",
): FunctionReturnType<Q> | undefined => {
  const client = useConvex();
  const source = args === "skip" ? null : valueCollection(client, query, args);
  const { data, isReady, status } = useLiveQuery((q) =>
    source ? q.from({ row: source }).findOne() : undefined,
  );
  if (source && status === "error") throw source.utils.getSyncError();
  return isReady ? data?.value : undefined;
};

export const useConvexPages = <Q extends PagedQuery>(
  query: Q,
  args: PagedArgs<Q> | "skip",
  { initialNumItems }: { initialNumItems: number },
) => {
  const client = useConvex();
  const source = args === "skip" ? null : pagesCollection(client, query, args);
  const pages = useLiveInfiniteQuery(
    (q) =>
      q
        .from({ row: (source ?? nothing) as ReturnType<typeof pagesCollection<Q>> })
        .orderBy(({ row }) => row._order, "asc"),
    { pageSize: initialNumItems },
  );
  if (source && pages.status === "error") throw source.utils.getSyncError();
  const loading = source !== null && !pages.isReady;
  return {
    results: pages.data as Ordered<Q>[],
    status: loading
      ? ("LoadingFirstPage" as const)
      : pages.hasNextPage
        ? ("CanLoadMore" as const)
        : ("Exhausted" as const),
    isLoading: loading,
    loadMore: (_numItems?: number) => void pages.fetchNextPage(),
  };
};
