import { Link, useMatchRoute } from "@tanstack/react-router";
import {
  ArmchairIcon,
  CalendarDaysIcon,
  HouseIcon,
  InboxIcon,
  UsersIcon,
  VideoIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@meetings/ui/components/sidebar";
import { useQuery } from "convex/react";
import { api } from "@meetings/backend";
import { NavUser } from "#/features/auth/nav-user.tsx";
import { OrgSwitcher } from "#/features/orgs/org-switcher.tsx";

const LINKS = [
  { title: "Home", to: "/home", icon: HouseIcon },
  { title: "Meetings", to: "/meetings", icon: VideoIcon },
  { title: "Calendar", to: "/calendar", icon: CalendarDaysIcon },
  { title: "Rooms", to: "/public-rooms", icon: ArmchairIcon },
  { title: "Inbox", to: "/inbox", icon: InboxIcon },
  { title: "Members", to: "/members", icon: UsersIcon },
] as const;

export const AppSidebar = () => {
  const matchRoute = useMatchRoute();
  const unread = useQuery(api.inbox.unreadCount) ?? 0;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <OrgSwitcher />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {LINKS.map((link) => (
              <SidebarMenuItem key={link.to}>
                <SidebarMenuButton
                  isActive={Boolean(matchRoute({ to: link.to }))}
                  tooltip={link.title}
                  render={<Link to={link.to} />}
                >
                  <link.icon />
                  <span>{link.title}</span>
                </SidebarMenuButton>
                {link.to === "/inbox" && unread > 0 && (
                  <SidebarMenuBadge>{unread > 99 ? "99+" : unread}</SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};
