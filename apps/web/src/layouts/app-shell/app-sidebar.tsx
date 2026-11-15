import { Link, useMatchRoute } from "@tanstack/react-router";
import { CalendarDaysIcon, HouseIcon, InboxIcon, VideoIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@meetings/ui/components/sidebar";
import { NavUser } from "#/features/auth/nav-user.tsx";
import { Tasks } from "#/features/tasks/tasks.tsx";

const PLANNED_NAV_ITEMS = [
  { title: "Meetings", icon: VideoIcon },
  { title: "Calendar", icon: CalendarDaysIcon },
  { title: "Inbox", icon: InboxIcon },
];

export function AppSidebar() {
  const matchRoute = useMatchRoute();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                <VideoIcon className="size-4" />
              </span>
              <span className="font-semibold">Meetings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={Boolean(matchRoute({ to: "/" }))}
                tooltip="Home"
                render={<Link to="/" />}
              >
                <HouseIcon />
                <span>Home</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
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

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>To do</SidebarGroupLabel>
          <SidebarGroupContent>
            <Tasks />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
