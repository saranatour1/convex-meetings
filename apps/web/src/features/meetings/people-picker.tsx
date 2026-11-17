import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxValue,
} from "@meetings/ui/components/combobox";
import type { Person } from "#/lib/schedule.ts";

type PeoplePickerProps = {
  people: Person[];
  value: string[];
  onChange: (ids: string[]) => void;
};

export const PeoplePicker = ({ people, value, onChange }: PeoplePickerProps) => (
  <Combobox
    multiple
    autoHighlight
    items={people}
    value={people.filter((p) => value.includes(p.id))}
    onValueChange={(next: Person[]) => onChange(next.map((p) => p.id))}
    itemToStringLabel={(p: Person) => p.name}
    isItemEqualToValue={(a: Person, b: Person) => a.id === b.id}
  >
    <ComboboxChips>
      <ComboboxValue>
        {(chosen: Person[]) => (
          <>
            {chosen.map((p) => (
              <ComboboxChip key={p.id} aria-label={p.name}>
                {p.name}
              </ComboboxChip>
            ))}
            <ComboboxChipsInput
              aria-label="Invite people"
              placeholder={chosen.length ? "Add more" : "Add people from your organization"}
            />
          </>
        )}
      </ComboboxValue>
    </ComboboxChips>
    <ComboboxPopup>
      <ComboboxEmpty>No one in your organization matches.</ComboboxEmpty>
      <ComboboxList>
        {(p: Person) => (
          <ComboboxItem key={p.id} value={p}>
            <span className="flex items-baseline justify-between gap-3">
              {p.name}
              <span className="text-muted-foreground text-xs">{p.city}</span>
            </span>
          </ComboboxItem>
        )}
      </ComboboxList>
    </ComboboxPopup>
  </Combobox>
);
