import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/constants/roles";
import { ROLE_LABEL } from "@/lib/constants/roles-ui";
import { listUsers } from "@/services/users.service";
import { setUserActiveAction } from "@/actions/users.actions";
import { formatDate } from "@/lib/utils/format";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import LinkButton from "@/components/ui/LinkButton";
import Badge from "@/components/ui/Badge";
import FlashMessage from "@/components/ui/FlashMessage";
import ConfirmDeleteButton from "@/components/ui/ConfirmDeleteButton";
import { Settings2, UserPlus } from "lucide-react";

export const metadata = { title: "User Management | CareNova" };

const FLASH = {
  created: "User created.", updated: "User updated.",
  enabled: "Account enabled.", disabled: "Account disabled.",
};
const ROLE_TONE = { admin: "red", doctor: "green", receptionist: "blue" };

export default async function UsersPage({ searchParams }) {
  const me = await requireRole([ROLES.ADMIN]);
  const sp = await searchParams;
  const users = await listUsers();

  const columns = [
    {
      key: "full_name", header: "Name",
      render: (u) => (
        <Link href={`/admin/users/${u.id}`} className="font-medium text-brand-700 hover:underline">{u.full_name}</Link>
      ),
    },
    { key: "email", header: "Email", render: (u) => u.email ?? "-" },
    { key: "role", header: "Role", render: (u) => <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge> },
    { key: "doctor", header: "Specialization", render: (u) => u.doctor?.specialization ?? "-" },
    {
      key: "is_active", header: "Status",
      render: (u) => <Badge tone={u.is_active ? "green" : "yellow"}>{u.is_active ? "Active" : "Disabled"}</Badge>,
    },
    { key: "created_at", header: "Created", render: (u) => formatDate(u.created_at) },
    {
      key: "actions", header: "Actions",
      render: (u) => (
        <div className="flex items-center gap-2">
          <LinkButton href={`/admin/users/${u.id}`} variant="secondary" small icon={Settings2}>Manage</LinkButton>
          {u.id !== me.id && (
            <ConfirmDeleteButton
              small
              variant="secondary"
              label={u.is_active ? "Disable" : "Enable"}
              action={setUserActiveAction.bind(null, u.id, !u.is_active)}
              title={`${u.is_active ? "Disable" : "Enable"} ${u.full_name}?`}
              message={u.is_active ? "They will be logged out and will not be able to sign in until you enable the account again." : "They will be able to sign in again."}
              confirmLabel={u.is_active ? "Yes, disable" : "Yes, enable"}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="User Management" description="Create accounts, change roles, disable access" action={<LinkButton href="/admin/users/new" icon={UserPlus}>Add user</LinkButton>} />
      <FlashMessage code={sp.msg} messages={FLASH} />
      <DataTable columns={columns} rows={users} empty="No users yet." />
    </>
  );
}
