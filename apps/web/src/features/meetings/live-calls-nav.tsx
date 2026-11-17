import { Link } from "@tanstack/react-router";
import { usePaginatedQuery } from "convex/react";
import { api } from "@meetings/backend";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@meetings/ui/components/sidebar";
import { LiveDot } from "#/components/live-dot.tsx";
import { isLive } from "./upcoming-meetings.tsx";

export const LiveCallsNav = () => {
  const meetings = usePaginatedQuery(api.meetings.mine, {}, { initialNumItems: 100 });
  const live = meetings.results.filter(isLive);
  if (!live.length) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Live now</SidebarGroupLabel>
      <SidebarMenu>
        {live.map((meeting) => (
          <SidebarMenuItem key={meeting._id}>
            <SidebarMenuButton
              tooltip={`Join ${meeting.title}`}
              render={
                <Link
                  to="/meetings/$code"
                  params={{ code: meeting.code }}
                  search={{ call: true }}
                />
              }
            >
              <LiveDot />
              <span>{meeting.title}</span>
            </SidebarMenuButton>
            <SidebarMenuBadge>
              <span className="sr-only">People in the call: </span>
              {meeting.lastSession?.inCall}
            </SidebarMenuBadge>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
};
