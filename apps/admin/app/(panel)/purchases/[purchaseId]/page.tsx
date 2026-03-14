"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { formatAmount, formatDate } from "@/app/lib/admin-api";

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
    return <section className="admin-page"><p>Loading purchase details...</p></section>;
  }

  if (!purchase) {
    return (
      <section className="admin-page">
        <p className="text-sm text-[#8f1f2f]">{error || "Purchase not found"}</p>
        <div className="mt-3">
          <Link href="/purchases" className="text-sm font-semibold text-[#1d4c35] hover:underline">
            Back to Purchases
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-page space-y-6">
      <header className="admin-page-header">
        <h2>Purchase Details</h2>
        <p>Order: <span className="font-mono">{purchase.razorpayOrderId}</span></p>
        <div className="mt-2">
          <Link href="/purchases" className="text-sm font-semibold text-[#1d4c35] hover:underline">
            Back to Purchases
          </Link>
        </div>
      </header>

      {error ? <p className="text-sm text-[#8f1f2f]">{error}</p> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-[#d9d0bf] bg-[#fffdf8] p-4">
          <h3 className="text-xs font-bold uppercase text-[#526157]">Amount</h3>
          <p className="mt-2 text-sm font-semibold text-[#122016]">₹{formatAmount(purchase.amount)}</p>
        </article>
        <article className="rounded-xl border border-[#d9d0bf] bg-[#fffdf8] p-4">
          <h3 className="text-xs font-bold uppercase text-[#526157]">Status</h3>
          <p className="mt-2 text-sm font-semibold text-[#122016]">{purchase.status}</p>
        </article>
        <article className="rounded-xl border border-[#d9d0bf] bg-[#fffdf8] p-4">
          <h3 className="text-xs font-bold uppercase text-[#526157]">Created</h3>
          <p className="mt-2 text-sm font-semibold text-[#122016]">{formatDate(purchase.createdAt)}</p>
        </article>
      </div>

      <article className="rounded-xl border border-[#d9d0bf] bg-[#fdfaf3] p-4 text-[#122016]">
        <h3 className="text-xs font-bold uppercase text-[#526157] mb-3">Razorpay Integration</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-[#d9d0bf] bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-[#526157]">Order ID</p>
            <p className="mt-1 text-xs font-mono break-all">{purchase.razorpayOrderId}</p>
          </div>
          <div className="rounded-lg border border-[#d9d0bf] bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-[#526157]">Payment ID</p>
            <p className="mt-1 text-xs font-mono break-all">{purchase.razorpayPaymentId ?? "N/A"}</p>
          </div>
        </div>
      </article>

      <article className="rounded-xl border border-[#d9d0bf] bg-[#fffbf6] p-4 text-[#122016]">
        <h3 className="text-xs font-bold uppercase text-[#526157] mb-3">Purchaser</h3>
        <p className="text-sm font-semibold">{purchase.user.name || "Anonymous User"}</p>
        <p className="text-sm text-[#526157]">{purchase.user.email}</p>
        <p className="mt-2 text-xs font-mono text-[#526157]">UID: {purchase.user.id}</p>
        <p className="mt-1 text-xs text-[#526157]">Joined: {formatDate(purchase.user.createdAt)}</p>
      </article>

      <article className="rounded-xl border border-dashed border-[#d9d0bf] bg-[#fafcf7] p-3 text-center">
        <p className="text-xs text-[#526157] italic">This transaction was processed via Razorpay and logged in the purchase ledger.</p>
      </article>
    </section>
  );
}
