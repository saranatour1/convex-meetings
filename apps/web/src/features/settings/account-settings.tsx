import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "convex/react";
import { useAddPasskey, useRemovePasskey } from "@convex-dev/auth/methods/username-passkey/react";
import {
  BadgeCheckIcon,
  CameraIcon,
  KeyRoundIcon,
  LogOutIcon,
  MonitorIcon,
  PlusIcon,
  TrashIcon,
} from "lucide-react";
import { api, type Id } from "@meetings/backend";
import { Avatar, AvatarFallback, AvatarImage } from "@meetings/ui/components/avatar";
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
import { Textarea } from "@meetings/ui/components/textarea";
import { FormError } from "#/components/form-error.tsx";
import { LoadingScreen } from "#/components/loading-screen.tsx";
import { describeAuthError } from "#/features/auth/auth-errors.ts";
import { describeError } from "#/lib/errors.ts";
import { getInitials } from "#/lib/initials.ts";
import { formatAgo } from "#/lib/schedule.ts";

type Viewer = NonNullable<ReturnType<typeof useViewer>>;
const useViewer = () => useQuery(api.users.viewer);

const PhotoButton = () => {
  const generateUploadUrl = useMutation(api.users.generateAvatarUploadUrl);
  const updateAvatar = useMutation(api.users.updateAvatar);
  const form = useForm({
    defaultValues: { file: null as File | null },
    validators: {
      onSubmitAsync: async ({ value }) => {
        if (!value.file) return undefined;
        try {
          const response = await fetch(await generateUploadUrl(), {
            method: "POST",
            headers: { "Content-Type": value.file.type },
            body: value.file,
          });
          const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
          await updateAvatar({ imageId: storageId });
          return undefined;
        } catch (error) {
          return describeError(error);
        }
      },
    },
  });

  return (
    <div className="flex flex-col gap-1">
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button
            variant="outline"
            size="sm"
            disabled={isSubmitting}
            render={<label />}
            className="cursor-pointer"
          >
            <CameraIcon />
            {isSubmitting ? "Uploading…" : "Change photo"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                form.setFieldValue("file", event.target.files?.[0] ?? null);
                void form.handleSubmit();
                event.target.value = "";
              }}
            />
          </Button>
        )}
      </form.Subscribe>
      <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
        {(error) => <FormError error={error} />}
      </form.Subscribe>
    </div>
  );
};

const ProfileCard = ({ viewer }: { viewer: Viewer }) => {
  const updateName = useMutation(api.users.updateName);
  const updateBio = useMutation(api.users.updateBio);
  const form = useForm({
    defaultValues: { name: viewer.name, bio: viewer.bio ?? "" },
    validators: {
      onSubmitAsync: async ({ value }) => {
        try {
          await updateName({ name: value.name });
          await updateBio({ bio: value.bio });
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
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            How you appear to people in your organizations and calls.
          </CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              {viewer.imageUrl && <AvatarImage src={viewer.imageUrl} alt="" />}
              <AvatarFallback className="text-lg">{getInitials(viewer.name)}</AvatarFallback>
            </Avatar>
            <PhotoButton />
          </div>
          <form.Field name="name">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="profile-name">Name</Label>
                <Input
                  id="profile-name"
                  value={field.state.value}
                  maxLength={100}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="bio">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="profile-bio">Bio</Label>
                <Textarea
                  id="profile-bio"
                  value={field.state.value}
                  maxLength={280}
                  placeholder="A line about you"
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </div>
            )}
          </form.Field>
          <div className="flex flex-col gap-2">
            <Label>Email</Label>
            <span className="flex items-center gap-2 text-sm">
              {viewer.email ?? (
                <span className="text-muted-foreground">Added when you accept an email invite</span>
              )}
              {viewer.isVerified && (
                <Badge variant="success" size="sm">
                  <BadgeCheckIcon />
                  Verified
                </Badge>
              )}
            </span>
          </div>
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
                  {isSubmitting ? "Saving…" : "Save"}
                </Button>
              </>
            )}
          </form.Subscribe>
        </CardFooter>
      </Card>
    </form>
  );
};

