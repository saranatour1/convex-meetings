import { DateTime, IANAZone } from "luxon";
import { z } from "zod";

const TIME_OF_DAY_FORMAT = "HH:mm";

export const zTimeOfDay = z.string().refine(
  (value) => {
    const time = DateTime.fromFormat(value, TIME_OF_DAY_FORMAT);
    return time.isValid && time.toFormat(TIME_OF_DAY_FORMAT) === value;
  },
  { message: "Use HH:mm" },
);

export const zTimeZone = z
  .string()
  .refine((value) => IANAZone.isValidZone(value), { message: "Unknown time zone" });

export const zIsoWeekday = z.number().int().min(1).max(7);
