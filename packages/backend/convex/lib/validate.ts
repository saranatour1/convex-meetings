import { ConvexError } from "convex/values";
import { z } from "zod";

export const parseOrThrow = <Schema extends z.ZodType>(
  schema: Schema,
  value: z.input<Schema>,
): z.output<Schema> => {
  const result = schema.safeParse(value);
  if (!result.success) throw new ConvexError(result.error.issues[0]?.message ?? "Invalid value");
  return result.data;
};

export const zSecret = z.string().regex(/^[0-9a-f]{64}$/);
