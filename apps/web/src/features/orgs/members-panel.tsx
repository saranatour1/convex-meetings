import type { ReactNode } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import {
  BadgeCheckIcon,
  LogOutIcon,
  MailIcon,
  MoreHorizontalIcon,
  RotateCwIcon,
  SearchIcon,
  ShieldIcon,
  TriangleAlertIcon,
  UserMinusIcon,
  XIcon,
} from "lucide-react";
import { api, type Doc, type Id } from "@meetings/backend";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@meetings/ui/components/alert-dialog";
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
import { Textarea } from "@meetings/ui/components/textarea";
import { Label } from "@meetings/ui/components/label";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "@meetings/ui/components/menu";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@meetings/ui/components/select";
import { toastManager } from "@meetings/ui/components/toast";
import { FormError } from "#/components/form-error.tsx";
import { browserTimeZone } from "#/lib/browser.ts";
import { describeError } from "#/lib/errors.ts";
import { getInitials } from "#/lib/initials.ts";
import { canGrant } from "#/lib/roles.ts";
import { cityOf, formatAgo, formatLongDate, formatTime } from "#/lib/schedule.ts";
import { useActiveOrg } from "./active-org.tsx";
import type { Member } from "./people.ts";

export type MemberConfirm = { action: "remove" | "leave" | "signOut"; memberId: string };

type MembersPanelProps = {
  search: string;
  onSearchChange: (search: string) => void;
  confirm?: MemberConfirm;
  onConfirmChange: (confirm: MemberConfirm | undefined) => void;
  onLeft: () => void;
};

const RowMenu = ({ children }: { children: ReactNode }) => (
  <Menu>
    <MenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label="Member actions" />}>
      <MoreHorizontalIcon />
    </MenuTrigger>
    <MenuPopup align="end" className="min-w-52">
      {children}
    </MenuPopup>
  </Menu>
);

const MemberRow = ({
  member,
  isSelf,
  canManageRoles,
  canRemove,
  canSignOut,
  roles,
  onConfirm,
}: {
  member: Member;
  isSelf: boolean;
  canManageRoles: boolean;
  canRemove: boolean;
  canSignOut: boolean;
  roles: (Doc<"roles"> & { grantable: boolean })[];
  onConfirm: (confirm: MemberConfirm) => void;
}) => {
  const { orgId } = useActiveOrg();
  const setRole = useMutation(api.members.setRole);
  const zone = member.schedule?.timeZone ?? member.seenTimeZone;
  const hasActions = canManageRoles || canRemove || canSignOut || isSelf;

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 py-3 sm:grid-cols-[minmax(0,1fr)_9rem_8rem_auto]">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-9">
          {member.imageUrl && <AvatarImage src={member.imageUrl} alt="" />}
          <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1.5 truncate font-medium text-sm">
            {member.name}
            {isSelf && <span className="text-muted-foreground font-normal">(you)</span>}
            {member.isVerified && (
              <BadgeCheckIcon
                className="size-3.5 text-success-foreground"
                aria-label="Verified email"
              />
            )}
          </span>
          <span className="truncate text-muted-foreground text-xs">
            {member.email ?? "No email yet"}
            {member.lastActiveAt && ` · active ${formatAgo(member.lastActiveAt)}`}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {member.roles.map((role) => (
          <Badge key={role._id} variant={role.name === "Owner" ? "default" : "outline"}>
            {role.name}
          </Badge>
        ))}
      </div>
      <span className="hidden text-muted-foreground text-xs tabular-nums sm:block">
        {zone ? `${formatTime(Date.now(), zone)} · ${cityOf(zone)}` : "No hours set"}
      </span>
      {hasActions ? (
        <RowMenu>
          {canManageRoles && (
            <MenuSub>
              <MenuSubTrigger>
                <ShieldIcon />
                Change role
              </MenuSubTrigger>
              <MenuSubPopup>
                <MenuRadioGroup
                  value={member.roles[0]?._id ?? ""}
                  onValueChange={(roleId) =>
                    void setRole({
                      orgId,
                      memberId: member._id,
                      roleId: roleId as Id<"roles">,
                    }).catch((error: unknown) =>
                      toastManager.add({ title: describeError(error), type: "error" }),
                    )
                  }
                >
                  {roles.map((role) => (
                    <MenuRadioItem key={role._id} value={role._id} disabled={!role.grantable}>
                      {role.name}
                    </MenuRadioItem>
                  ))}
                </MenuRadioGroup>
              </MenuSubPopup>
            </MenuSub>
          )}
          {canSignOut && !isSelf && (
            <MenuItem onClick={() => onConfirm({ action: "signOut", memberId: member._id })}>
              <LogOutIcon />
              Sign out everywhere
            </MenuItem>
          )}
          {(canManageRoles || canSignOut) && (canRemove || isSelf) && <MenuSeparator />}
          {isSelf ? (
            <MenuItem
              variant="destructive"
              onClick={() => onConfirm({ action: "leave", memberId: member._id })}
            >
              <LogOutIcon />
              Leave organization
            </MenuItem>
          ) : (
            canRemove && (
              <MenuItem
                variant="destructive"
                onClick={() => onConfirm({ action: "remove", memberId: member._id })}
              >
                <UserMinusIcon />
                Remove from organization
              </MenuItem>
            )
          )}
        </RowMenu>
      ) : (
        <span />
      )}
    </li>
  );
};

