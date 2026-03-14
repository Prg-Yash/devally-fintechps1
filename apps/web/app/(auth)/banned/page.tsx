import Link from "next/link";

export default function BannedPage() {
  return (
    <div className="min-h-screen bg-[#f8f5ef] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl rounded-3xl border border-[#e5dccb] bg-white p-8 shadow-lg">
        <div className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">
          Account Restricted
        </div>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-[#1f2a1f]">
          Your account is banned
        </h1>

        <p className="mt-3 text-base leading-relaxed text-[#4b5a4b]">
          You currently cannot access your account because it has been restricted by an administrator.
          If you think this is a mistake, please contact admin support.
        </p>

        <div className="mt-6 rounded-2xl border border-[#eadfcd] bg-[#fbf8f2] p-4 text-sm text-[#4b5a4b]">
          <p>
            Contact admin: <span className="font-semibold">support@devally.com</span>
          </p>
          <p className="mt-1">Include your account email and a brief explanation for review.</p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="inline-flex items-center rounded-xl bg-[#1f2a1f] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#111811]"
          >
            Back to Login
          </Link>
          <Link
            href="/"
            className="inline-flex items-center rounded-xl border border-[#d7ccb9] px-4 py-2.5 text-sm font-medium text-[#2e3a2f] hover:bg-[#f4ede1]"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
