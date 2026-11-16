import { useForm } from "@tanstack/react-form";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { BadgeCheckIcon, MailIcon, RotateCwIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { api } from "@meetings/backend";
import { Avatar, AvatarFallback, AvatarImage } from "@meetings/ui/components/avatar";
import { Badge } from "@meetings/ui/components/badge";
import { Button } from "@meetings/ui/components/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@meetings/ui/components/card";
import { Input } from "@meetings/ui/components/input";
import { Label } from "@meetings/ui/components/label";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@meetings/ui/components/select";
import { FormError } from "#/components/form-error.tsx";
import { describeError } from "#/lib/errors.ts";
import { getInitials } from "#/lib/initials.ts";
import { cityOf, formatLongDate } from "#/lib/schedule.ts";
import { useActiveOrg } from "./active-org.tsx";

const MembersList = () => {
  const { orgId } = useActiveOrg();
  const members = usePaginatedQuery(api.members.list, { orgId }, { initialNumItems: 50 });

  return (
    <ul className="flex flex-col divide-y">
      {members.results.map((member) => (
        <li key={member._id} className="flex items-center gap-3 py-3">
          <Avatar className="size-9">
            {member.imageUrl && <AvatarImage src={member.imageUrl} alt="" />}
            <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-2 font-medium text-sm">
              {member.name}
              {member.isVerified ? (
                <Badge variant="success" size="sm">
                  <BadgeCheckIcon />
                  Verified
                </Badge>
              ) : (
                <Badge variant="warning" size="sm">
                  Unverified
                </Badge>
              )}
            </span>
            <span className="truncate text-muted-foreground text-xs">
              {[member.email, member.roles.join(", ")].filter(Boolean).join(" · ")}
            </span>
          </div>
          <span className="text-muted-foreground text-xs">
            {member.schedule ? cityOf(member.schedule.timeZone) : "No working hours yet"}
          </span>
        </li>
      ))}
      {members.status === "CanLoadMore" && (
        <li className="pt-3">
          <Button size="sm" variant="ghost" onClick={() => members.loadMore(50)}>
            Show more
          </Button>
        </li>
      )}
    </ul>
  );
};

const InviteForm = () => {
  const { orgId } = useActiveOrg();
  const roles = usePaginatedQuery(api.orgs.roles, { orgId }, { initialNumItems: 50 });
  const invite = useMutation(api.invites.create);
  const memberRole = roles.results.find((role) => role.name === "Member") ?? roles.results[0];
  const form = useForm({
    defaultValues: { email: "", roleId: "" },
    validators: {
      onSubmitAsync: async ({ value, formApi }) => {
        const roleId =
          roles.results.find((role) => role._id === value.roleId)?._id ?? memberRole?._id;
        if (!roleId) return "This organization has no roles yet";
        try {
          await invite({ orgId, email: value.email, roleId });
          formApi.reset();
          return undefined;
        } catch (error) {
          return describeError(error);
        }
      },
    },
  });

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="email">
        {(field) => (
          <div className="flex min-w-56 flex-1 flex-col gap-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="name@company.com"
              required
            />
          </div>
        )}
      </form.Field>
      <form.Field name="roleId">
        {(field) => (
          <div className="flex w-40 flex-col gap-2">
            <Label>Role</Label>
            <Select
              value={field.state.value || memberRole?._id || null}
              onValueChange={(value) => field.handleChange(String(value ?? ""))}
              items={roles.results.map((role) => ({ value: role._id, label: role.name }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                {roles.results.map((role) => (
                  <SelectItem key={role._id} value={role._id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </div>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button type="submit" disabled={isSubmitting}>
            <MailIcon />
            {isSubmitting ? "Sending…" : "Send invite"}
          </Button>
        )}
      </form.Subscribe>
      <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
        {(error) => (
          <div className="basis-full">
            <FormError error={error} />
          </div>
        )}
      </form.Subscribe>
    </form>
  );
};

const PendingInvites = () => {
  const { orgId } = useActiveOrg();
  const invites = usePaginatedQuery(api.invites.list, { orgId }, { initialNumItems: 50 });
  const resend = useMutation(api.invites.resend);
  const revoke = useMutation(api.invites.revoke);
  if (!invites.results.length) return null;

  return (
    <ul className="flex flex-col divide-y">
      {invites.results.map((invite) => (
        <li key={invite._id} className="flex flex-wrap items-center gap-3 py-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="font-medium text-sm">{invite.email}</span>
            <span className="text-muted-foreground text-xs">
              {invite.role} · link works until{" "}
              {formatLongDate(invite.expiresAt, Intl.DateTimeFormat().resolvedOptions().timeZone)}
            </span>
            {invite.emailError && (
              <span className="flex items-center gap-1.5 text-destructive-foreground text-xs">
                <TriangleAlertIcon className="size-3.5" />
                Email not sent: {invite.emailError}
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void resend({ orgId, inviteId: invite._id })}
          >
            <RotateCwIcon />
            Resend
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void revoke({ orgId, inviteId: invite._id })}
          >
            <XIcon />
            Revoke
          </Button>
        </li>
      ))}
    </ul>
  );
};

export const MembersPanel = () => {
  const { orgId, name } = useActiveOrg();
  const org = useQuery(api.orgs.get, { orgId });
  const canInvite = org?.permissions.includes("inviteMembers") ?? false;

  return (
    <div className="flex flex-col gap-6">
      {canInvite && (
        <Card>
          <CardHeader>
            <CardTitle>Invite people</CardTitle>
            <CardDescription>
              They get an email with a link to join {name}. Accepting it confirms their email
              address.
            </CardDescription>
          </CardHeader>
          <CardPanel className="flex flex-col gap-4">
            <InviteForm />
            <PendingInvites />
          </CardPanel>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>Everyone in {name}.</CardDescription>
        </CardHeader>
        <CardPanel>
          <MembersList />
        </CardPanel>
      </Card>
    </div>
  );
};