const ConfirmDialog = ({
  confirm,
  members,
  onClose,
  onLeft,
}: {
  confirm?: MemberConfirm;
  members: Member[];
  onClose: () => void;
  onLeft: () => void;
}) => {
  const { orgId, name } = useActiveOrg();
  const remove = useMutation(api.members.remove);
  const leave = useMutation(api.members.leave);
  const signOut = useMutation(api.members.signOutEverywhere);
  const target = members.find((m) => m._id === confirm?.memberId);
  const form = useForm({
    defaultValues: {},
    validators: {
      onSubmitAsync: async () => {
        try {
          if (confirm?.action === "leave") {
            await leave({ orgId });
            onLeft();
          } else if (target && confirm?.action === "signOut") {
            await signOut({ orgId, memberId: target._id });
            onClose();
          } else if (target) {
            await remove({ orgId, memberId: target._id });
            onClose();
          }
          return undefined;
        } catch (error) {
          return describeError(error);
        }
      },
    },
  });
  const leaving = confirm?.action === "leave";
  const signingOut = confirm?.action === "signOut";
  const copy = leaving
    ? {
        title: `Leave ${name}?`,
        body: "You'll lose access to its members and meetings until someone invites you again.",
        button: "Leave",
      }
    : signingOut
      ? {
          title: `Sign ${target?.name ?? "this person"} out everywhere?`,
          body: "Every browser and device they're signed in on is signed out right away. They can sign in again.",
          button: "Sign out",
        }
      : {
          title: `Remove ${target?.name ?? "this person"}?`,
          body: "They lose access to this organization's members and meetings. You can invite them again later.",
          button: "Remove",
        };

  return (
    <AlertDialog
      open={Boolean(confirm && (leaving || target))}
      onOpenChange={(open) => !open && onClose()}
    >
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.body}</AlertDialogDescription>
          <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
            {(error) => <FormError error={error} />}
          </form.Subscribe>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="ghost" />}>Cancel</AlertDialogClose>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button
                variant="destructive"
                disabled={isSubmitting}
                onClick={() => void form.handleSubmit()}
              >
                {copy.button}
              </Button>
            )}
          </form.Subscribe>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
};

const splitEmails = (text: string) =>
  [...new Set(text.split(/[\s,;]+/).map((email) => email.trim().toLowerCase()))].filter(Boolean);

