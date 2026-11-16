import { Link } from "@tanstack/react-router";
import { toastManager } from "@meetings/ui/components/toast";
import { describeError } from "#/lib/errors.ts";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@meetings/ui/components/menu";
import { SidebarMenuButton } from "@meetings/ui/components/sidebar";
import { getInitials } from "#/lib/initials.ts";
import { useActiveOrg, useSwitchOrg } from "./active-org.tsx";

export const OrgSwitcher = () => {
  const { orgId, name, orgs } = useActiveOrg();
  const switchOrg = useSwitchOrg();

  return (
    <Menu>
      <MenuTrigger render={<SidebarMenuButton size="lg" />}>
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary font-semibold text-primary-foreground text-xs">
          {getInitials(name)}
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-semibold">{name}</span>
          <span className="truncate text-muted-foreground text-xs">Organization</span>
        </span>
        <ChevronsUpDownIcon className="ms-auto size-4 opacity-60" />
      </MenuTrigger>
      <MenuPopup align="start" className="min-w-56">
        {orgs.map((org) => (
          <MenuItem
            key={org._id}
            onClick={() =>
              void switchOrg({ orgId: org._id }).catch((error: unknown) =>
                toastManager.add({ title: describeError(error), type: "error" }),
              )
            }
          >
            <span className="truncate">{org.name}</span>
            {org._id === orgId && <CheckIcon className="ms-auto" />}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem render={<Link to="/orgs/new" />}>
          <PlusIcon />
          New organization
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
};
