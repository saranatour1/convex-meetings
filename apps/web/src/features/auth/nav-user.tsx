import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { LogOutIcon } from "lucide-react";
import { api } from "@meetings/backend";
import { Avatar, AvatarFallback, AvatarImage } from "@meetings/ui/components/avatar";
import {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@meetings/ui/components/sidebar";
import { getInitials } from "#/lib/initials.ts";

export const NavUser = () => {
  const { signOut } = useAuthActions();
  const viewer = useQuery(api.users.viewer);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg">
          <Avatar className="size-8 rounded-lg">
            {viewer?.imageUrl && <AvatarImage src={viewer.imageUrl} alt="" />}
            <AvatarFallback className="rounded-lg">
              {getInitials(viewer?.name ?? "?")}
            </AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-medium">{viewer?.name ?? "…"}</span>
            <span className="truncate text-muted-foreground text-xs">
              {viewer?.method}
              {viewer?.isVerified ? " · verified" : ""}
            </span>
          </span>
        </SidebarMenuButton>
        <SidebarMenuAction aria-label="Sign out" onClick={() => void signOut()}>
          <LogOutIcon />
        </SidebarMenuAction>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
