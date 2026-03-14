"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDate } from "@/app/lib/admin-api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:5000";

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
  twoFactorEnabled: boolean | null;
  createdAt: string;
  _count: UserCount;
}

interface UsersResponse {
  count: number;
  users: UserRow[];
}

interface UserDetails extends UserRow {
  sessions: Array<{
    id: string;
    createdAt: string;
    expiresAt: string;
    ipAddress: string | null;
    userAgent: string | null;
  }>;
  accounts: Array<{
    id: string;
    providerId: string;
    createdAt: string;
  }>;
  purchases: Array<{
    id: string;
    amount: number;
    status: string;
    razorpayOrderId: string;
    createdAt: string;
  }>;
  createdAgreements: Array<{
    id: string;
    title: string;
    status: string;
    amount: number;
    createdAt: string;
  }>;
  receivedAgreements: Array<{
    id: string;
    title: string;
    status: string;
    amount: number;
    createdAt: string;
  }>;
  raisedTickets: Array<{
    id: string;
    title: string;
    status: string;
    reason: string;
    createdAt: string;
  }>;
  ticketsAgainstMe: Array<{
    id: string;
    title: string;
    status: string;
    reason: string;
    createdAt: string;
  }>;
  passkeys: Array<{
    id: string;
    name: string | null;
    deviceType: string | null;
    createdAt: string;
  }>;
  twofactors: Array<{
    id: string;
    secret: string;
  }>;
  _count: UserCount & {
    sessions: number;
    accounts: number;
    passkeys: number;
    twofactors: number;
  };
}

interface UserDetailsResponse {
  user: UserDetails;
}

