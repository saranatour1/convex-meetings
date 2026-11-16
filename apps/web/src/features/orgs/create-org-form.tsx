import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { BuildingIcon } from "lucide-react";
import { api, type Id } from "@meetings/backend";
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
import { FormError } from "#/components/form-error.tsx";
import { describeError } from "#/lib/errors.ts";

type CreateOrgFormProps = {
  title: string;
  description: string;
  onCreated: (orgId: Id<"organizations">) => void;
};

export const CreateOrgForm = ({ title, description, onCreated }: CreateOrgFormProps) => {
  const create = useMutation(api.orgs.create);
  const form = useForm({
    defaultValues: { name: "" },
    validators: {
      onSubmitAsync: async ({ value }) => {
        try {
          onCreated(await create({ name: value.name }));
          return undefined;
        } catch (error) {
          return describeError(error);
        }
      },
    },
  });

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BuildingIcon className="size-4" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardPanel>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="name">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor={field.name}>Name</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Acme"
                  maxLength={80}
                  required
                />
              </div>
            )}
          </form.Field>
          <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
            {(error) => <FormError error={error} />}
          </form.Subscribe>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating…" : "Create organization"}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardPanel>
    </Card>
  );
};
