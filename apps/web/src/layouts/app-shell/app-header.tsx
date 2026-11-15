import { Link } from "@tanstack/react-router";
import { LinkIcon, PlusIcon, VideoIcon } from "lucide-react";
import { Button } from "@meetings/ui/components/button";
import { Input } from "@meetings/ui/components/input";
import { Separator } from "@meetings/ui/components/separator";
import { SidebarTrigger } from "@meetings/ui/components/sidebar";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3">
      <SidebarTrigger />
      <Separator orientation="vertical" className="me-1 h-4" />
      <Button size="sm">
        <VideoIcon />
        Start meeting
      </Button>
      <Button
        size="sm"
        variant="outline"
        render={<Link to="/" search={(prev) => ({ ...prev, schedule: true })} />}
      >
        <PlusIcon />
        Schedule
      </Button>
      <div className="ms-auto hidden items-center gap-2 sm:flex">
        <Input className="w-44" placeholder="Code or link" aria-label="Meeting code" />
        <Button size="sm" variant="ghost">
          <LinkIcon />
          Join
        </Button>
      </div>
    </header>
  );
}
