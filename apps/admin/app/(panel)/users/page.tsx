"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDate } from "@/app/lib/admin-api";

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
    <section className="admin-page">
      <header className="admin-page-header">
        <h2>User Management</h2>
        <p>Open user profiles on dedicated detail pages. Ban and unban actions are available from this table.</p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <article className="rounded-2xl border border-[#d9d0bf] bg-[#fffdf8] p-4">
          <h3 className="text-sm text-[#516157]">Total Users</h3>
          <strong className="text-2xl text-[#122016]">{users.length}</strong>
        </article>
        <article className="rounded-2xl border border-[#d9d0bf] bg-[#fffdf8] p-4">
          <h3 className="text-sm text-[#516157]">Banned Users</h3>
          <strong className="text-2xl text-[#122016]">{totalBanned}</strong>
        </article>
        <article className="rounded-2xl border border-[#d9d0bf] bg-[#fffdf8] p-4">
          <h3 className="text-sm text-[#516157]">2FA Enabled</h3>
          <strong className="text-2xl text-[#122016]">{total2FAEnabled}</strong>
        </article>
      </div>

      {pageError ? <p className="text-sm text-[#8f1f2f]">{pageError}</p> : null}

      <div className="table-wrap">
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
                <td colSpan={10}>Loading users...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={10}>No users found.</td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <Link href={`/users/${user.id}`} className="font-semibold text-[#1d4c35] hover:underline">
                      {user.name}
                    </Link>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    {user.isBanned ? (
                      <div className="flex flex-col">
                        <span className="font-bold text-[#8f1f2f]">BANNED</span>
                        <span className="text-[10px] leading-tight text-[#526157]">
                          {user.banExpiresAt ? `Until ${formatDate(user.banExpiresAt)}` : "Permanent"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[#1f6a42]">ACTIVE</span>
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
                            ? "rounded-md border border-transparent bg-[#dff4e6] px-3 py-1 text-xs text-[#1f6a42]"
                            : "rounded-md border border-transparent bg-[#fde8c8] px-3 py-1 text-xs text-[#7b4c00]"
                        }
                        onClick={() => handleToggleBan(user, banDurations[user.id] ?? null)}
                        disabled={activeActionUserId === user.id}
                      >
                        {activeActionUserId === user.id ? "Saving..." : user.isBanned ? "Unban" : "Ban"}
                      </button>
                      {!user.isBanned ? (
                        <select
                          className="text-[10px] border border-[#d9d0bf] rounded p-0.5"
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
