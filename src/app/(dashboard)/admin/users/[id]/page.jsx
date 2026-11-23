import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import { UUID_REGEX } from "@/lib/utils/forms";
import { getUser } from "@/services/users.service";
import { updateUserAction, resetPasswordAction } from "@/actions/users.actions";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import LinkButton from "@/components/ui/LinkButton";
import UserForm from "@/components/users/UserForm";
import ResetPasswordForm from "@/components/users/ResetPasswordForm";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Manage user | CareNova" };

export default async function ManageUserPage({ params }) {
  const me = await requireRole([ROLES.ADMIN]);
  const { id } = await params;
  if (!UUID_REGEX.test(id)) notFound();

  const user = await getUser(id);
  if (!user) notFound();

  const lockRole = user.id === me.id || Boolean(user.doctor);

  return (
    <>
      <PageHeader
        title={user.full_name}
        description={user.email ?? ""}
        action={<LinkButton href="/admin/users" variant="secondary" icon={ArrowLeft}>Back to list</LinkButton>}
      />
      <div className="space-y-6">
        <UserForm action={updateUserAction.bind(null, id)} mode="edit" user={user} lockRole={lockRole} submitLabel="Save changes" />
        <Card title="Reset password">
          <ResetPasswordForm action={resetPasswordAction.bind(null, id)} />
        </Card>
      </div>
    </>
  );
}
