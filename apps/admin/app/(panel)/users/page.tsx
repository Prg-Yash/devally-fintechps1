"use client";

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

  const handleToggleBan = useCallback(async (user: Pick<UserRow, "id" | "isBanned">, duration?: number | null) => {
    const nextIsBanned = !user.isBanned;

    try {
      setActiveActionUserId(user.id);
      const response = await fetch(`${API_BASE_URL}/admin/users/${user.id}/ban`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          isBanned: nextIsBanned,
          duration: nextIsBanned ? (duration ?? null) : undefined 
        }),
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
                banExpiresAt: (payload.user as any)?.banExpiresAt ?? null,
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
          banExpiresAt: (payload.user as any)?.banExpiresAt ?? null,
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
                      {!user.isBanned && (
                        <select 
                          className="text-[10px] bg-transparent border border-[#d9d0bf] rounded p-0.5"
                          onChange={(e) => {
                            const val = e.target.value === "permanent" ? null : Number(e.target.value);
                            setBanDurations(prev => ({ ...prev, [user.id]: val }));
                          }}
                          value={banDurations[user.id] ?? "permanent"}
                        >
                          <option value="permanent">Permanent</option>
                          <option value="1">1 Hour</option>
                          <option value="24">1 Day</option>
                          <option value="168">1 Week</option>
                          <option value="720">30 Days</option>
                        </select>
                      )}
                    </div>
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
                  <p><strong>Ban Expires:</strong> {selectedUser.banExpiresAt ? formatDate(selectedUser.banExpiresAt) : (selectedUser.isBanned ? "Permanent" : "N/A")}</p>
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
                  <h4 className="mb-4 mt-0 text-[#122016]">Linked Accounts</h4>
                  {selectedUser.accounts.length === 0 ? (
                    <p className="text-[#617266]">No linked accounts found.</p>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#d9d0bf]">
                          <th className="pb-2">Provider</th>
                          <th className="pb-2">ID</th>
                          <th className="pb-2">Connected</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedUser.accounts.map((account) => (
                          <tr key={account.id} className="border-b border-[#ece6d9] last:border-0">
                            <td className="py-2 text-[#1d4c35] font-medium">{account.providerId}</td>
                            <td className="py-2 text-[#526157]">{account.id}</td>
                            <td className="py-2 text-[#526157]">{formatDate(account.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="rounded-xl border border-[#d9d0bf] bg-[#fefcf6] p-4">
                  <h4 className="mb-4 mt-0 text-[#122016]">Purchases</h4>
                  {selectedUser.purchases.length === 0 ? (
                    <p className="text-[#617266]">No purchase history available.</p>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#d9d0bf]">
                          <th className="pb-2">Status</th>
                          <th className="pb-2">Amount</th>
                          <th className="pb-2">Order ID</th>
                          <th className="pb-2">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedUser.purchases.map((purchase) => (
                          <tr key={purchase.id} className="border-b border-[#ece6d9] last:border-0">
                            <td className="py-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                                purchase.status === 'COMPLETED' ? 'bg-[#dff4e6] text-[#1f6a42]' : 'bg-[#fde8c8] text-[#7b4c00]'
                              }`}>
                                {purchase.status}
                              </span>
                            </td>
                            <td className="py-2 font-mono font-bold">₹{purchase.amount}</td>
                            <td className="py-2 text-[#526157]">{purchase.razorpayOrderId || "Manual"}</td>
                            <td className="py-2 text-[#526157]">{formatDate(purchase.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="rounded-xl border border-[#d9d0bf] bg-[#fefcf6] p-4">
                  <h4 className="mb-4 mt-0 text-[#122016]">Agreements</h4>
                  {selectedUser.createdAgreements.length === 0 && selectedUser.receivedAgreements.length === 0 ? (
                    <p className="text-[#617266]">No agreements found.</p>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#d9d0bf]">
                          <th className="pb-2">Role</th>
                          <th className="pb-2">Title</th>
                          <th className="pb-2">Status</th>
                          <th className="pb-2">Amount</th>
                          <th className="pb-2">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedUser.createdAgreements.map((agreement) => (
                          <tr key={agreement.id} className="border-b border-[#ece6d9] last:border-0">
                            <td className="py-2 text-[#7b4c00] font-bold text-[10px]">CREATOR</td>
                            <td className="py-2 text-[#122016]">{agreement.title}</td>
                            <td className="py-2">{agreement.status}</td>
                            <td className="py-2 font-mono">₹{agreement.amount}</td>
                            <td className="py-2 text-[#526157]">{formatDate(agreement.createdAt)}</td>
                          </tr>
                        ))}
                        {selectedUser.receivedAgreements.map((agreement) => (
                          <tr key={agreement.id} className="border-b border-[#ece6d9] last:border-0">
                            <td className="py-2 text-[#1f6a42] font-bold text-[10px]">RECIPIENT</td>
                            <td className="py-2 text-[#122016]">{agreement.title}</td>
                            <td className="py-2">{agreement.status}</td>
                            <td className="py-2 font-mono">₹{agreement.amount}</td>
                            <td className="py-2 text-[#526157]">{formatDate(agreement.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="rounded-xl border border-[#d9d0bf] bg-[#fefcf6] p-4">
                  <h4 className="mb-4 mt-0 text-[#122016]">Support Tickets</h4>
                  {selectedUser.raisedTickets.length === 0 && selectedUser.ticketsAgainstMe.length === 0 ? (
                    <p className="text-[#617266]">No tickets found.</p>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#d9d0bf]">
                          <th className="pb-2">Type</th>
                          <th className="pb-2">Title</th>
                          <th className="pb-2">Status</th>
                          <th className="pb-2">Reason</th>
                          <th className="pb-2">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedUser.raisedTickets.map((ticket) => (
                          <tr key={ticket.id} className="border-b border-[#ece6d9] last:border-0">
                            <td className="py-2 text-[#1f6a42] font-bold text-[10px]">RAISED</td>
                            <td className="py-2 text-[#122016]">{ticket.title}</td>
                            <td className="py-2">{ticket.status}</td>
                            <td className="py-2 text-[#526157]">{ticket.reason}</td>
                            <td className="py-2 text-[#526157]">{formatDate(ticket.createdAt)}</td>
                          </tr>
                        ))}
                        {selectedUser.ticketsAgainstMe.map((ticket) => (
                          <tr key={ticket.id} className="border-b border-[#ece6d9] last:border-0">
                            <td className="py-2 text-[#8f1f2f] font-bold text-[10px]">AGAINST</td>
                            <td className="py-2 text-[#122016]">{ticket.title}</td>
                            <td className="py-2">{ticket.status}</td>
                            <td className="py-2 text-[#526157]">{ticket.reason}</td>
                            <td className="py-2 text-[#526157]">{formatDate(ticket.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="rounded-xl border border-[#d9d0bf] bg-[#fefcf6] p-4">
                  <h4 className="mb-4 mt-0 text-[#122016]">Sessions & Security Data</h4>
                  <div className="mb-6">
                    <h5 className="text-xs font-bold uppercase text-[#526157] mb-2">Active Sessions ({selectedUser.sessions.length})</h5>
                    {selectedUser.sessions.length === 0 ? <p className="text-sm">No active sessions.</p> : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {selectedUser.sessions.map(session => (
                          <div key={session.id} className="p-2 border border-[#d9d0bf] rounded-lg bg-[#fff]">
                            <p className="text-xs font-bold truncate">{session.userAgent || 'Unknown Device'}</p>
                            <p className="text-[10px] text-[#526157]">IP: {session.ipAddress || 'N/A'}</p>
                            <p className="text-[10px] text-[#526157]">Expires: {formatDate(session.expiresAt)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="mb-6">
                    <h5 className="text-xs font-bold uppercase text-[#526157] mb-2">Passkeys ({selectedUser.passkeys.length})</h5>
                    {selectedUser.passkeys.length === 0 ? <p className="text-sm">No passkeys registered.</p> : (
                      <div className="flex flex-wrap gap-2">
                        {selectedUser.passkeys.map(pk => (
                          <div key={pk.id} className="px-3 py-2 border border-[#d9d0bf] rounded-lg bg-[#f9fdf3]">
                            <p className="text-xs font-bold">{pk.name || pk.deviceType || 'Biometric Key'}</p>
                            <p className="text-[10px] text-[#526157]">Added: {formatDate(pk.createdAt)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h5 className="text-xs font-bold uppercase text-[#526157] mb-2">2FA Configurations ({selectedUser.twofactors.length})</h5>
                    {selectedUser.twofactors.length === 0 ? <p className="text-sm">MFA not configured.</p> : (
                      <div className="flex flex-wrap gap-2">
                        {selectedUser.twofactors.map(tf => (
                          <div key={tf.id} className="px-3 py-2 border border-[#d9d0bf] rounded-lg bg-[#ebf4f9]">
                            <p className="text-xs font-bold truncate w-32">Secret: {tf.secret.substring(0, 8)}...</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>


                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={
                      selectedUser.isBanned
                        ? "rounded-md border border-transparent bg-[#dff4e6] px-3 py-1.5 text-sm text-[#1f6a42]"
                        : "rounded-md border border-transparent bg-[#fde8c8] px-3 py-1.5 text-sm text-[#7b4c00]"
                    }
                    onClick={() => handleToggleBan({ id: selectedUser.id, isBanned: selectedUser.isBanned }, banDurations[selectedUser.id] ?? null)}
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
