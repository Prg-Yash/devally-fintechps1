"use client";

import { useActionState } from "react";
import { loginAdmin } from "./actions";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAdmin, null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fdfcf8] p-4 text-[#122016]">
      <div className="w-full max-w-md rounded-2xl border border-[#d9d0bf] bg-white p-8 shadow-[0_20px_44px_rgba(18,32,22,0.12)]">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-[#1d4c35]">
            PayCrow Admin
          </h1>
          <p className="mt-2 text-sm text-[#526157]">
            Sign in to access the control panel
          </p>
        </div>

        <form action={formAction} className="space-y-5">
          <div>
            <label
              className="block text-sm font-bold text-[#122016] mb-1.5"
              htmlFor="email"
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              defaultValue="admin@bytecamp.com"
              className="w-full rounded-lg border border-[#d9d0bf] bg-[#fafcf7] px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#1f6a42] focus:bg-white"
            />
          </div>

          <div>
            <label
              className="block text-sm font-bold text-[#122016] mb-1.5"
              htmlFor="password"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              defaultValue="admin123"
              className="w-full rounded-lg border border-[#d9d0bf] bg-[#fafcf7] px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#1f6a42] focus:bg-white"
            />
          </div>

          {state?.error && (
            <div className="rounded-lg bg-[#fde2e2] p-3 text-sm font-bold text-[#8f1f2f]">
              {state.error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-[#1f6a42] px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#154d30] disabled:opacity-70"
          >
            {isPending ? "Verifying..." : "Access Dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}
