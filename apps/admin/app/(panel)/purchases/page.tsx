"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatAmount, formatDate } from "@/app/lib/admin-api";
import { BadgeCheck, ChevronRight, CircleDollarSign, ReceiptText, Wallet } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:5000";

interface PurchaseRow {
  id: string;
  amount: number;
  status: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

interface PurchasesResponse {
  count: number;
  purchases: PurchaseRow[];
}

const summarizeError = (error: unknown) => (error instanceof Error ? error.message : "Unexpected error");

const isSuccessStatus = (status: string) => ["SUCCESS", "COMPLETED", "PAYMENT_VERIFIED"].includes(status.toUpperCase());

const statusBadgeClass = (status: string) =>
  isSuccessStatus(status)
    ? "border-[#cae4d0] bg-[#e7f5ea] text-[#1e6a3f]"
    : "border-[#ebdfbd] bg-[#f9f3df] text-[#7a5c1f]";

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPurchases = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`${API_BASE_URL}/admin/purchases?limit=200`, { cache: "no-store" });
        const payload = (await response.json()) as PurchasesResponse | { error?: string };

        if (!response.ok || !("purchases" in payload)) {
          throw new Error(("error" in payload && payload.error) || "Failed to fetch purchases");
        }

        setPurchases(payload.purchases);
      } catch (fetchError: unknown) {
        setError(summarizeError(fetchError));
      } finally {
        setIsLoading(false);
      }
    };

    loadPurchases();
  }, []);

  const totalRevenue = useMemo(
    () =>
      purchases
        .filter((purchase) => isSuccessStatus(purchase.status))
        .reduce((sum, purchase) => sum + purchase.amount, 0),
    [purchases],
  );

  const successCount = useMemo(() => purchases.filter((item) => isSuccessStatus(item.status)).length, [purchases]);

  return (
    <section className="admin-page space-y-6">
      <header className="rounded-[40px] border border-[#d9dfcf] bg-transparent px-6 py-8 text-[#121212]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-black/60">Payment Ledger</p>
            <h2 className="mt-2 text-4xl md:text-5xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-black">Purchase Oversight</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/75">Track every Razorpay transaction through a high-contrast, audit-friendly control surface.</p>
          </div>

          <div className="rounded-full border border-black/20 bg-transparent px-5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/60">Conversion</p>
            <p className="mt-1 text-sm font-semibold text-black">{successCount} successful payments</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[28px] bg-white p-5 shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <div className="inline-flex rounded-full bg-[#E8F1FF] p-2 text-[#3D5B77]">
            <ReceiptText className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#1A2406]/55">Total Purchases</h3>
          <strong className="mt-1 block text-3xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-[#1A2406]">{purchases.length}</strong>
        </article>

        <article className="rounded-[28px] bg-white p-5 text-black shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <div className="inline-flex rounded-full bg-[#eef2eb] p-2 text-black">
            <BadgeCheck className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-black/65">Successful</h3>
          <strong className="mt-1 block text-3xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-black">{successCount}</strong>
        </article>

        <article className="rounded-[28px] bg-white p-5 shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <div className="inline-flex rounded-full bg-[#E8F1FF] p-2 text-[#2F5B83]">
            <Wallet className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#1A2406]/55">Revenue</h3>
          <strong className="mt-1 block text-3xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-[#1A2406]">{formatAmount(totalRevenue)}</strong>
        </article>

        <article className="rounded-[28px] bg-white p-5 text-black shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <div className="inline-flex rounded-full bg-[#eef2eb] p-2 text-black">
            <CircleDollarSign className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-black/65">Pending/Other</h3>
          <strong className="mt-1 block text-3xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-black">{purchases.length - successCount}</strong>
        </article>
      </div>

      {error ? (
        <p className="rounded-xl border border-[#eccbcb] bg-[#fae8e8] px-4 py-3 text-sm font-semibold text-[#8f1f2f]">{error}</p>
      ) : null}

      <div className="overflow-hidden rounded-4xl bg-white shadow-[0_18px_38px_-14px_rgba(26,36,6,0.34)]">
        <div className="flex items-center justify-between border-b border-[#1A2406]/10 bg-[#F7F8F2] px-5 py-4">
          <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-[#1A2406]/65">Razorpay Purchase Records</h3>
          <p className="text-xs text-[#1A2406]/50">Open order for details</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Order ID</th>
              <th>Payment ID</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center text-[#607062]">Loading purchases...</td>
              </tr>
            ) : purchases.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#607062]">No purchases found.</td>
              </tr>
            ) : (
              purchases.map((purchase) => (
                <tr key={purchase.id}>
                  <td>
                    <div className="flex flex-col">
                      <span className="font-medium">{purchase.user.name || "Anonymous"}</span>
                      <span className="text-[10px] text-[#526157]">{purchase.user.email}</span>
                    </div>
                  </td>
                  <td>₹{formatAmount(purchase.amount)}</td>
                  <td>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] ${statusBadgeClass(purchase.status)}`}>
                      {purchase.status}
                    </span>
                  </td>
                  <td>
                    <Link href={`/purchases/${purchase.id}`} className="group inline-flex items-center gap-1.5 font-semibold text-[#1A2406]">
                      <span className="group-hover:underline">{purchase.razorpayOrderId}</span>
                      <ChevronRight className="h-3.5 w-3.5 opacity-45 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                    </Link>
                  </td>
                  <td>{purchase.razorpayPaymentId ?? "-"}</td>
                  <td>{formatDate(purchase.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