const InviteForm = ({ roles }: { roles: (Doc<"roles"> & { grantable: boolean })[] }) => {
  const { orgId } = useActiveOrg();
  const invite = useMutation(api.invites.create);
  const grantable = roles.filter((role) => role.grantable);
  const memberRole = grantable.find((role) => role.name === "Member") ?? grantable[0];
  const form = useForm({
    defaultValues: { emails: "", roleId: "" },
    validators: {
      onSubmitAsync: async ({ value, formApi }) => {
        const roleId = grantable.find((role) => role._id === value.roleId)?._id ?? memberRole?._id;
        if (!roleId) return "You can't invite anyone into a role yet";
        const emails = splitEmails(value.emails);
        if (!emails.length) return "Add at least one email";
        if (emails.length > 50) return "Invite up to 50 people at a time";
        try {
          const { sent, skipped } = await invite({ orgId, emails, roleId });
          formApi.reset();
          toastManager.add({
            title: `Sent ${sent.length} ${sent.length === 1 ? "invite" : "invites"}`,
            description: skipped.length
              ? `Already in the organization: ${skipped.join(", ")}`
              : undefined,
            type: "success",
          });
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
      <form.Field name="emails">
        {(field) => (
          <div className="flex min-w-56 flex-1 flex-col gap-2">
            <Label htmlFor="invite-emails">Emails</Label>
            <Textarea
              id="invite-emails"
              rows={2}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="name@company.com, another@company.com"
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
              items={grantable.map((role) => ({ value: role._id, label: role.name }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                {grantable.map((role) => (
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
            {isSubmitting ? "Sending…" : "Send invites"}
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
    <div className="flex flex-col gap-1">
      <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        Pending invites
      </span>
      <ul className="flex flex-col divide-y">
        {invites.results.map((invite) => (
          <li key={invite._id} className="flex items-center gap-3 py-3">
            <span className="grid size-9 place-items-center rounded-full bg-muted">
              <MailIcon className="size-4 opacity-70" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium text-sm">{invite.email}</span>
              <span className="text-muted-foreground text-xs">
                {invite.role} · link works until{" "}
                {formatLongDate(invite.expiresAt, browserTimeZone())}
              </span>
              {invite.emailError && (
                <span className="flex items-center gap-1.5 text-destructive-foreground text-xs">
                  <TriangleAlertIcon className="size-3.5" />
                  Email not sent: {invite.emailError}
                </span>
              )}
            </div>
            <RowMenu>
              <MenuItem onClick={() => void resend({ orgId, inviteId: invite._id })}>
                <RotateCwIcon />
                Resend invite
              </MenuItem>
              <MenuItem
                variant="destructive"
                onClick={() => void revoke({ orgId, inviteId: invite._id })}
              >
                <XIcon />
                Revoke invite
              </MenuItem>
            </RowMenu>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const MembersPanel = ({
  search,
  onSearchChange,
  confirm,
  onConfirmChange,
  onLeft,
}: MembersPanelProps) => {
  const { orgId, name } = useActiveOrg();
  const org = useQuery(api.orgs.get, { orgId });
  const viewer = useQuery(api.users.viewer);
  const members = usePaginatedQuery(api.members.list, { orgId }, { initialNumItems: 100 });
  const roles = usePaginatedQuery(api.orgs.roles, { orgId }, { initialNumItems: 50 });
  const can = (permission: string) => org?.permissions.includes(permission as never) ?? false;
  const grantableRoles = roles.results.map((role) => ({ ...role, grantable: canGrant(role, org) }));
  const query = search.trim().toLowerCase();
  const shown = members.results.filter(
    (m) =>
      !query ||
      m.name.toLowerCase().includes(query) ||
      (m.email ?? "").toLowerCase().includes(query),
  );

  return (
    <div className="flex flex-col gap-6">
      {can("inviteMembers") && (
        <Card>
          <CardHeader>
            <CardTitle>Invite people</CardTitle>
            <CardDescription>
              Paste one or more emails. Each person gets a link to join {name}; accepting it
              confirms their email. For a shareable link, use Organization settings.
            </CardDescription>
          </CardHeader>
          <CardPanel className="flex flex-col gap-5">
            <InviteForm roles={grantableRoles} />
            <PendingInvites />
          </CardPanel>
        </Card>
      )}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Members</CardTitle>
            <CardDescription>
              {members.results.length} {members.results.length === 1 ? "person" : "people"} in{" "}
              {name}
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <SearchIcon className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 opacity-60" />
            <Input
              aria-label="Search members"
              className="ps-8"
              placeholder="Search by name or email"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>
        </CardHeader>
        <CardPanel>
          <ul className="flex flex-col divide-y">
            {shown.map((member) => (
              <MemberRow
                key={member._id}
                member={member}
                isSelf={member.userId === viewer?._id}
                canManageRoles={can("manageRoles")}
                canRemove={can("removeMembers")}
                canSignOut={org?.isOwner ?? false}
                roles={grantableRoles}
                onConfirm={onConfirmChange}
              />
            ))}
            {shown.length === 0 && (
              <li className="py-6 text-center text-muted-foreground text-sm">
                No one matches “{search}”.
              </li>
            )}
          </ul>
          {members.status === "CanLoadMore" && (
            <Button size="sm" variant="ghost" onClick={() => members.loadMore(100)}>
              Show more
            </Button>
          )}
        </CardPanel>
      </Card>
      <ConfirmDialog
        confirm={confirm}
        members={members.results}
        onClose={() => onConfirmChange(undefined)}
        onLeft={onLeft}
      />
    </div>
  );
};
