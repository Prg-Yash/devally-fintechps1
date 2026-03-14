"use client";

import { useEffect, useMemo, useState } from "react";
import AdminInfoModal from "@/app/components/admin-info-modal";
import { formatAmount, formatDate } from "@/app/lib/admin-api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:5000";

interface PurchaseRow {
  id: string;
  amount: number;
  status: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  createdAt: string;
  user: { email: string };
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
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseRow | null>(null);

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
    () => purchases.filter((purchase) => purchase.status === "SUCCESS").reduce((sum, purchase) => sum + purchase.amount, 0),
    [purchases],
  );

  return (
    <section className="admin-page">
      <header className="admin-page-header">
        <h2>Payments</h2>
        <p>Inspect all Razorpay purchase records and payment states. Click order ID to open complete info.</p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <article className="rounded-2xl border border-[#d9d0bf] bg-[#fffdf8] p-4">
          <h3 className="text-sm text-[#516157]">Total Purchases</h3>
          <strong className="text-2xl text-[#122016]">{purchases.length}</strong>
        </article>
        <article className="rounded-2xl border border-[#d9d0bf] bg-[#fffdf8] p-4">
          <h3 className="text-sm text-[#516157]">Successful</h3>
          <strong className="text-2xl text-[#122016]">{purchases.filter((item) => item.status === "SUCCESS").length}</strong>
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
                  <td>{purchase.user.email}</td>
                  <td>{formatAmount(purchase.amount)}</td>
                  <td>{purchase.status}</td>
                  <td>
                    <button
                      type="button"
                      className="border-0 bg-transparent p-0 font-semibold text-[#1d4c35] hover:underline"
                      onClick={() => setSelectedPurchase(purchase)}
                    >
                      {purchase.razorpayOrderId}
                    </button>
                  </td>
                  <td>{purchase.razorpayPaymentId ?? "-"}</td>
                  <td>{formatDate(purchase.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminInfoModal
        open={Boolean(selectedPurchase)}
        title={selectedPurchase ? `Purchase: ${selectedPurchase.razorpayOrderId}` : "Purchase"}
        onClose={() => setSelectedPurchase(null)}
      >
        {selectedPurchase ? (
          <>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <p><strong>ID:</strong> {selectedPurchase.id}</p>
              <p><strong>Status:</strong> {selectedPurchase.status}</p>
              <p><strong>User:</strong> {selectedPurchase.user.email}</p>
              <p><strong>Amount:</strong> {formatAmount(selectedPurchase.amount)}</p>
              <p><strong>Order ID:</strong> {selectedPurchase.razorpayOrderId}</p>
              <p><strong>Payment ID:</strong> {selectedPurchase.razorpayPaymentId ?? "N/A"}</p>
              <p><strong>Created:</strong> {formatDate(selectedPurchase.createdAt)}</p>
            </div>

            <details className="rounded-xl border border-dashed border-[#d9d0bf] bg-[#fcfaf5] p-3">
              <summary className="cursor-pointer font-semibold">Raw Complete Data</summary>
              <pre className="mt-3 max-h-[340px] overflow-auto whitespace-pre-wrap break-words text-xs">
                {JSON.stringify(selectedPurchase, null, 2)}
              </pre>
            </details>
          </>
        ) : null}
      </AdminInfoModal>
    </section>
  );
}
