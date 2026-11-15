import {
  CalendarDaysIcon,
  HouseIcon,
  InboxIcon,
  ListTodoIcon,
  LogOutIcon,
  VideoIcon,
} from "lucide-react";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../../convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Checkbox } from "#/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "#/components/ui/empty";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "#/components/ui/sidebar";
import { cn } from "#/lib/utils";

const nav = [
  { title: "Home", icon: HouseIcon, active: true },
  { title: "Meetings", icon: VideoIcon },
  { title: "Calendar", icon: CalendarDaysIcon },
  { title: "Inbox", icon: InboxIcon },
];

export function SidebarLeft() {
  const { signOut } = useAuthActions();
  const viewer = useQuery(api.users.viewer);
  const initials = (viewer?.name ?? "?")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // ponytail: no tasks table yet, swap for useQuery(api.tasks.list) when it exists.
  const tasks: { id: string; title: string; done: boolean }[] = [];

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
            {nav.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton isActive={item.active} tooltip={item.title}>
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
            {tasks.length === 0 ? (
              <Empty className="gap-3 px-2 py-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon" className="mb-3">
                    <ListTodoIcon />
                  </EmptyMedia>
                  <EmptyTitle className="text-sm">All caught up</EmptyTitle>
                  <EmptyDescription className="text-xs">
                    Action items from your meetings will land here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <SidebarMenu>
                {tasks.map((task) => (
                  <SidebarMenuItem key={task.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm hover:bg-sidebar-accent">
                      <Checkbox checked={task.done} />
                      <span
                        className={cn(
                          "truncate",
                          task.done && "text-muted-foreground line-through",
                        )}
                      >
                        {task.title}
                      </span>
                    </label>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <Avatar className="size-8 rounded-lg">
                {viewer?.imageUrl && <AvatarImage src={viewer.imageUrl} alt="" />}
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate font-medium">{viewer?.name ?? "…"}</span>
                <span className="truncate text-muted-foreground text-xs">
                  {viewer?.method}
                  {viewer?.isVerified ? " · verified" : ""}
                </span>
              </span>
            </SidebarMenuButton>
            <SidebarMenuAction
              aria-label="Sign out"
              className="top-3"
              onClick={() => void signOut()}
            >
              <LogOutIcon />
            </SidebarMenuAction>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
