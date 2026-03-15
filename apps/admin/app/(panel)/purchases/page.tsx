"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatAmount, formatDate } from "@/app/lib/admin-api";

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
        .filter((purchase) => ["SUCCESS", "COMPLETED", "PAYMENT_VERIFIED"].includes(purchase.status))
        .reduce((sum, purchase) => sum + purchase.amount, 0),
    [purchases],
  );

  return (
    <section className="admin-page">
      <header className="admin-page-header">
        <h2>Payments</h2>
        <p>Inspect all Razorpay purchase records and open complete details on dedicated pages.</p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <article className="rounded-2xl border border-[#d9d0bf] bg-[#fffdf8] p-4">
          <h3 className="text-sm text-[#516157]">Total Purchases</h3>
          <strong className="text-2xl text-[#122016]">{purchases.length}</strong>
        </article>
        <article className="rounded-2xl border border-[#d9d0bf] bg-[#fffdf8] p-4">
          <h3 className="text-sm text-[#516157]">Successful</h3>
          <strong className="text-2xl text-[#122016]">
            {purchases.filter((item) => ["SUCCESS", "COMPLETED", "PAYMENT_VERIFIED"].includes(item.status)).length}
          </strong>
        </article>
        <article className="rounded-2xl border border-[#d9d0bf] bg-[#fffdf8] p-4">
          <h3 className="text-sm text-[#516157]">Revenue</h3>
          <strong className="text-2xl text-[#122016]">{formatAmount(totalRevenue)}</strong>
        </article>
      </div>

      {error ? <p className="text-sm text-[#8f1f2f]">{error}</p> : null}

      <div className="table-wrap">
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
                <td colSpan={6}>Loading purchases...</td>
              </tr>
            ) : purchases.length === 0 ? (
              <tr>
                <td colSpan={6}>No purchases found.</td>
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
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        ["SUCCESS", "COMPLETED", "PAYMENT_VERIFIED"].includes(purchase.status)
                          ? "bg-[#dff4e6] text-[#1f6a42] border-[#d9d0bf]"
                          : "bg-[#fde8c8] text-[#7b4c00] border-[#d9d0bf]"
                      }`}
                    >
                      {purchase.status}
                    </span>
                  </td>
                  <td>
                    <Link href={`/purchases/${purchase.id}`} className="font-semibold text-[#1d4c35] hover:underline">
                      {purchase.razorpayOrderId}
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