const PasskeysCard = () => {
  const list = useQuery(api.auth.listPasskeys);
  const rename = useMutation(api.auth.renamePasskey);
  const { addPasskey, pending: adding } = useAddPasskey(api.auth);
  const { removePasskey, pending: removing } = useRemovePasskey(api.auth);
  const passkeys = list?.success ? list.passkeys : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Passkeys</CardTitle>
        <CardDescription>
          The devices you sign in with. Adding or removing one asks for an existing passkey.
        </CardDescription>
      </CardHeader>
      <CardPanel className="flex flex-col gap-3">
        <ul className="flex flex-col divide-y">
          {passkeys.map((passkey) => (
            <li key={passkey.passkeyId} className="flex items-center gap-3 py-2">
              <KeyRoundIcon className="size-4 opacity-70" />
              <Input
                aria-label="Passkey name"
                defaultValue={passkey.name ?? "Passkey"}
                className="max-w-64"
                onBlur={(event) => {
                  const name = event.target.value.trim();
                  if (name && name !== passkey.name) {
                    void rename({ passkeyId: passkey.passkeyId, name });
                  }
                }}
              />
              <span className="text-muted-foreground text-xs">
                Added {new Date(passkey.createdAt).toLocaleDateString()}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                className="ms-auto"
                aria-label="Remove passkey"
                disabled={removing || passkeys.length < 2}
                title={
                  passkeys.length < 2 ? "Add another passkey before removing this one" : undefined
                }
                onClick={() => void removePasskey(passkey.passkeyId)}
              >
                <TrashIcon />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          className="self-start"
          disabled={adding}
          onClick={() => void addPasskey()}
        >
          <PlusIcon />
          {adding ? "Waiting for your passkey…" : "Add a passkey"}
        </Button>
      </CardPanel>
    </Card>
  );
};

const PasswordCard = () => {
  const changePassword = useMutation(api.auth.changePassword);
  const form = useForm({
    defaultValues: { currentPassword: "", newPassword: "" },
    validators: {
      onSubmitAsync: async ({ value, formApi }) => {
        const result = await changePassword(value);
        if (!result.success) return describeAuthError(result.userError.error);
        formApi.reset();
        return undefined;
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
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <CardPanel className="flex flex-col gap-4">
          <form.Field name="currentPassword">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="newPassword">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
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
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" disabled={isSubmitting}>
                Change password
              </Button>
            )}
          </form.Subscribe>
        </CardFooter>
      </Card>
    </form>
  );
};

const SessionsCard = () => {
  const sessions = useQuery(api.users.sessions);
  const signOutEverywhere = useMutation(api.users.signOutEverywhere);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Where you're signed in</CardTitle>
        <CardDescription>
          Each line is a browser or device. If you don't recognize one, sign out everywhere and
          change how you sign in.
        </CardDescription>
      </CardHeader>
      <CardPanel>
        <ul className="flex flex-col divide-y">
          {sessions?.map((session) => (
            <li key={session._id} className="flex items-center gap-3 py-2 text-sm">
              <MonitorIcon className="size-4 opacity-60" />
              <span className="flex-1">
                Signed in {formatAgo(session.startedAt)} · active {formatAgo(session.lastActiveAt)}
              </span>
              {session.current && <Badge variant="outline">This device</Badge>}
            </li>
          ))}
        </ul>
      </CardPanel>
      <CardFooter>
        <Button variant="destructive-outline" onClick={() => void signOutEverywhere({})}>
          <LogOutIcon />
          Sign out everywhere
        </Button>
      </CardFooter>
    </Card>
  );
};

const OAUTH_LABEL = { google: "Google", github: "GitHub" } as const;

export const AccountSettings = () => {
  const viewer = useViewer();
  if (viewer === undefined) return <LoadingScreen />;
  if (viewer === null) return null;

  return (
    <div className="flex flex-col gap-6">
      <ProfileCard viewer={viewer} />
      {viewer.method === "usernamePasskey" && <PasskeysCard />}
      {viewer.method === "usernamePassword" && <PasswordCard />}
      {(viewer.method === "google" || viewer.method === "github") && (
        <Card>
          <CardHeader>
            <CardTitle>Sign-in</CardTitle>
            <CardDescription>You sign in with {OAUTH_LABEL[viewer.method]}.</CardDescription>
          </CardHeader>
        </Card>
      )}
      <SessionsCard />
    </div>
  );
};
