import { Link } from "@tanstack/react-router";
import { UsersIcon } from "lucide-react";
import { Button } from "@meetings/ui/components/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@meetings/ui/components/card";
import { useActiveOrg } from "./active-org.tsx";

export const OrgSettings = () => {
  const { name } = useActiveOrg();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription>Manage who's in this organization and what they can do.</CardDescription>
      </CardHeader>
      <CardPanel>
        <Button variant="outline" render={<Link to="/members" />}>
          <UsersIcon />
          Members and invites
        </Button>
      </CardPanel>
    </Card>
  );
};
