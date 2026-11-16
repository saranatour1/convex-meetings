import { useMutation, useQuery } from "convex/react";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { api } from "@meetings/backend";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@meetings/ui/components/card";
import { cn } from "@meetings/ui/lib/utils";
import { applyTheme, storedTheme, type ThemePreference } from "#/lib/theme.ts";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof SunIcon }[] = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
];

export const AppearanceSettings = () => {
  const settings = useQuery(api.settings.getMine);
  const save = useMutation(api.settings.setMine);
  const theme = settings?.theme ?? storedTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Applies to the whole app, the calendar and calls, on every device you sign in on.
        </CardDescription>
      </CardHeader>
      <CardPanel>
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3">
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={theme === option.value}
              onClick={() => {
                applyTheme(option.value);
                void save({ theme: option.value });
              }}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm transition-colors hover:bg-accent/50",
                theme === option.value && "border-foreground bg-accent/50",
              )}
            >
              <option.icon className="size-5" />
              {option.label}
            </button>
          ))}
        </div>
      </CardPanel>
    </Card>
  );
};
