import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2">
      <h1 className="text-2xl font-semibold">404 - Page not found</h1>
      <Link href="/dashboard" className="text-brand-600 underline">Back to dashboard</Link>
    </div>
  );
}
