export const isTimeZone = (value: unknown): value is string => {
  if (typeof value !== "string" || !value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

export const parseZones = (value: unknown) => {
  const zones = (Array.isArray(value) ? value : [value]).filter(isTimeZone);
  return zones.length ? [...new Set(zones)] : undefined;
};
