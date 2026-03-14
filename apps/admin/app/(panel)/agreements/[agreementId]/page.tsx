"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { formatAmount, formatDate } from "@/app/lib/admin-api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:5000";

type AgreementDetails = {
  id: string;
  title: string;
  description?: string | null;
  amount: number;
  currency: string;
  status: string;
  projectId?: number | null;
  receiverAddress?: string | null;
  transactionHash?: string | null;
  createdAt: string;
  updatedAt: string;
  creator: { id: string; name: string; email: string };
  receiver: { id: string; name: string; email: string };
  milestones: Array<{
    id: string;
    title: string;
    description?: string | null;
    amount: number;
    status: string;
    dueDate?: string | null;
    createdAt: string;
  }>;
  tickets: Array<{
    id: string;
    title: string;
    status: string;
    severity: string;
    createdAt: string;
  }>;
};

const summarizeError = (error: unknown) => (error instanceof Error ? error.message : "Unexpected error");

export default function AgreementDetailsPage() {
  const params = useParams<{ agreementId: string }>();
  const agreementId = useMemo(() => params?.agreementId ?? "", [params]);

  const [agreement, setAgreement] = useState<AgreementDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgreement = useCallback(async () => {
    if (!agreementId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/admin/agreements/${agreementId}`, { cache: "no-store" });
      const payload = (await response.json()) as { error?: string; agreement?: AgreementDetails };

      if (!response.ok || !payload.agreement) {
        throw new Error(payload.error || "Failed to fetch agreement details");
      }

      setAgreement(payload.agreement);
    } catch (fetchError: unknown) {
      setError(summarizeError(fetchError));
    } finally {
      setLoading(false);
    }
  }, [agreementId]);

  useEffect(() => {
    fetchAgreement();
  }, [fetchAgreement]);

  if (loading) {
    return <section className="admin-page"><p>Loading agreement details...</p></section>;
  }

  if (!agreement) {
    return (
      <section className="admin-page">
        <p className="text-sm text-[#8f1f2f]">{error || "Agreement not found"}</p>
        <div className="mt-3">
          <Link href="/agreements" className="text-sm font-semibold text-[#1d4c35] hover:underline">
            Back to Agreements
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-page space-y-6">
      <header className="admin-page-header">
        <h2>{agreement.title}</h2>
        <p>Agreement ID: <span className="font-mono">{agreement.id}</span></p>
        <div className="mt-2">
          <Link href="/agreements" className="text-sm font-semibold text-[#1d4c35] hover:underline">
            Back to Agreements
          </Link>
        </div>
      </header>

      {error ? <p className="text-sm text-[#8f1f2f]">{error}</p> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-[#d9d0bf] bg-[#fffdf8] p-4">
          <h3 className="text-xs font-bold uppercase text-[#526157]">Status</h3>
          <p className="mt-2 text-sm font-semibold text-[#122016]">{agreement.status}</p>
        </article>
        <article className="rounded-xl border border-[#d9d0bf] bg-[#fffdf8] p-4">
          <h3 className="text-xs font-bold uppercase text-[#526157]">Escrow Amount</h3>
          <p className="mt-2 text-sm font-semibold text-[#122016]">{formatAmount(agreement.amount)} {agreement.currency}</p>
        </article>
        <article className="rounded-xl border border-[#d9d0bf] bg-[#fffdf8] p-4">
          <h3 className="text-xs font-bold uppercase text-[#526157]">Created</h3>
          <p className="mt-2 text-sm font-semibold text-[#122016]">{formatDate(agreement.createdAt)}</p>
        </article>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-[#d9d0bf] bg-[#fffcf6] p-4 text-[#122016]">
          <h3 className="text-xs font-bold uppercase text-[#526157]">Creator</h3>
          <p className="mt-2 text-sm font-semibold">{agreement.creator.name || "Anonymous"}</p>
          <p className="text-sm text-[#526157]">{agreement.creator.email}</p>
          <p className="mt-2 text-xs font-mono text-[#526157]">{agreement.creator.id}</p>
        </article>

        <article className="rounded-xl border border-[#d9d0bf] bg-[#fffcf6] p-4 text-[#122016]">
          <h3 className="text-xs font-bold uppercase text-[#526157]">Receiver</h3>
          <p className="mt-2 text-sm font-semibold">{agreement.receiver.name || "Anonymous"}</p>
          <p className="text-sm text-[#526157]">{agreement.receiver.email}</p>
          <p className="mt-2 text-xs font-mono text-[#526157]">{agreement.receiver.id}</p>
        </article>
      </div>

      {agreement.description ? (
        <article className="rounded-xl border border-[#d9d0bf] bg-white p-4 text-[#122016]">
          <h3 className="text-xs font-bold uppercase text-[#526157]">Description</h3>
          <p className="mt-2 text-sm">{agreement.description}</p>
        </article>
      ) : null}

      <article className="rounded-xl border border-[#d9d0bf] bg-[#f9fdf3] p-4 text-[#122016]">
        <h3 className="text-xs font-bold uppercase text-[#526157]">Protocol Details</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-[#d9d0bf] bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-[#526157]">Project ID</p>
            <p className="mt-1 text-sm font-mono">{agreement.projectId ?? "-"}</p>
          </div>
          <div className="rounded-lg border border-[#d9d0bf] bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-[#526157]">Receiver Address</p>
            <p className="mt-1 text-xs font-mono break-all">{agreement.receiverAddress ?? "-"}</p>
          </div>
          <div className="rounded-lg border border-[#d9d0bf] bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-[#526157]">Transaction Hash</p>
            <p className="mt-1 text-xs font-mono break-all">{agreement.transactionHash ?? "-"}</p>
          </div>
        </div>
      </article>

      <article className="rounded-xl border border-[#d9d0bf] bg-white p-4 text-[#122016]">
        <h3 className="text-xs font-bold uppercase text-[#526157] mb-3">Milestones ({agreement.milestones.length})</h3>
        {agreement.milestones.length === 0 ? (
          <p className="text-sm text-[#526157]">No milestones defined.</p>
        ) : (
          <div className="space-y-2">
            {agreement.milestones.map((milestone, index) => (
              <div key={milestone.id} className="rounded-md border border-[#ece6d9] bg-[#fcfbf8] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#122016]">{index + 1}. {milestone.title}</p>
                  <span className="text-xs font-semibold text-[#1f6a42]">{formatAmount(milestone.amount)} {agreement.currency}</span>
                </div>
                {milestone.description ? <p className="mt-1 text-xs text-[#526157]">{milestone.description}</p> : null}
                <p className="mt-1 text-xs text-[#526157]">Status: {milestone.status}</p>
                <p className="mt-1 text-xs text-[#526157]">Due: {milestone.dueDate ? formatDate(milestone.dueDate) : "-"}</p>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="rounded-xl border border-[#d9d0bf] bg-white p-4 text-[#122016]">
        <h3 className="text-xs font-bold uppercase text-[#526157] mb-3">Linked Tickets ({agreement.tickets.length})</h3>
        {agreement.tickets.length === 0 ? (
          <p className="text-sm text-[#526157]">No tickets linked to this agreement.</p>
        ) : (
          <div className="space-y-2">
            {agreement.tickets.map((ticket) => (
              <div key={ticket.id} className="flex items-center justify-between rounded-md border border-[#ece6d9] bg-[#fcfbf8] px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-[#122016]">{ticket.title}</p>
                  <p className="text-[10px] font-mono text-[#526157]">{ticket.id}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-[#122016]">{ticket.status}</p>
                  <p className="text-[10px] text-[#526157]">{ticket.severity}</p>
                  <p className="text-[10px] text-[#526157]">{formatDate(ticket.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
