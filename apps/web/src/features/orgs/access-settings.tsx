import { useForm } from "@tanstack/react-form";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { CopyIcon, LinkIcon, XIcon } from "lucide-react";
import { api, type Doc, type Id } from "@meetings/backend";
import { Badge } from "@meetings/ui/components/badge";
import { Button } from "@meetings/ui/components/button";
import {
  Card,
  CardDescription,
  CardFooter,
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
import { toastManager } from "@meetings/ui/components/toast";
import { FormError } from "#/components/form-error.tsx";
import { browserTimeZone } from "#/lib/browser.ts";
import { describeError } from "#/lib/errors.ts";
import { canGrant } from "#/lib/roles.ts";
import { formatAgo, formatLongDate } from "#/lib/schedule.ts";
import { useActiveOrg } from "./active-org.tsx";

type OrgView = NonNullable<ReturnType<typeof useOrg>>;

const useOrg = () => {
  const { orgId } = useActiveOrg();
  return useQuery(api.orgs.get, { orgId });
};

const showError = (error: unknown) =>
  toastManager.add({ title: describeError(error), type: "error" });

const RolePicker = ({
  roles,
  value,
  onChange,
  id,
}: {
  roles: Doc<"roles">[];
  value: string;
  onChange: (roleId: string) => void;
  id: string;
}) => (
  <Select
    value={value || null}
    onValueChange={(next) => onChange(String(next ?? ""))}
    items={roles.map((role) => ({ value: role._id, label: role.name }))}
  >
    <SelectTrigger id={id}>
      <SelectValue />
    </SelectTrigger>
    <SelectPopup>
      {roles.map((role) => (
        <SelectItem key={role._id} value={role._id}>
          {role.name}
        </SelectItem>
      ))}
    </SelectPopup>
  </Select>
);

const useGrantableRoles = (org: OrgView) => {
  const { orgId } = useActiveOrg();
  const roles = usePaginatedQuery(api.orgs.roles, { orgId }, { initialNumItems: 50 });
  const grantable = roles.results.filter((role) => canGrant(role, org));
  const member = grantable.find((role) => role.name === "Member") ?? grantable[0];
  return { grantable, member };
};

const DAYS = [
  { value: "1", label: "1 day" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
];

const NewLinkForm = ({ org }: { org: OrgView }) => {
  const { orgId } = useActiveOrg();
  const create = useMutation(api.joinLinks.create);
  const { grantable, member } = useGrantableRoles(org);
  const form = useForm({
    defaultValues: { roleId: "", days: "7", maxUses: "", link: "" },
    validators: {
      onSubmitAsync: async ({ value, formApi }) => {
        const roleId = (value.roleId || member?._id) as Id<"roles"> | undefined;
        if (!roleId) return "Pick a role";
        try {
          const secret = await create({
            orgId,
            roleId,
            days: Number(value.days) as 1 | 7 | 30,
            maxUses: value.maxUses ? Number(value.maxUses) : undefined,
          });
          formApi.setFieldValue("link", `${window.location.origin}/join/${secret}`);
          return undefined;
        } catch (error) {
          return describeError(error);
        }
      },
    },
  });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <form.Field name="roleId">
          {(field) => (
            <div className="flex w-40 flex-col gap-2">
              <Label htmlFor="link-role">Joins as</Label>
              <RolePicker
                id="link-role"
                roles={grantable}
                value={field.state.value || member?._id || ""}
                onChange={field.handleChange}
              />
            </div>
          )}
        </form.Field>
        <form.Field name="days">
          {(field) => (
            <div className="flex w-32 flex-col gap-2">
              <Label htmlFor="link-days">Works for</Label>
              <Select
                value={field.state.value}
                onValueChange={(next) => field.handleChange(String(next ?? "7"))}
                items={DAYS}
              >
                <SelectTrigger id="link-days">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {DAYS.map((day) => (
                    <SelectItem key={day.value} value={day.value}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
          )}
        </form.Field>
        <form.Field name="maxUses">
          {(field) => (
            <div className="flex w-32 flex-col gap-2">
              <Label htmlFor="link-uses">Max people</Label>
              <Input
                id="link-uses"
                type="number"
                min={1}
                max={1000}
                placeholder="No limit"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </div>
          )}
        </form.Field>
        <Button type="submit" variant="outline">
          <LinkIcon />
          Create link
        </Button>
      </div>
      <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
        {(error) => <FormError error={error} />}
      </form.Subscribe>
      <form.Subscribe selector={(state) => state.values.link}>
        {(link) =>
          link && (
            <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
              <span className="text-muted-foreground text-xs">
                Copy it now. For safety we only keep a fingerprint of the link, so it can't be shown
                again.
              </span>
              <div className="flex gap-2">
                <Input readOnly value={link} aria-label="New invite link" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(link)
                      .then(() => toastManager.add({ title: "Link copied", type: "success" }))
                  }
                >
                  <CopyIcon />
                  Copy
                </Button>
              </div>
            </div>
          )
        }
      </form.Subscribe>
    </form>
  );
};

const LinksList = () => {
  const { orgId } = useActiveOrg();
  const links = usePaginatedQuery(api.joinLinks.list, { orgId }, { initialNumItems: 20 });
  const revoke = useMutation(api.joinLinks.revoke);
  const zone = browserTimeZone();
  if (!links.results.length) return null;

  return (
    <ul className="flex flex-col divide-y">
      {links.results.map((link) => (
        <li key={link._id} className="flex items-center gap-3 py-2 text-sm">
          <LinkIcon className="size-4 shrink-0 opacity-60" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate">
              Joins as {link.role ?? "a deleted role"} · {link.uses}
              {link.maxUses ? ` of ${link.maxUses}` : ""} used
            </span>
            <span className="truncate text-muted-foreground text-xs">
              By {link.createdBy} {formatAgo(link._creationTime)} · until{" "}
              {formatLongDate(link.expiresAt, zone)}
            </span>
          </span>
          {link.active ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void revoke({ orgId, linkId: link._id }).catch(showError)}
            >
              <XIcon />
              Turn off
            </Button>
          ) : (
            <Badge variant="outline">Off</Badge>
          )}
        </li>
      ))}
    </ul>
  );
};

export const InviteLinksCard = () => {
  const org = useOrg();
  if (!org?.permissions.includes("inviteMembers")) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite link</CardTitle>
        <CardDescription>
          Anyone with the link can join until it expires, runs out or you turn it off.
        </CardDescription>
      </CardHeader>
      <CardPanel className="flex flex-col gap-4">
        <NewLinkForm org={org} />
        <LinksList />
      </CardPanel>
    </Card>
  );
};

