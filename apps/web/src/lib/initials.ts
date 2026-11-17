export const getInitials = (name: string) => {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

const TINTS = [
  "bg-orange-500/15 text-orange-800 dark:text-orange-300",
  "bg-teal-500/15 text-teal-800 dark:text-teal-300",
  "bg-blue-500/15 text-blue-800 dark:text-blue-300",
  "bg-violet-500/15 text-violet-800 dark:text-violet-300",
  "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  "bg-rose-500/15 text-rose-800 dark:text-rose-300",
];

const codeSum = (text: string) =>
  Array.from({ length: text.length }, (_, index) => text.charCodeAt(index)).reduce(
    (sum, code) => sum + code,
    0,
  );

export const avatarTint = (name: string) => TINTS[codeSum(name) % TINTS.length]!;
