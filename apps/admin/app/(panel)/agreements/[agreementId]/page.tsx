"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { formatAmount, formatDate } from "@/app/lib/admin-api";
import { ArrowLeft, ArrowUpRight, CheckCircle2, Clock3, FileStack, ShieldAlert, ShieldCheck, ChevronRight } from "lucide-react";

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

const positiveStatuses = new Set(["COMPLETED", "PAID", "SUCCESS", "SETTLED"]);
const activeStatuses = new Set(["PENDING", "ACTIVE", "IN_REVIEW", "OPEN"]);

const statusBadgeClass = (status: string) => {
  const normalized = status.toUpperCase();
  if (positiveStatuses.has(normalized)) {
    return "border-[#cae4d0] bg-[#e7f5ea] text-[#1e6a3f]";
  }
  if (activeStatuses.has(normalized)) {
    return "border-[#ebdfbd] bg-[#f9f3df] text-[#7a5c1f]";
  }
  if (normalized.includes("REJECT") || normalized.includes("FAIL") || normalized.includes("CANCEL")) {
    return "border-[#ebc9cf] bg-[#f9e6e9] text-[#8b2937]";
  }
  return "border-[#d8dfd3] bg-[#eef2eb] text-[#4f6055]";
};

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
    return (
      <section className="admin-page">
        <div className="rounded-2xl border border-[#d8e1d4] bg-white px-5 py-8 text-center text-sm font-medium text-[#54665a]">
          Loading agreement details...
        </div>
      </section>
    );
  }

  if (!agreement) {
    return (
      <section className="admin-page">
        <p className="rounded-xl border border-[#eccbcb] bg-[#fae8e8] px-4 py-3 text-sm font-semibold text-[#8f1f2f]">
          {error || "Agreement not found"}
        </p>
        <div className="mt-3">
          <Link href="/agreements" className="text-sm font-semibold text-[#1d4c35] hover:underline">
            Back to Agreements
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-page space-y-7">
      <header className="rounded-[40px] border border-[#d9dfcf] bg-transparent px-6 py-8 text-[#121212]">
        <div className="flex flex-col gap-3">
          <Link href="/agreements" className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-black/60 hover:text-black">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Agreements
          </Link>

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-4xl md:text-5xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-black">{agreement.title}</h2>
              <p className="mt-2 text-xs text-black/70">
                Agreement ID: <span className="font-mono">{agreement.id}</span>
              </p>
            </div>
            <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${statusBadgeClass(agreement.status)}`}>
              {agreement.status}
            </span>
          </div>
        </div>
      </header>

      {error ? (
        <p className="rounded-xl border border-[#eccbcb] bg-[#fae8e8] px-4 py-3 text-sm font-semibold text-[#8f1f2f]">{error}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[28px] bg-white p-5 shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <div className="inline-flex rounded-full bg-[#D9F24F]/35 p-2 text-[#1A2406]">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#1A2406]/55">Status</h3>
          <p className="mt-1 text-2xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-[#1A2406]">{agreement.status}</p>
        </article>

        <article className="rounded-[28px] bg-white p-5 shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <div className="inline-flex rounded-full bg-[#E8F1FF] p-2 text-[#2F5B83]">
            <FileStack className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#1A2406]/55">Escrow Amount</h3>
          <p className="mt-1 text-2xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-[#1A2406]">{formatAmount(agreement.amount)}</p>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#1A2406]/55">{agreement.currency}</p>
        </article>

        <article className="rounded-[28px] bg-white p-5 text-black shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <div className="inline-flex rounded-full bg-[#eef2eb] p-2 text-black">
            <Clock3 className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-black/65">Created</h3>
          <p className="mt-1 text-lg font-medium tracking-[-0.03em] [font-family:var(--font-jakarta)] text-black">{formatDate(agreement.createdAt)}</p>
        </article>

        <article className="rounded-[28px] bg-white p-5 text-black shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <div className="inline-flex rounded-full bg-[#eef2eb] p-2 text-black">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-black/65">Linked Tickets</h3>
          <p className="mt-1 text-3xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-black">{agreement.tickets.length}</p>
        </article>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <article className="rounded-[28px] bg-white p-5 text-[#122016] shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#526157]">Creator</h3>
          <p className="mt-2 text-sm font-semibold">{agreement.creator.name || "Anonymous"}</p>
          <p className="text-sm text-[#526157]">{agreement.creator.email}</p>
          <p className="mt-2 text-xs font-mono text-[#526157]">{agreement.creator.id}</p>
        </article>

        <article className="rounded-[28px] bg-white p-5 text-[#122016] shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#526157]">Receiver</h3>
          <p className="mt-2 text-sm font-semibold">{agreement.receiver.name || "Anonymous"}</p>
          <p className="text-sm text-[#526157]">{agreement.receiver.email}</p>
          <p className="mt-2 text-xs font-mono text-[#526157]">{agreement.receiver.id}</p>
        </article>
      </div>

      {agreement.description ? (
        <article className="rounded-[28px] bg-white p-5 text-[#122016] shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#526157]">Description</h3>
          <p className="mt-2 text-sm leading-relaxed text-[#233428]">{agreement.description}</p>
        </article>
      ) : null}

      <article className="rounded-4xl bg-[#F7F8F2] p-5 text-[#122016] shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[#526157]">Protocol Details</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-[#526157]">Project ID</p>
            <p className="mt-1 text-sm font-mono">{agreement.projectId ?? "-"}</p>
          </div>
          <div className="rounded-2xl bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-[#526157]">Receiver Address</p>
            <p className="mt-1 text-xs font-mono break-all">{agreement.receiverAddress ?? "-"}</p>
          </div>
          <div className="rounded-2xl bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-[#526157]">Transaction Hash</p>
            <p className="mt-1 text-xs font-mono break-all">{agreement.transactionHash ?? "-"}</p>
          </div>
        </div>
      </article>

      <article className="rounded-4xl bg-white p-5 text-[#122016] shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-[#526157]">Milestones ({agreement.milestones.length})</h3>
        {agreement.milestones.length === 0 ? (
          <p className="text-sm text-[#526157]">No milestones defined.</p>
        ) : (
          <div className="space-y-2">
            {agreement.milestones.map((milestone, index) => (
              <div key={milestone.id} className="rounded-2xl bg-[#F7F8F2] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#122016]">{index + 1}. {milestone.title}</p>
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#cae4d0] bg-[#e8f5ea] px-2.5 py-1 text-[11px] font-semibold text-[#1f6a42]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {formatAmount(milestone.amount)} {agreement.currency}
                  </span>
                </div>
                {milestone.description ? <p className="mt-1 text-xs text-[#526157]">{milestone.description}</p> : null}
                <p className="mt-1 text-xs text-[#526157]">Status: {milestone.status}</p>
                <p className="mt-1 text-xs text-[#526157]">Due: {milestone.dueDate ? formatDate(milestone.dueDate) : "-"}</p>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="rounded-4xl bg-white p-5 text-[#122016] shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-[#526157]">Linked Tickets ({agreement.tickets.length})</h3>
        {agreement.tickets.length === 0 ? (
          <p className="text-sm text-[#526157]">No tickets linked to this agreement.</p>
        ) : (
          <div className="space-y-2">
            {agreement.tickets.map((ticket) => (
              <div key={ticket.id} className="flex items-center justify-between rounded-2xl bg-[#F7F8F2] px-3 py-2">
                <div>
                  <Link href={`/tickets/${ticket.id}`} className="group inline-flex items-center gap-1 text-sm font-semibold text-[#1f4c35]">
                    <span className="group-hover:underline">{ticket.title}</span>
                    <ChevronRight className="h-3.5 w-3.5 opacity-45 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </Link>
                  <p className="text-[10px] font-mono text-[#526157]">{ticket.id}</p>
                </div>
                <div className="text-right">
                  <p className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] ${statusBadgeClass(ticket.status)}`}>
                    {ticket.status}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold text-[#526157]">{ticket.severity}</p>
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
