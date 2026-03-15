"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, ShieldCheck, Users2 } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

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
    return (
      <section className="admin-page">
        <div className="rounded-2xl border border-[#d8e1d4] bg-white px-5 py-8 text-center text-sm font-medium text-[#54665a]">
          Loading user details...
        </div>
      </section>
    );
  }

  if (error || !user) {
    return (
      <section className="admin-page">
        <p className="rounded-xl border border-[#eccbcb] bg-[#fae8e8] px-4 py-3 text-sm font-semibold text-[#8f1f2f]">
          {error || "User not found"}
        </p>
      </section>
    );
  }

  return (
    <section className="admin-page space-y-6">
      <header className="rounded-[40px] border border-[#d9dfcf] bg-transparent px-6 py-8 text-[#121212]">
        <div className="flex flex-col gap-3">
          <Link href="/users" className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-black/60 hover:text-black">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Users
          </Link>

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-4xl md:text-5xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-black">{user.name}</h2>
              <p className="mt-2 text-xs text-black/70">{user.email}</p>
            </div>

            <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${user.isBanned ? "border-[#ebc9cf] bg-[#f9e6e9] text-[#8b2937]" : "border-[#cae4d0] bg-[#e7f5ea] text-[#1e6a3f]"}`}>
              {user.isBanned ? "BANNED" : "ACTIVE"}
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={working}
          onClick={toggleBan}
          className="rounded-lg border border-[#ebdfbd] bg-[#f9f3df] px-4 py-2 text-sm font-semibold text-[#7a5c1f] disabled:opacity-50"
        >
          {user.isBanned ? "Unban User" : "Ban User"}
        </button>
        <button
          type="button"
          disabled={working}
          onClick={deleteUser}
          className="rounded-lg border border-[#ebc9cf] bg-[#f9e6e9] px-4 py-2 text-sm font-semibold text-[#8b2937] disabled:opacity-50"
        >
          Delete User
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[28px] bg-white p-5 shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <div className="inline-flex rounded-full bg-[#D9F24F]/35 p-2 text-[#1A2406]"><Users2 className="h-4 w-4" /></div>
          <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#1A2406]/55">Status</h3>
          <strong className="mt-1 block text-3xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-[#1A2406]">{user.isBanned ? "BANNED" : "ACTIVE"}</strong>
        </article>
        <article className="rounded-[28px] bg-white p-5 text-black shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <div className="inline-flex rounded-full bg-[#eef2eb] p-2 text-black"><ShieldCheck className="h-4 w-4" /></div>
          <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-black/65">Email Verified</h3>
          <strong className="mt-1 block text-3xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-black">{user.emailVerified ? "YES" : "NO"}</strong>
        </article>
        <article className="rounded-[28px] bg-white p-5 shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <div className="inline-flex rounded-full bg-[#E7F5EA] p-2 text-[#1E6A3F]"><ShieldCheck className="h-4 w-4" /></div>
          <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#1A2406]/55">2FA</h3>
          <strong className="mt-1 block text-3xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-[#1A2406]">{user.twoFactorEnabled ? "ON" : "OFF"}</strong>
        </article>
        <article className="rounded-[28px] bg-white p-5 text-black shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <div className="inline-flex rounded-full bg-[#eef2eb] p-2 text-black"><AlertTriangle className="h-4 w-4" /></div>
          <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-black/65">Created</h3>
          <strong className="mt-1 block text-lg font-medium tracking-[-0.03em] [font-family:var(--font-jakarta)] text-black">{fmt(user.createdAt)}</strong>
        </article>
      </div>

      <div className="overflow-hidden rounded-4xl bg-white shadow-[0_18px_38px_-14px_rgba(26,36,6,0.34)]">
        <div className="flex items-center justify-between border-b border-[#1A2406]/10 bg-[#F7F8F2] px-5 py-4">
          <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-[#1A2406]/65">User Metrics</h3>
        </div>
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

      <div className="overflow-hidden rounded-4xl bg-white shadow-[0_18px_38px_-14px_rgba(26,36,6,0.34)]">
        <div className="flex items-center justify-between border-b border-[#1A2406]/10 bg-[#F7F8F2] px-5 py-4">
          <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-[#1A2406]/65">Recent Purchases</h3>
        </div>
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
