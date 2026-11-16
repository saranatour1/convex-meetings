import { useForm } from "@tanstack/react-form";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { LogOutIcon, PlusIcon, TrashIcon } from "lucide-react";
import { api, type Doc } from "@meetings/backend";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@meetings/ui/components/alert-dialog";
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
import { Switch } from "@meetings/ui/components/switch";
import { toastManager } from "@meetings/ui/components/toast";
import { FormError } from "#/components/form-error.tsx";
import { describeError } from "#/lib/errors.ts";
import { BUILT_IN_ROLES, LOCKED_ROLES, PERMISSIONS, canGrant } from "#/lib/roles.ts";
import { ActivityCard, InviteLinksCard, JoinDomainCard } from "./access-settings.tsx";
import { useActiveOrg } from "./active-org.tsx";

const showError = (error: unknown) =>
  toastManager.add({ title: describeError(error), type: "error" });

const NameCard = ({ canEdit }: { canEdit: boolean }) => {
  const { orgId, name } = useActiveOrg();
  const rename = useMutation(api.orgs.rename);
  const form = useForm({
    defaultValues: { name },
    validators: {
      onSubmitAsync: async ({ value }) => {
        try {
          await rename({ orgId, name: value.name });
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
          <CardTitle>Organization</CardTitle>
          <CardDescription>The name everyone sees in the switcher and in invites.</CardDescription>
        </CardHeader>
        <CardPanel>
          <form.Field name="name">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="org-name">Name</Label>
                <Input
                  id="org-name"
                  value={field.state.value}
                  maxLength={80}
                  disabled={!canEdit}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </div>
            )}
          </form.Field>
        </CardPanel>
        {canEdit && (
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
        )}
      </Card>
    </form>
  );
};

type Viewer = { permissions: string[]; isOwner: boolean };

const RoleSection = ({
  role,
  canManage,
  viewer,
}: {
  role: Doc<"roles">;
  canManage: boolean;
  viewer: Viewer;
}) => {
  const { orgId } = useActiveOrg();
  const update = useMutation(api.roles.update);
  const remove = useMutation(api.roles.remove);
  const locked = LOCKED_ROLES.includes(role.name);
  const builtIn = BUILT_IN_ROLES.includes(role.name);
  const canEdit = canManage && !locked && canGrant(role, viewer);

  return (
    <section className="flex flex-col gap-3 py-4">
      <div className="flex items-center gap-2">
        {canEdit && !builtIn ? (
          <Input
            aria-label="Role name"
            defaultValue={role.name}
            maxLength={40}
            className="max-w-56"
            onBlur={(event) => {
              const name = event.target.value.trim();
              if (name && name !== role.name) {
                void update({ orgId, roleId: role._id, name }).catch(showError);
              }
            }}
          />
        ) : (
          <span className="font-medium text-sm">{role.name}</span>
        )}
        {builtIn && <Badge variant="outline">Built in</Badge>}
        {canEdit && !builtIn && (
          <Button
            size="icon-sm"
            variant="ghost"
            className="ms-auto"
            aria-label={`Delete ${role.name}`}
            onClick={() => void remove({ orgId, roleId: role._id }).catch(showError)}
          >
            <TrashIcon />
          </Button>
        )}
      </div>
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {PERMISSIONS.map((permission) => (
          <Label key={permission.key} className="justify-between gap-3 font-normal">
            {permission.label}
            <Switch
              checked={locked || role.permissions[permission.key] === true}
              disabled={!canEdit || !viewer.permissions.includes(permission.key)}
              onCheckedChange={(checked) =>
                void update({
                  orgId,
                  roleId: role._id,
                  permissions: { ...role.permissions, [permission.key]: checked },
                }).catch(showError)
              }
            />
          </Label>
        ))}
      </div>
    </section>
  );
};

const AddRole = () => {
  const { orgId } = useActiveOrg();
  const create = useMutation(api.roles.create);
  const form = useForm({
    defaultValues: { name: "" },
    validators: {
      onSubmitAsync: async ({ value, formApi }) => {
        try {
          await create({ orgId, name: value.name, permissions: { createMeetings: true } });
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
      className="flex flex-wrap items-center gap-2 pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="name">
        {(field) => (
          <Input
            aria-label="New role name"
            placeholder="New role, e.g. Host"
            className="max-w-56"
            maxLength={40}
            value={field.state.value}
            onChange={(event) => field.handleChange(event.target.value)}
          />
        )}
      </form.Field>
      <Button type="submit" variant="outline">
        <PlusIcon />
        Add role
      </Button>
      <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
        {(error) => <FormError error={error} />}
      </form.Subscribe>
    </form>
  );
};

const LeaveCard = ({ onLeft }: { onLeft: () => void }) => {
  const { orgId, name } = useActiveOrg();
  const leave = useMutation(api.members.leave);
  const form = useForm({
    defaultValues: {},
    validators: {
      onSubmitAsync: async () => {
        try {
          await leave({ orgId });
          onLeft();
          return undefined;
        } catch (error) {
          return describeError(error);
        }
      },
    },
  });

  return (
    <Card className="border-destructive/32">
      <CardHeader>
        <CardTitle>Leave {name}</CardTitle>
        <CardDescription>
          You'll lose access to its members and meetings until someone invites you again. The last
          owner has to hand over ownership first.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive-outline" />}>
            <LogOutIcon />
            Leave organization
          </AlertDialogTrigger>
          <AlertDialogPopup>
            <AlertDialogHeader>
              <AlertDialogTitle>Leave {name}?</AlertDialogTitle>
              <AlertDialogDescription>
                You can only come back with a new invite.
              </AlertDialogDescription>
              <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
                {(error) => <FormError error={error} />}
              </form.Subscribe>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogClose render={<Button variant="ghost" />}>Cancel</AlertDialogClose>
              <Button variant="destructive" onClick={() => void form.handleSubmit()}>
                Leave
              </Button>
            </AlertDialogFooter>
          </AlertDialogPopup>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
};

export const OrgSettings = ({ onLeft }: { onLeft: () => void }) => {
  const { orgId } = useActiveOrg();
  const org = useQuery(api.orgs.get, { orgId });
  const roles = usePaginatedQuery(api.orgs.roles, { orgId }, { initialNumItems: 50 });
  const canManageRoles = org?.permissions.includes("manageRoles") ?? false;
  const canManageOrg = org?.permissions.includes("manageOrganization") ?? false;

  return (
    <div className="flex flex-col gap-6">
      <NameCard key={org?.name} canEdit={canManageOrg} />
      <InviteLinksCard />
      <JoinDomainCard />
      <Card>
        <CardHeader>
          <CardTitle>Roles and permissions</CardTitle>
          <CardDescription>
            Each member has one role. Owner and Admin can do everything, but only owners can make
            owners. You can only hand out permissions you have yourself.
          </CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-col divide-y">
          {org &&
            roles.results.map((role) => (
              <RoleSection key={role._id} role={role} canManage={canManageRoles} viewer={org} />
            ))}
          {canManageRoles && <AddRole />}
        </CardPanel>
      </Card>
      <ActivityCard />
      <LeaveCard onLeft={onLeft} />
    </div>
  );
};
