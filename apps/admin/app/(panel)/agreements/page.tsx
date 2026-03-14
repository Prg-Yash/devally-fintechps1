"use client";

import { useEffect, useMemo, useState } from "react";
import AdminInfoModal from "@/app/components/admin-info-modal";
import { formatAmount, formatDate } from "@/app/lib/admin-api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:5000";

interface AgreementRow {
  id: string;
  title: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  creator: { name: string; email: string };
  receiver: { name: string; email: string };
  milestones: Array<{ id: string }>;
  _count: { tickets: number };
}

interface AgreementsResponse {
  count: number;
  agreements: AgreementRow[];
}

const summarizeError = (error: unknown) => (error instanceof Error ? error.message : "Unexpected error");

export default function AgreementsPage() {
  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgreement, setSelectedAgreement] = useState<AgreementRow | null>(null);

  useEffect(() => {
    const loadAgreements = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`${API_BASE_URL}/admin/agreements?limit=200`, { cache: "no-store" });
        const payload = (await response.json()) as AgreementsResponse | { error?: string };

        if (!response.ok || !("agreements" in payload)) {
          throw new Error(("error" in payload && payload.error) || "Failed to fetch agreements");
        }

        setAgreements(payload.agreements);
      } catch (fetchError: unknown) {
        setError(summarizeError(fetchError));
      } finally {
        setIsLoading(false);
      }
    };

    loadAgreements();
  }, []);

  const totalAgreementAmount = useMemo(
    () => agreements.reduce((sum, agreement) => sum + agreement.amount, 0),
    [agreements],
  );

  return (
    <section className="admin-page">
      <header className="admin-page-header">
        <h2>Agreement Oversight</h2>
        <p>Track all escrow agreements, participants, and dispute linkage. Click any title to open full info.</p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <article className="rounded-2xl border border-[#d9d0bf] bg-[#fffdf8] p-4">
          <h3 className="text-sm text-[#516157]">Total Agreements</h3>
          <strong className="text-2xl text-[#122016]">{agreements.length}</strong>
        </article>
        <article className="rounded-2xl border border-[#d9d0bf] bg-[#fffdf8] p-4">
          <h3 className="text-sm text-[#516157]">Total Escrow Value</h3>
          <strong className="text-2xl text-[#122016]">{formatAmount(totalAgreementAmount)}</strong>
        </article>
        <article className="rounded-2xl border border-[#d9d0bf] bg-[#fffdf8] p-4">
          <h3 className="text-sm text-[#516157]">Disputed Agreements</h3>
          <strong className="text-2xl text-[#122016]">{agreements.filter((item) => item._count.tickets > 0).length}</strong>
        </article>
      </div>

      {error ? <p className="text-sm text-[#8f1f2f]">{error}</p> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Creator</th>
              <th>Receiver</th>
              <th>Milestones</th>
              <th>Tickets</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8}>Loading agreements...</td>
              </tr>
            ) : agreements.length === 0 ? (
              <tr>
                <td colSpan={8}>No agreements found.</td>
              </tr>
            ) : (
              agreements.map((agreement) => (
                <tr key={agreement.id}>
                  <td>
                    <button
                      type="button"
                      className="border-0 bg-transparent p-0 font-semibold text-[#1d4c35] hover:underline"
                      onClick={() => setSelectedAgreement(agreement)}
                    >
                      {agreement.title}
                    </button>
                  </td>
                  <td>{agreement.status}</td>
                  <td>
                    {formatAmount(agreement.amount)} {agreement.currency}
                  </td>
                  <td>{agreement.creator.email}</td>
                  <td>{agreement.receiver.email}</td>
                  <td>{agreement.milestones.length}</td>
                  <td>{agreement._count.tickets}</td>
                  <td>{formatDate(agreement.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminInfoModal
        open={Boolean(selectedAgreement)}
        title={selectedAgreement ? `Agreement: ${selectedAgreement.title}` : "Agreement"}
        onClose={() => setSelectedAgreement(null)}
      >
        {selectedAgreement ? (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-[#d9d0bf] bg-[#fdfaf3] p-4 text-[#122016]">
                <h4 className="text-xs font-bold uppercase text-[#526157] mb-3">Core Information</h4>
                <div className="space-y-2 text-sm">
                  <p><strong className="text-[#122016]">ID:</strong> <span className="text-[#526157] font-mono">{selectedAgreement.id}</span></p>
                  <p><strong>Title:</strong> {selectedAgreement.title}</p>
                  <p><strong>Status:</strong> <span className="px-2 py-0.5 rounded-full bg-[#dff4e6] text-[#1f6a42] text-[10px] font-bold uppercase">{selectedAgreement.status}</span></p>
                  <p><strong>Amount:</strong> <span className="font-bold text-[#122016]">{formatAmount(selectedAgreement.amount)} {selectedAgreement.currency}</span></p>
                  <p><strong>Created:</strong> {formatDate(selectedAgreement.createdAt)}</p>
                </div>
              </div>

              <div className="rounded-xl border border-[#d9d0bf] bg-[#fffcf6] p-4 text-[#122016]">
                <h4 className="text-xs font-bold uppercase text-[#526157] mb-3">Participants</h4>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-bold text-[#7b4c00] uppercase">Creator</p>
                    <p className="text-sm font-medium">{selectedAgreement.creator.name}</p>
                    <p className="text-xs text-[#526157]">{selectedAgreement.creator.email}</p>
                  </div>
                  <div className="pt-2 border-t border-[#ece6d9]">
                    <p className="text-[10px] font-bold text-[#1f6a42] uppercase">Recipient</p>
                    <p className="text-sm font-medium">{selectedAgreement.receiver.name}</p>
                    <p className="text-xs text-[#526157]">{selectedAgreement.receiver.email}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#d9d0bf] bg-[#fff] p-4 text-[#122016]">
              <h4 className="text-xs font-bold uppercase text-[#526157] mb-4">Milestones & Deliverables ({selectedAgreement.milestones.length})</h4>
              {selectedAgreement.milestones.length === 0 ? (
                <p className="text-sm text-[#526157]">No milestones defined for this agreement.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#d9d0bf] text-[#526157]">
                      <th className="pb-2 font-bold uppercase text-[10px]">Title</th>
                      <th className="pb-2 font-bold uppercase text-[10px]">Amount</th>
                      <th className="pb-2 font-bold uppercase text-[10px]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAgreement.milestones.map((m: any, idx: number) => (
                      <tr key={m.id} className="border-b border-[#ece6d9] last:border-0">
                        <td className="py-2.5">
                          <p className="font-medium text-[#122016]">{m.title || `Milestone ${idx+1}`}</p>
                          <p className="text-[10px] text-[#526157] font-mono">{m.id}</p>
                        </td>
                        <td className="py-2.5 font-mono text-[#122016]">₹{m.amount}</td>
                        <td className="py-2.5">
                          <span className="px-2 py-0.5 rounded-full bg-[#f4f8eb] text-[#526157] text-[10px] font-medium uppercase border border-[#d9d0bf]">
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="rounded-xl border border-dashed border-[#d9d0bf] bg-[#fafcf7] p-4 flex items-center justify-between text-[#122016]">
              <div>
                <h4 className="text-xs font-bold uppercase text-[#526157]">Related Statistics</h4>
                <p className="text-sm mt-1">Total Dispute Tickets Raised: <span className="font-bold text-[#8f1f2f]">{selectedAgreement._count.tickets}</span></p>
              </div>
              <div className="text-right">
                 <p className="text-[10px] text-[#526157] uppercase font-bold">Base Currency</p>
                 <p className="text-sm font-bold uppercase">{selectedAgreement.currency}</p>
              </div>
            </div>
          </div>
        ) : null}
      </AdminInfoModal>
    </section>
  );
}