const DomainForm = ({ org }: { org: OrgView }) => {
  const setDomain = useMutation(api.orgs.setJoinDomain);
  const { grantable, member } = useGrantableRoles(org);
  const form = useForm({
    defaultValues: { domain: org.joinDomain ?? "", roleId: org.joinRoleId ?? "" },
    validators: {
      onSubmitAsync: async ({ value }) => {
        try {
          await setDomain({
            orgId: org._id,
            domain: value.domain.trim() || null,
            roleId: (value.roleId || member?._id) as Id<"roles"> | undefined,
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
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Join by email domain</CardTitle>
          <CardDescription>
            People with a verified email at this domain see {org.name} when they sign up and can
            join with one click. You need a verified email there yourself. Leave it empty to turn it
            off.
          </CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-wrap items-end gap-3">
          <form.Field name="domain">
            {(field) => (
              <div className="flex min-w-48 flex-1 flex-col gap-2">
                <Label htmlFor="join-domain">Domain</Label>
                <Input
                  id="join-domain"
                  placeholder="acme.com"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="roleId">
            {(field) => (
              <div className="flex w-40 flex-col gap-2">
                <Label htmlFor="join-role">Joins as</Label>
                <RolePicker
                  id="join-role"
                  roles={grantable}
                  value={field.state.value || member?._id || ""}
                  onChange={field.handleChange}
                />
              </div>
            )}
          </form.Field>
        </CardPanel>
        <CardFooter className="flex items-center justify-end gap-3">
          <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
            {(error) => (
              <span className="me-auto">
                <FormError error={error} />
              </span>
            )}
          </form.Subscribe>
          <form.Subscribe selector={(state) => [state.isSubmitting, state.isSubmitSuccessful]}>
            {([isSubmitting, saved]) => (
              <>
                {saved && !isSubmitting && (
                  <span className="text-muted-foreground text-sm">Saved</span>
                )}
                <Button type="submit" disabled={isSubmitting}>
                  Save
                </Button>
              </>
            )}
          </form.Subscribe>
        </CardFooter>
      </Card>
    </form>
  );
};

export const JoinDomainCard = () => {
  const org = useOrg();
  if (!org?.permissions.includes("manageOrganization")) return null;
  return <DomainForm key={`${org.joinDomain}-${org.joinRoleId}`} org={org} />;
};

const ACTIONS: Record<string, string> = {
  orgRenamed: "renamed the organization to",
  memberJoined: "joined via",
  memberRemoved: "removed",
  memberLeft: "left the organization",
  memberRoleChanged: "changed the role of",
  memberSignedOut: "signed out",
  roleCreated: "created the role",
  roleUpdated: "edited the role",
  roleDeleted: "deleted the role",
  inviteSent: "invited",
  inviteRevoked: "revoked the invite for",
  joinLinkCreated: "created an invite link for",
  joinLinkRevoked: "turned off an invite link",
  joinDomainChanged: "set domain join to",
  callMemberRemoved: "removed from a call",
  callEnded: "ended the call",
};

export const ActivityCard = () => {
  const { orgId } = useActiveOrg();
  const org = useOrg();
  const canView = org?.permissions.includes("manageOrganization") ?? false;
  const events = usePaginatedQuery(api.audit.list, canView ? { orgId } : "skip", {
    initialNumItems: 25,
  });
  if (!canView) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
        <CardDescription>Who changed access, roles and settings, newest first.</CardDescription>
      </CardHeader>
      <CardPanel>
        <ul className="flex flex-col divide-y">
          {events.results.map((event) => (
            <li key={event._id} className="flex items-baseline gap-3 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{event.actorName}</span>{" "}
                {ACTIONS[event.action] ?? event.action}
                {event.targetName && <span className="font-medium"> {event.targetName}</span>}
                {event.detail && (
                  <span className="text-muted-foreground">
                    {event.targetName ? ` · ${event.detail}` : ` ${event.detail}`}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-muted-foreground text-xs">
                {formatAgo(event._creationTime)}
              </span>
            </li>
          ))}
          {events.status !== "LoadingFirstPage" && events.results.length === 0 && (
            <li className="py-4 text-center text-muted-foreground text-sm">Nothing yet.</li>
          )}
        </ul>
        {events.status === "CanLoadMore" && (
          <Button size="sm" variant="ghost" onClick={() => events.loadMore(25)}>
            Show older
          </Button>
        )}
      </CardPanel>
    </Card>
  );
};
