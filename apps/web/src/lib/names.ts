const firstName = (name: string) => name.split(/\s+/)[0] ?? name;

export const nameList = (names: string[], shown = 2) => {
  const first = names.slice(0, shown).map(firstName);
  const others = names.length - first.length;
  if (others > 0) return `${first.join(", ")} and ${others} ${others === 1 ? "other" : "others"}`;
  if (first.length < 2) return first.join("");
  return `${first.slice(0, -1).join(", ")} and ${first.at(-1)}`;
};
