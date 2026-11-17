import { Link } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { CalendarClockIcon, ChevronDownIcon, LinkIcon, PlusIcon, VideoIcon } from "lucide-react";
import { Button } from "@meetings/ui/components/button";
import { Input } from "@meetings/ui/components/input";
import { Menu, MenuItem, MenuLinkItem, MenuPopup, MenuTrigger } from "@meetings/ui/components/menu";
import { Separator } from "@meetings/ui/components/separator";
import { SidebarTrigger } from "@meetings/ui/components/sidebar";
import { parseMeetingCode } from "#/lib/meeting-code.ts";

type AppHeaderProps = {
  quickActions: boolean;
  onJoinCode: (code: string) => void;
  onStartMeeting: () => void;
};

export const AppHeader = ({ quickActions, onJoinCode, onStartMeeting }: AppHeaderProps) => {
  const form = useForm({
    defaultValues: { code: "" },
    onSubmit: ({ value, formApi }) => {
      const code = parseMeetingCode(value.code);
      if (!code) return;
      onJoinCode(code);
      formApi.reset();
    },
  });

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3">
      <SidebarTrigger />
      {quickActions && (
        <>
          <Separator orientation="vertical" className="me-1 h-4" />
          <Menu>
            <MenuTrigger render={<Button size="sm" variant="outline" />}>
              <PlusIcon />
              New meeting
              <ChevronDownIcon className="opacity-60" />
            </MenuTrigger>
            <MenuPopup align="start">
              <MenuItem onClick={onStartMeeting}>
                <VideoIcon />
                Start a call now
              </MenuItem>
              <MenuLinkItem render={<Link to="/schedule" />}>
                <CalendarClockIcon />
                Schedule for later
              </MenuLinkItem>
            </MenuPopup>
          </Menu>
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
        </>
      )}
    </header>
  );
};
