import Link from "next/link";

export default function Unauthorized() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-4 text-center">
      <h1 className="text-2xl font-semibold">403 - Access denied</h1>
      <p className="text-slate-600">Your role is not allowed to view this page, or your account is disabled.</p>
      <Link href="/login" className="text-brand-600 underline">Back to login</Link>
    </div>
  );
}