const summarizeError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error";
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [activeActionUserId, setActiveActionUserId] = useState<string | null>(null);

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

  const loadUserDetails = useCallback(async (userId: string) => {
    try {
      setIsDetailsLoading(true);
      setDetailsError(null);
      setIsModalOpen(true);
      setSelectedUser(null);

      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, { cache: "no-store" });
      const payload = (await response.json()) as UserDetailsResponse | { error?: string };

      if (!response.ok || !("user" in payload)) {
        throw new Error(("error" in payload && payload.error) || "Failed to fetch user details");
      }

      setSelectedUser(payload.user);
    } catch (error: unknown) {
      setDetailsError(summarizeError(error));
    } finally {
      setIsDetailsLoading(false);
    }
  }, []);

  const handleToggleBan = useCallback(async (user: Pick<UserRow, "id" | "isBanned">) => {
    const nextIsBanned = !user.isBanned;

    try {
      setActiveActionUserId(user.id);
      const response = await fetch(`${API_BASE_URL}/admin/users/${user.id}/ban`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBanned: nextIsBanned }),
      });

      const payload = (await response.json()) as {
        error?: string;
        user?: { isBanned: boolean; bannedAt: string | null };
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
              }
            : row,
        ),
      );

      setSelectedUser((prev) => {
        if (!prev || prev.id !== user.id) {
          return prev;
        }

        return {
          ...prev,
          isBanned: payload.user?.isBanned ?? nextIsBanned,
          bannedAt: payload.user?.bannedAt ?? (nextIsBanned ? new Date().toISOString() : null),
        };
      });
    } catch (error: unknown) {
      setPageError(summarizeError(error));
    } finally {
      setActiveActionUserId(null);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const countCards = useMemo(() => {
    if (!selectedUser) {
      return [];
    }

    return [
      { label: "Purchases", value: selectedUser._count.purchases },
      { label: "Created Agreements", value: selectedUser._count.createdAgreements },
      { label: "Received Agreements", value: selectedUser._count.receivedAgreements },
      { label: "Raised Tickets", value: selectedUser._count.raisedTickets },
      { label: "Tickets Against", value: selectedUser._count.ticketsAgainstMe },
      { label: "Sessions", value: selectedUser._count.sessions },
      { label: "Accounts", value: selectedUser._count.accounts },
      { label: "Passkeys", value: selectedUser._count.passkeys },
    ];
  }, [selectedUser]);

  return (
    <section className="admin-page">
      <header className="admin-page-header">
        <h2>User Management</h2>
        <p>Click any user name to view full data in a popup. Ban/unban is available from table and popup.</p>
      </header>

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
                    <button
                      type="button"
                      className="border-0 bg-transparent p-0 font-semibold text-[#1d4c35] hover:underline"
                      onClick={() => loadUserDetails(user.id)}
                    >
                      {user.name}
                    </button>
                  </td>
                  <td>{user.email}</td>
                  <td>{user.isBanned ? "BANNED" : "ACTIVE"}</td>
                  <td>{user.emailVerified ? "Yes" : "No"}</td>
                  <td>{user.twoFactorEnabled ? "On" : "Off"}</td>
                  <td>{user._count.purchases}</td>
                  <td>{user._count.createdAgreements + user._count.receivedAgreements}</td>
                  <td>{user._count.raisedTickets + user._count.ticketsAgainstMe}</td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    <button
                      type="button"
                      className={
                        user.isBanned
                          ? "rounded-md border border-transparent bg-[#dff4e6] px-3 py-1 text-xs text-[#1f6a42]"
                          : "rounded-md border border-transparent bg-[#fde8c8] px-3 py-1 text-xs text-[#7b4c00]"
                      }
                      onClick={() => handleToggleBan(user)}
                      disabled={activeActionUserId === user.id}
                    >
                      {activeActionUserId === user.id ? "Saving..." : user.isBanned ? "Unban" : "Ban"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/35 p-4" onClick={() => setIsModalOpen(false)}>
          <article
            className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-2xl border border-[#d9d0bf] bg-[#fffdf8] shadow-[0_20px_44px_rgba(18,32,22,0.28)]"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="sticky top-0 z-[1] flex items-center justify-between border-b border-[#d9d0bf] bg-[#fffdf8] p-4">
              <h3 className="m-0 text-xl">{selectedUser?.name || "User Details"}</h3>
              <button
                type="button"
                className="rounded-md border border-[#d9d0bf] bg-[#f4f8eb] px-3 py-1.5 text-sm text-[#122016]"
                onClick={() => setIsModalOpen(false)}
              >
                Close
              </button>
            </header>

            {isDetailsLoading ? <p className="p-4">Loading user details...</p> : null}
            {detailsError ? <p className="p-4 text-sm text-[#8f1f2f]">{detailsError}</p> : null}

            {selectedUser ? (
              <div className="flex flex-col gap-4 p-4">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <p><strong>ID:</strong> {selectedUser.id}</p>
                  <p><strong>Email:</strong> {selectedUser.email}</p>
                  <p><strong>Status:</strong> {selectedUser.isBanned ? "BANNED" : "ACTIVE"}</p>
                  <p><strong>Verified:</strong> {selectedUser.emailVerified ? "Yes" : "No"}</p>
                  <p><strong>2FA Enabled:</strong> {selectedUser.twoFactorEnabled ? "Yes" : "No"}</p>
                  <p><strong>Banned At:</strong> {selectedUser.bannedAt ? formatDate(selectedUser.bannedAt) : "N/A"}</p>
                  <p><strong>Created At:</strong> {formatDate(selectedUser.createdAt)}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {countCards.map((item) => (
                    <div className="rounded-xl border border-[#d9d0bf] bg-[#f9fdf3] p-3" key={item.label}>
                      <span className="block text-xs text-[#526157]">{item.label}</span>
                      <strong className="text-lg leading-tight">{item.value}</strong>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-[#d9d0bf] bg-[#fefcf6] p-4">
                  <h4 className="mb-2 mt-0">Linked Accounts</h4>
                  {selectedUser.accounts.length === 0 ? (
                    <p className="text-[#617266]">No linked accounts.</p>
                  ) : (
                    selectedUser.accounts.map((account) => (
                      <p key={account.id}>{account.providerId} ({formatDate(account.createdAt)})</p>
                    ))
                  )}
                </div>

                <div className="rounded-xl border border-[#d9d0bf] bg-[#fefcf6] p-4">
                  <h4 className="mb-2 mt-0">Recent Purchases</h4>
                  {selectedUser.purchases.length === 0 ? (
                    <p className="text-[#617266]">No purchases.</p>
                  ) : (
                    selectedUser.purchases.map((purchase) => (
                      <p key={purchase.id}>
                        {purchase.status} | {purchase.amount} | {purchase.razorpayOrderId || "-"} | {formatDate(purchase.createdAt)}
                      </p>
                    ))
                  )}
                </div>

                <div className="rounded-xl border border-[#d9d0bf] bg-[#fefcf6] p-4">
                  <h4 className="mb-2 mt-0">Recent Agreements</h4>
                  {selectedUser.createdAgreements.length === 0 && selectedUser.receivedAgreements.length === 0 ? (
                    <p className="text-[#617266]">No agreements.</p>
                  ) : (
                    <>
                      {selectedUser.createdAgreements.map((agreement) => (
                        <p key={agreement.id}>CREATED | {agreement.title} | {agreement.status} | {agreement.amount}</p>
                      ))}
                      {selectedUser.receivedAgreements.map((agreement) => (
                        <p key={agreement.id}>RECEIVED | {agreement.title} | {agreement.status} | {agreement.amount}</p>
                      ))}
                    </>
                  )}
                </div>

                <div className="rounded-xl border border-[#d9d0bf] bg-[#fefcf6] p-4">
                  <h4 className="mb-2 mt-0">Recent Tickets</h4>
                  {selectedUser.raisedTickets.length === 0 && selectedUser.ticketsAgainstMe.length === 0 ? (
                    <p className="text-[#617266]">No tickets.</p>
                  ) : (
                    <>
                      {selectedUser.raisedTickets.map((ticket) => (
                        <p key={ticket.id}>RAISED | {ticket.title} | {ticket.status} | {ticket.reason}</p>
                      ))}
                      {selectedUser.ticketsAgainstMe.map((ticket) => (
                        <p key={ticket.id}>AGAINST | {ticket.title} | {ticket.status} | {ticket.reason}</p>
                      ))}
                    </>
                  )}
                </div>

                <div className="rounded-xl border border-[#d9d0bf] bg-[#fefcf6] p-4">
                  <h4 className="mb-2 mt-0">Sessions & Security</h4>
                  <p>Sessions: {selectedUser.sessions.length}</p>
                  <p>Passkeys: {selectedUser.passkeys.length}</p>
                  <p>2FA Records: {selectedUser.twofactors.length}</p>
                </div>

                <details className="rounded-xl border border-dashed border-[#d9d0bf] bg-[#fcfaf5] p-3">
                  <summary className="cursor-pointer font-semibold">Raw Complete Data</summary>
                  <pre className="mt-3 max-h-[340px] overflow-auto whitespace-pre-wrap break-words text-xs">
                    {JSON.stringify(selectedUser, null, 2)}
                  </pre>
                </details>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={
                      selectedUser.isBanned
                        ? "rounded-md border border-transparent bg-[#dff4e6] px-3 py-1.5 text-sm text-[#1f6a42]"
                        : "rounded-md border border-transparent bg-[#fde8c8] px-3 py-1.5 text-sm text-[#7b4c00]"
                    }
                    onClick={() => handleToggleBan({ id: selectedUser.id, isBanned: selectedUser.isBanned })}
                    disabled={activeActionUserId === selectedUser.id}
                  >
                    {activeActionUserId === selectedUser.id ? "Saving..." : selectedUser.isBanned ? "Unban User" : "Ban User"}
                  </button>
                </div>
              </div>
            ) : null}
          </article>
        </div>
      ) : null}
    </section>
  );
}
