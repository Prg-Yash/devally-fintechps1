"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDate } from "@/app/lib/admin-api";
import { AlertTriangle, ChevronRight, ShieldCheck, Users2, UserRoundCheck } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

interface UserCount {
  purchases: number;
  createdAgreements: number;
  receivedAgreements: number;
  raisedTickets: number;
  ticketsAgainstMe: number;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  isBanned: boolean;
  bannedAt: string | null;
  banExpiresAt: string | null;
  twoFactorEnabled: boolean | null;
  createdAt: string;
  _count: UserCount;
}

interface UsersResponse {
  count: number;
  users: UserRow[];
}

const summarizeError = (error: unknown) => (error instanceof Error ? error.message : "Unexpected error");

const userStatusBadge = (isBanned: boolean) =>
  isBanned
    ? "border-[#ebc9cf] bg-[#f9e6e9] text-[#8b2937]"
    : "border-[#cae4d0] bg-[#e7f5ea] text-[#1e6a3f]";

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [activeActionUserId, setActiveActionUserId] = useState<string | null>(null);
  const [banDurations, setBanDurations] = useState<Record<string, number | null>>({});

  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setPageError(null);
      const response = await fetch(`${API_BASE_URL}/admin/users?limit=200`, { cache: "no-store" });
      const payload = (await response.json()) as UsersResponse | { error?: string };

      if (!response.ok || !("users" in payload)) {
        throw new Error(("error" in payload && payload.error) || "Failed to fetch users");
      }

      setUsers(payload.users);
    } catch (error: unknown) {
      setPageError(summarizeError(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleToggleBan = useCallback(async (user: Pick<UserRow, "id" | "isBanned">, duration?: number | null) => {
    const nextIsBanned = !user.isBanned;

    try {
      setActiveActionUserId(user.id);
      const response = await fetch(`${API_BASE_URL}/admin/users/${user.id}/ban`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isBanned: nextIsBanned,
          duration: nextIsBanned ? (duration ?? null) : undefined,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        user?: { isBanned: boolean; bannedAt: string | null; banExpiresAt?: string | null };
      };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to update user status");
      }

      setUsers((prev) =>
        prev.map((row) =>
          row.id === user.id
            ? {
                ...row,
                isBanned: payload.user?.isBanned ?? nextIsBanned,
                bannedAt: payload.user?.bannedAt ?? (nextIsBanned ? new Date().toISOString() : null),
                banExpiresAt: payload.user?.banExpiresAt ?? null,
              }
            : row,
        ),
      );
    } catch (error: unknown) {
      setPageError(summarizeError(error));
    } finally {
      setActiveActionUserId(null);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const totalBanned = useMemo(() => users.filter((user) => user.isBanned).length, [users]);
  const total2FAEnabled = useMemo(() => users.filter((user) => user.twoFactorEnabled).length, [users]);

  return (
    <section className="admin-page space-y-6">
      <header className="rounded-[40px] border border-[#d9dfcf] bg-transparent px-6 py-8 text-[#121212]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-black/60">Identity Governance</p>
            <h2 className="mt-2 text-4xl md:text-5xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-black">User Registry</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/75">Manage account access, moderation windows, and user trust posture from one unified surface.</p>
          </div>

          <div className="rounded-full border border-black/20 bg-transparent px-5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/60">Directory Health</p>
            <p className="mt-1 text-sm font-semibold text-black">{users.length} users indexed</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[28px] bg-white p-5 shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <div className="inline-flex rounded-full bg-[#D9F24F]/35 p-2 text-[#1A2406]">
            <Users2 className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#1A2406]/55">Total Users</h3>
          <strong className="mt-1 block text-3xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-[#1A2406]">{users.length}</strong>
        </article>

        <article className="rounded-[28px] bg-white p-5 text-black shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <div className="inline-flex rounded-full bg-[#eef2eb] p-2 text-black">
            <UserRoundCheck className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-black/65">2FA Enabled</h3>
          <strong className="mt-1 block text-3xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-black">{total2FAEnabled}</strong>
        </article>

        <article className="rounded-[28px] bg-white p-5 shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <div className="inline-flex rounded-full bg-[#E7F5EA] p-2 text-[#1E6A3F]">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#1A2406]/55">Active</h3>
          <strong className="mt-1 block text-3xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-[#1A2406]">{users.length - totalBanned}</strong>
        </article>

        <article className="rounded-[28px] bg-white p-5 text-black shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <div className="inline-flex rounded-full bg-[#eef2eb] p-2 text-black">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-black/65">Banned</h3>
          <strong className="mt-1 block text-3xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-black">{totalBanned}</strong>
        </article>
      </div>

      {pageError ? <p className="rounded-xl border border-[#eccbcb] bg-[#fae8e8] px-4 py-3 text-sm font-semibold text-[#8f1f2f]">{pageError}</p> : null}

      <div className="overflow-hidden rounded-4xl bg-white shadow-[0_18px_38px_-14px_rgba(26,36,6,0.34)]">
        <div className="flex items-center justify-between border-b border-[#1A2406]/10 bg-[#F7F8F2] px-5 py-4">
          <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-[#1A2406]/65">User Directory</h3>
          <p className="text-xs text-[#1A2406]/50">Open name for detailed profile</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Verified</th>
              <th>2FA</th>
              <th>Purchases</th>
              <th>Agreements</th>
              <th>Tickets</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={10} className="text-center text-[#1A2406]/50">Loading users...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-[#1A2406]/50">No users found.</td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <Link href={`/users/${user.id}`} className="group inline-flex items-center gap-1.5 font-semibold text-[#1A2406]">
                      <span className="group-hover:underline">{user.name}</span>
                      <ChevronRight className="h-3.5 w-3.5 opacity-45 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                    </Link>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    {user.isBanned ? (
                      <div className="flex flex-col">
                        <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] ${userStatusBadge(true)}`}>
                          BANNED
                        </span>
                        <span className="text-[10px] leading-tight text-[#526157]">
                          {user.banExpiresAt ? `Until ${formatDate(user.banExpiresAt)}` : "Permanent"}
                        </span>
                      </div>
                    ) : (
                      <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] ${userStatusBadge(false)}`}>
                        ACTIVE
                      </span>
                    )}
                  </td>
                  <td>{user.emailVerified ? "Yes" : "No"}</td>
                  <td>{user.twoFactorEnabled ? "On" : "Off"}</td>
                  <td>{user._count.purchases}</td>
                  <td>{user._count.createdAgreements + user._count.receivedAgreements}</td>
                  <td>{user._count.raisedTickets + user._count.ticketsAgainstMe}</td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        className={
                          user.isBanned
                            ? "rounded-md border border-[#cae4d0] bg-[#e7f5ea] px-3 py-1 text-xs font-semibold text-[#1f6a42]"
                            : "rounded-md border border-[#ebdfbd] bg-[#f9f3df] px-3 py-1 text-xs font-semibold text-[#7b4c00]"
                        }
                        onClick={() => handleToggleBan(user, banDurations[user.id] ?? null)}
                        disabled={activeActionUserId === user.id}
                      >
                        {activeActionUserId === user.id ? "Saving..." : user.isBanned ? "Unban" : "Ban"}
                      </button>
                      {!user.isBanned ? (
                        <select
                          className="text-[10px] border border-[#d9d0bf] rounded-md p-0.5 bg-white"
                          onChange={(e) => {
                            const val = e.target.value === "permanent" ? null : Number(e.target.value);
                            setBanDurations((prev) => ({ ...prev, [user.id]: val }));
                          }}
                          value={banDurations[user.id] ?? "permanent"}
                        >
                          <option value="permanent">Permanent</option>
                          <option value="1">1 Hour</option>
                          <option value="24">1 Day</option>
                          <option value="168">1 Week</option>
                          <option value="720">30 Days</option>
                        </select>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
