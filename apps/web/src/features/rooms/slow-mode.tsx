import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@meetings/ui/components/select";

const SLOW_MODES = [
  { value: "0", label: "Off" },
  { value: "10", label: "One message every 10 seconds" },
  { value: "30", label: "One message every 30 seconds" },
  { value: "60", label: "One message a minute" },
  { value: "300", label: "One message every 5 minutes" },
];

export const slowModeText = (seconds: number) =>
  seconds < 60
    ? `every ${seconds} seconds`
    : seconds === 60
      ? "a minute"
      : `every ${Math.round(seconds / 60)} minutes`;

type SlowModeSelectProps = { id: string; value: number; onChange: (seconds: number) => void };

export const SlowModeSelect = ({ id, value, onChange }: SlowModeSelectProps) => (
  <Select
    value={String(value)}
    onValueChange={(next) => next && onChange(Number(next))}
    items={SLOW_MODES}
  >
    <SelectTrigger id={id}>
      <SelectValue />
    </SelectTrigger>
    <SelectPopup>
      {SLOW_MODES.map((option) => (
        <SelectItem key={option.value} value={option.value}>
          {option.label}
        </SelectItem>
      ))}
    </SelectPopup>
  </Select>
);
