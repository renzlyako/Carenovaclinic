import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import { createUserAction } from "@/actions/users.actions";
import PageHeader from "@/components/ui/PageHeader";
import UserForm from "@/components/users/UserForm";

export const metadata = { title: "New user | CareNova" };

export default async function NewUserPage() {
  await requireRole([ROLES.ADMIN]);
  return (
    <>
      <PageHeader title="New user" description="The account can sign in right away with the temporary password" />
      <UserForm action={createUserAction} mode="create" submitLabel="Create user" />
    </>
  );
}
