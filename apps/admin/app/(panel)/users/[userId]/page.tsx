"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

type UserDetails = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  isBanned: boolean;
  bannedAt: string | null;
  twoFactorEnabled: boolean | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    sessions: number;
    accounts: number;
    purchases: number;
    createdAgreements: number;
    receivedAgreements: number;
    raisedTickets: number;
    ticketsAgainstMe: number;
    passkeys: number;
    twofactors: number;
  };
  sessions: Array<{ id: string; createdAt: string; expiresAt: string; ipAddress: string | null; userAgent: string | null }>;
  accounts: Array<{ id: string; providerId: string; createdAt: string }>;
  purchases: Array<{ id: string; amount: number; status: string; razorpayOrderId: string; createdAt: string }>;
  createdAgreements: Array<{ id: string; title: string; status: string; amount: number; createdAt: string }>;
  receivedAgreements: Array<{ id: string; title: string; status: string; amount: number; createdAt: string }>;
  raisedTickets: Array<{ id: string; title: string; status: string; reason: string; createdAt: string }>;
  ticketsAgainstMe: Array<{ id: string; title: string; status: string; reason: string; createdAt: string }>;
  passkeys: Array<{ id: string; name: string | null; deviceType: string; createdAt: string | null }>;
  twofactors: Array<{ id: string; secret: string }>;
};

const fmt = (value: string | null) => (value ? new Date(value).toLocaleString("en-IN") : "-");

export default function UserDetailsPage() {
  const params = useParams<{ userId: string }>();
  const router = useRouter();
  const userId = useMemo(() => params?.userId ?? "", [params]);

  const [user, setUser] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/admin/users/${userId}`, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || "Failed to load user");
      }
      const data = await res.json();
      setUser(data.user as UserDetails);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load user details";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const toggleBan = async () => {
    if (!user) return;
    try {
      setWorking(true);
      const res = await fetch(`${API_BASE_URL}/admin/users/${user.id}/ban`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBanned: !user.isBanned }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || "Failed to update ban status");
      }
      await fetchUser();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update user";
      alert(message);
    } finally {
      setWorking(false);
    }
  };

  const deleteUser = async () => {
    if (!user) return;
    const ok = window.confirm(`Delete user ${user.email}? This cannot be undone.`);
    if (!ok) return;

    try {
      setWorking(true);
      const res = await fetch(`${API_BASE_URL}/admin/users/${user.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || "Failed to delete user");
      }
      router.push("/users");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete user";
      alert(message);
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return <section className="admin-page"><p>Loading user details...</p></section>;
  }

  if (error || !user) {
    return (
      <section className="admin-page">
        <h2>User Details</h2>
        <p>{error || "User not found"}</p>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <header className="admin-page-header">
        <h2>{user.name}</h2>
        <p>{user.email}</p>
      </header>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={working}
          onClick={toggleBan}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {user.isBanned ? "Unban User" : "Ban User"}
        </button>
        <button
          type="button"
          disabled={working}
          onClick={deleteUser}
          className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Delete User
        </button>
      </div>

      <div className="stat-grid">
        <article className="stat-card"><h3>Status</h3><strong>{user.isBanned ? "BANNED" : "ACTIVE"}</strong></article>
        <article className="stat-card"><h3>Email Verified</h3><strong>{user.emailVerified ? "YES" : "NO"}</strong></article>
        <article className="stat-card"><h3>2FA</h3><strong>{user.twoFactorEnabled ? "ON" : "OFF"}</strong></article>
        <article className="stat-card"><h3>Created</h3><strong>{fmt(user.createdAt)}</strong></article>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Metric</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>Sessions</td><td>{user._count.sessions}</td></tr>
            <tr><td>Accounts</td><td>{user._count.accounts}</td></tr>
            <tr><td>Passkeys</td><td>{user._count.passkeys}</td></tr>
            <tr><td>Purchases</td><td>{user._count.purchases}</td></tr>
            <tr><td>Created Agreements</td><td>{user._count.createdAgreements}</td></tr>
            <tr><td>Received Agreements</td><td>{user._count.receivedAgreements}</td></tr>
            <tr><td>Raised Tickets</td><td>{user._count.raisedTickets}</td></tr>
            <tr><td>Tickets Against User</td><td>{user._count.ticketsAgainstMe}</td></tr>
            <tr><td>Banned At</td><td>{fmt(user.bannedAt)}</td></tr>
            <tr><td>Last Updated</td><td>{fmt(user.updatedAt)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Recent Purchases</th><th>Status</th><th>Amount</th><th>Created</th></tr></thead>
          <tbody>
            {user.purchases.map((p) => (
              <tr key={p.id}>
                <td>{p.razorpayOrderId}</td>
                <td>{p.status}</td>
                <td>{p.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>{fmt(p.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
