import { Link } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { LinkIcon, PlusIcon, VideoIcon } from "lucide-react";
import { Button } from "@meetings/ui/components/button";
import { Input } from "@meetings/ui/components/input";
import { Separator } from "@meetings/ui/components/separator";
import { SidebarTrigger } from "@meetings/ui/components/sidebar";

const MEETING_CODE = /[a-z]{3}-[a-z]{4}-[a-z]{3}/;

export const AppHeader = ({ onJoinCode }: { onJoinCode: (code: string) => void }) => {
  const form = useForm({
    defaultValues: { code: "" },
    onSubmit: ({ value, formApi }) => {
      const code = value.code.trim().toLowerCase().match(MEETING_CODE)?.[0];
      if (!code) return;
      onJoinCode(code);
      formApi.reset();
    },
  });

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3">
      <SidebarTrigger />
      <Separator orientation="vertical" className="me-1 h-4" />
      <Button size="sm">
        <VideoIcon />
        Start meeting
      </Button>
      <Button size="sm" variant="outline" render={<Link to="/schedule" />}>
        <PlusIcon />
        Schedule
      </Button>
      <form
        className="ms-auto hidden items-center gap-2 sm:flex"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="code">
          {(field) => (
            <Input
              className="w-44"
              placeholder="Code or link"
              aria-label="Meeting code or link"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          )}
        </form.Field>
        <Button size="sm" variant="ghost" type="submit">
          <LinkIcon />
          Join
        </Button>
      </form>
    </header>
  );
};
