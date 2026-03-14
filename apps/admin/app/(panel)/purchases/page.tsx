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
                  <td>
                    <div className="flex flex-col">
                      <span className="font-medium">{purchase.user.name || 'Anonymous'}</span>
                      <span className="text-[10px] text-[#526157]">{purchase.user.email}</span>
                    </div>
                  </td>
                  <td>₹{formatAmount(purchase.amount)}</td>
                  <td>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                      purchase.status === 'SUCCESS' ? 'bg-[#dff4e6] text-[#1f6a42] border-[#d9d0bf]' : 'bg-[#fde8c8] text-[#7b4c00] border-[#d9d0bf]'
                    }`}>
                      {purchase.status}
                    </span>
                  </td>
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
        title={selectedPurchase ? `Order: ${selectedPurchase.razorpayOrderId}` : "Purchase Details"}
        onClose={() => setSelectedPurchase(null)}
      >
        {selectedPurchase ? (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-[#d9d0bf] bg-[#fdfaf3] p-4 text-[#122016]">
                <h4 className="text-xs font-bold uppercase text-[#526157] mb-3">Transaction Info</h4>
                <div className="space-y-2 text-sm">
                  <p><strong className="text-[#122016]">System ID:</strong> <span className="text-[#526157] font-mono">{selectedPurchase.id}</span></p>
                  <p><strong>Status:</strong> 
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      selectedPurchase.status === 'SUCCESS' ? 'bg-[#dff4e6] text-[#1f6a42]' : 
                      selectedPurchase.status === 'PENDING' ? 'bg-[#fde8c8] text-[#7b4c00]' : 
                      'bg-[#fde2e2] text-[#8f1f2f]'
                    }`}>
                      {selectedPurchase.status}
                    </span>
                  </p>
                  <p><strong>Amount:</strong> <span className="font-bold text-[#122016]">₹{formatAmount(selectedPurchase.amount)}</span></p>
                  <p><strong>Date:</strong> {formatDate(selectedPurchase.createdAt)}</p>
                </div>
              </div>

              <div className="rounded-xl border border-[#d9d0bf] bg-[#fffbf6] p-4 text-[#122016]">
                <h4 className="text-xs font-bold uppercase text-[#526157] mb-3">Purchaser Details</h4>
                <div className="space-y-1">
                  <p className="text-sm font-medium">{selectedPurchase.user.name || 'Anonymous User'}</p>
                  <p className="text-xs text-[#526157]">{selectedPurchase.user.email}</p>
                  <p className="text-[10px] text-[#526157] font-mono mt-2">UID: {selectedPurchase.user.id}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#d9d0bf] bg-white p-4 text-[#122016]">
              <h4 className="text-xs font-bold uppercase text-[#526157] mb-3">Razorpay Integration</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-[#ece6d9] bg-[#fafaf8]">
                  <p className="text-[10px] font-bold text-[#526157] uppercase">Razorpay Order ID</p>
                  <p className="text-xs font-mono break-all">{selectedPurchase.razorpayOrderId}</p>
                </div>
                <div className="p-3 rounded-lg border border-[#ece6d9] bg-[#fafaf8]">
                  <p className="text-[10px] font-bold text-[#526157] uppercase">Razorpay Payment ID</p>
                  <p className="text-xs font-mono break-all">{selectedPurchase.razorpayPaymentId || "N/A"}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-[#d9d0bf] bg-[#fafcf7] p-3 text-center">
               <p className="text-xs text-[#526157] italic">This transaction was processed securely via Razorpay gateway.</p>
            </div>
          </div>
        ) : null}
      </AdminInfoModal>
    </section>
  );
}
