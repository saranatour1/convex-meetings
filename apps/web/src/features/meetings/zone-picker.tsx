import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
} from "@meetings/ui/components/combobox";
import { listAllZones, type ZoneOption } from "@meetings/ui/kloq/timezone";
import { formatOffset } from "#/lib/schedule.ts";

type Zone = ZoneOption & { offset: string; search: string };

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replaceAll("−", "-")
    .toLowerCase()
    .replace(/[\s_/]+/g, " ");

let cachedZones: Zone[] | undefined;
const allZones = () =>
  (cachedZones ??= listAllZones().map((z) => {
    const offset = formatOffset(Date.now(), z.id);
    return { ...z, offset, search: fold(`${z.label} ${z.region} ${z.id} ${offset}`) };
  }));

type ZonePickerProps = {
  value?: string;
  onChange: (timeZone: string) => void;
  label: string;
  placeholder: string;
  className?: string;
};

export const ZonePicker = ({ value, onChange, label, placeholder, className }: ZonePickerProps) => {
  const zones = allZones();
  const selected = zones.find((z) => z.id === value) ?? null;
  return (
    <Combobox
      autoHighlight
      items={zones}
      value={selected}
      onValueChange={(zone) => zone && onChange(zone.id)}
      itemToStringLabel={(zone) => `${zone.label} (${zone.offset})`}
      filter={(zone, query) => zone.search.includes(fold(query))}
    >
      <ComboboxInput aria-label={label} placeholder={placeholder} size="sm" className={className} />
      <ComboboxPopup>
        <ComboboxEmpty>No time zone matches.</ComboboxEmpty>
        <ComboboxList>
          {(zone: Zone) => (
            <ComboboxItem key={zone.id} value={zone}>
              <span className="flex items-baseline justify-between gap-3">
                <span>
                  {zone.label} <span className="text-muted-foreground">{zone.region}</span>
                </span>
                <span className="text-muted-foreground text-xs tabular-nums">{zone.offset}</span>
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
};
