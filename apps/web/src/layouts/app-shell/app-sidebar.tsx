import { Link, useMatchRoute } from "@tanstack/react-router";
import { CalendarDaysIcon, HouseIcon, InboxIcon, UsersIcon, VideoIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@meetings/ui/components/sidebar";
import { NavUser } from "#/features/auth/nav-user.tsx";
import { OrgSwitcher } from "#/features/orgs/org-switcher.tsx";

const LINKS = [
  { title: "Home", to: "/", icon: HouseIcon },
  { title: "Calendar", to: "/calendar", icon: CalendarDaysIcon },
  { title: "Members", to: "/members", icon: UsersIcon },
] as const;

const PLANNED_NAV_ITEMS = [
  { title: "Meetings", icon: VideoIcon },
  { title: "Inbox", icon: InboxIcon },
];

export const AppSidebar = () => {
  const matchRoute = useMatchRoute();

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
              </SidebarMenuItem>
            ))}
            {PLANNED_NAV_ITEMS.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton tooltip={item.title}>
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
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
