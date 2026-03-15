"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { formatAmount, formatDate } from "@/app/lib/admin-api";
import { ArrowLeft, BadgeCheck, Clock3, ReceiptText, ShieldCheck, UserCircle } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:5000";

type PurchaseDetails = {
  id: string;
  amount: number;
  status: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
  };
};

const summarizeError = (error: unknown) => (error instanceof Error ? error.message : "Unexpected error");

const statusBadgeClass = (status: string) =>
  ["SUCCESS", "COMPLETED", "PAYMENT_VERIFIED"].includes(status.toUpperCase())
    ? "border-[#cae4d0] bg-[#e7f5ea] text-[#1e6a3f]"
    : "border-[#ebdfbd] bg-[#f9f3df] text-[#7a5c1f]";

export default function PurchaseDetailsPage() {
  const params = useParams<{ purchaseId: string }>();
  const purchaseId = useMemo(() => params?.purchaseId ?? "", [params]);

  const [purchase, setPurchase] = useState<PurchaseDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPurchase = useCallback(async () => {
    if (!purchaseId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/admin/purchases/${purchaseId}`, { cache: "no-store" });
      const payload = (await response.json()) as { error?: string; purchase?: PurchaseDetails };

      if (!response.ok || !payload.purchase) {
        throw new Error(payload.error || "Failed to fetch purchase details");
      }

      setPurchase(payload.purchase);
    } catch (fetchError: unknown) {
      setError(summarizeError(fetchError));
    } finally {
      setLoading(false);
    }
  }, [purchaseId]);

  useEffect(() => {
    fetchPurchase();
  }, [fetchPurchase]);

  if (loading) {
    return (
      <section className="admin-page">
        <div className="rounded-2xl border border-[#d8e1d4] bg-white px-5 py-8 text-center text-sm font-medium text-[#54665a]">
          Loading purchase details...
        </div>
      </section>
    );
  }

  if (!purchase) {
    return (
      <section className="admin-page">
        <p className="rounded-xl border border-[#eccbcb] bg-[#fae8e8] px-4 py-3 text-sm font-semibold text-[#8f1f2f]">
          {error || "Purchase not found"}
        </p>
        <div className="mt-3">
          <Link href="/purchases" className="text-sm font-semibold text-[#1d4c35] hover:underline">
            Back to Purchases
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-page space-y-7">
      <header className="rounded-[40px] border border-[#d9dfcf] bg-transparent px-6 py-8 text-[#121212]">
        <div className="flex flex-col gap-3">
          <Link href="/purchases" className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-black/60 hover:text-black">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Purchases
          </Link>

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-4xl md:text-5xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-black">Purchase Details</h2>
              <p className="mt-2 text-xs text-black/70">Order: <span className="font-mono">{purchase.razorpayOrderId}</span></p>
            </div>
            <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${statusBadgeClass(purchase.status)}`}>
              {purchase.status}
            </span>
          </div>
        </div>
      </header>

      {error ? (
        <p className="rounded-xl border border-[#eccbcb] bg-[#fae8e8] px-4 py-3 text-sm font-semibold text-[#8f1f2f]">{error}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[28px] bg-white p-5 shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <div className="inline-flex rounded-full bg-[#E8F1FF] p-2 text-[#3D5B77]">
            <ReceiptText className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#1A2406]/55">Amount</h3>
          <p className="mt-1 text-3xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-[#1A2406]">₹{formatAmount(purchase.amount)}</p>
        </article>

        <article className="rounded-[28px] bg-white p-5 text-black shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <div className="inline-flex rounded-full bg-[#eef2eb] p-2 text-black">
            <BadgeCheck className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-black/65">Status</h3>
          <p className="mt-1 text-3xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-black">{purchase.status}</p>
        </article>

        <article className="rounded-[28px] bg-white p-5 shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <div className="inline-flex rounded-full bg-[#EEF2EB] p-2 text-[#4A5D50]">
            <Clock3 className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#1A2406]/55">Created</h3>
          <p className="mt-1 text-lg font-medium tracking-[-0.03em] [font-family:var(--font-jakarta)] text-[#1A2406]">{formatDate(purchase.createdAt)}</p>
        </article>

        <article className="rounded-[28px] bg-white p-5 text-black shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <div className="inline-flex rounded-full bg-[#eef2eb] p-2 text-black">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-black/65">Updated</h3>
          <p className="mt-1 text-lg font-medium tracking-[-0.03em] [font-family:var(--font-jakarta)] text-black">{formatDate(purchase.updatedAt)}</p>
        </article>
      </div>

      <article className="rounded-4xl bg-[#F7F8F2] p-5 text-[#122016] shadow-[0_18px_38px_-14px_rgba(26,36,6,0.34)]">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-[#526157]">Razorpay Integration</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-[#526157]">Order ID</p>
            <p className="mt-1 text-xs font-mono break-all">{purchase.razorpayOrderId}</p>
          </div>
          <div className="rounded-2xl bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-[#526157]">Payment ID</p>
            <p className="mt-1 text-xs font-mono break-all">{purchase.razorpayPaymentId ?? "N/A"}</p>
          </div>
        </div>
      </article>

      <article className="rounded-[28px] bg-white p-5 text-[#122016] shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
        <h3 className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#526157]">
          <UserCircle className="h-3.5 w-3.5" />
          Purchaser
        </h3>
        <p className="text-sm font-semibold">{purchase.user.name || "Anonymous User"}</p>
        <p className="text-sm text-[#526157]">{purchase.user.email}</p>
        <p className="mt-2 text-xs font-mono text-[#526157]">UID: {purchase.user.id}</p>
        <p className="mt-1 text-xs text-[#526157]">Joined: {formatDate(purchase.user.createdAt)}</p>
      </article>

      <article className="rounded-xl border border-dashed border-[#d8e1d4] bg-[#f9fcf7] p-3 text-center">
        <p className="text-xs text-[#526157] italic">This transaction was processed via Razorpay and logged in the purchase ledger.</p>
      </article>
    </section>
  );
}
