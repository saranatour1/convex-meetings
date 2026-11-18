import { Link } from "@tanstack/react-router";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import {
  BadgeCheckIcon,
  BuildingIcon,
  ChevronsUpDownIcon,
  LogOutIcon,
  SlidersHorizontalIcon,
  UserIcon,
  VideoIcon,
} from "lucide-react";
import { api } from "@meetings/backend";
import { Avatar, AvatarFallback, AvatarImage } from "@meetings/ui/components/avatar";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@meetings/ui/components/menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@meetings/ui/components/sidebar";
import { showError } from "#/lib/errors.ts";
import { getInitials } from "#/lib/initials.ts";
import { applyTheme, storedTheme, type ThemePreference } from "#/lib/theme.ts";
import { useConvexValue } from "#/features/data/live-query.ts";

const SETTINGS_LINKS = [
  { to: "/settings/account", label: "Account", icon: UserIcon },
  { to: "/settings/general", label: "General", icon: SlidersHorizontalIcon },
  { to: "/settings/meetings", label: "Meetings", icon: VideoIcon },
  { to: "/settings/org", label: "Organization", icon: BuildingIcon },
] as const;

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export const NavUser = () => {
  const { signOut } = useAuthActions();
  const { isMobile } = useSidebar();
  const viewer = useConvexValue(api.users.viewer, {});
  const settings = useConvexValue(api.settings.getMine, {});
  const saveSettings = useMutation(api.settings.setMine);
  const theme = settings?.theme ?? storedTheme();
  const subtitle = viewer?.email ?? (viewer ? "Signed in with a username" : "…");

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {settings && settings.theme !== storedTheme() && (
          <span hidden key={settings.theme} ref={() => applyTheme(settings.theme)} />
        )}
        <Menu>
          <MenuTrigger render={<SidebarMenuButton size="lg" />}>
            <Avatar className="size-8 rounded-lg">
              {viewer?.imageUrl && <AvatarImage src={viewer.imageUrl} alt="" />}
              <AvatarFallback className="rounded-lg">
                {getInitials(viewer?.name ?? "?")}
              </AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate font-medium">{viewer?.name ?? "…"}</span>
              <span className="truncate text-muted-foreground text-xs">{subtitle}</span>
            </span>
            <ChevronsUpDownIcon className="ms-auto size-4 opacity-60" />
          </MenuTrigger>
          <MenuPopup side={isMobile ? "bottom" : "right"} align="end" className="min-w-60">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Avatar className="size-8 rounded-lg">
                {viewer?.imageUrl && <AvatarImage src={viewer.imageUrl} alt="" />}
                <AvatarFallback className="rounded-lg">
                  {getInitials(viewer?.name ?? "?")}
                </AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="flex items-center gap-1 truncate font-medium text-sm">
                  {viewer?.name}
                  {viewer?.isVerified && (
                    <BadgeCheckIcon className="size-3.5 text-success-foreground" />
                  )}
                </span>
                <span className="truncate text-muted-foreground text-xs">{subtitle}</span>
              </span>
            </div>
            <MenuSeparator />
            <MenuGroup>
              <MenuGroupLabel>Settings</MenuGroupLabel>
              {SETTINGS_LINKS.map((link) => (
                <MenuItem key={link.to} render={<Link to={link.to} />}>
                  <link.icon />
                  {link.label}
                </MenuItem>
              ))}
            </MenuGroup>
            <MenuSeparator />
            <MenuGroup>
              <MenuGroupLabel>Appearance</MenuGroupLabel>
              <MenuRadioGroup
                value={theme}
                onValueChange={(value) => {
                  const next = value as ThemePreference;
                  applyTheme(next);
                  void saveSettings({ theme: next }).catch(showError);
                }}
              >
                {THEMES.map((option) => (
                  <MenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </MenuGroup>
            <MenuSeparator />
            <MenuItem onClick={() => void signOut()}>
              <LogOutIcon />
              Sign out
            </MenuItem>
          </MenuPopup>
        </Menu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
