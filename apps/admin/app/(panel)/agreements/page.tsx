"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatAmount, formatDate } from "@/app/lib/admin-api";
import { ArrowUpRight, ShieldCheck, AlertTriangle, Layers, ChevronRight } from "lucide-react";

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

const successStates = new Set(["COMPLETED", "PAID", "SUCCESS", "SETTLED"]);
const warningStates = new Set(["PENDING", "IN_REVIEW", "ACTIVE", "OPEN"]);

const statusBadgeClass = (status: string) => {
  const normalized = status.toUpperCase();
  if (successStates.has(normalized)) {
    return "border-[#cae4d0] bg-[#e7f5ea] text-[#1e6a3f]";
  }
  if (warningStates.has(normalized)) {
    return "border-[#ebdfbd] bg-[#f9f3df] text-[#7a5c1f]";
  }
  if (normalized.includes("REJECT") || normalized.includes("CANCEL") || normalized.includes("FAIL")) {
    return "border-[#ebc9cf] bg-[#f9e6e9] text-[#8b2937]";
  }
  return "border-[#d8dfd3] bg-[#eef2eb] text-[#4f6055]";
};

export default function AgreementsPage() {
  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const disputedCount = useMemo(
    () => agreements.filter((item) => item._count.tickets > 0).length,
    [agreements],
  );

  const completedCount = useMemo(
    () => agreements.filter((item) => successStates.has(item.status.toUpperCase())).length,
    [agreements],
  );

  return (
    <section className="admin-page space-y-6">
      <header className="rounded-[40px] border border-[#d9dfcf] bg-transparent px-6 py-8 text-[#121212]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-black/60">Escrow Registry</p>
            <h2 className="mt-2 text-4xl md:text-5xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-black">
              Agreement Control
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/75">
              Manage all platform agreements with the same trust-first visual system used on the landing experience.
            </p>
          </div>

          <div className="rounded-full border border-black/20 bg-transparent px-5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/60">Coverage</p>
            <p className="mt-1 text-sm font-semibold text-black">{agreements.length} agreements indexed</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[28px] bg-white p-5 shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <div className="inline-flex rounded-full bg-[#D9F24F]/35 p-2 text-[#1A2406]">
            <Layers className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#1A2406]/55">Total Agreements</h3>
          <p className="mt-1 text-3xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-[#1A2406]">{agreements.length}</p>
        </article>

        <article className="rounded-[28px] bg-white p-5 shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <div className="inline-flex rounded-full bg-[#E8F1FF] p-2 text-[#2F5B83]">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#1A2406]/55">Escrow Value</h3>
          <p className="mt-1 text-3xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-[#1A2406]">{formatAmount(totalAgreementAmount)}</p>
        </article>

        <article className="rounded-[28px] bg-white p-5 text-black shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <div className="inline-flex rounded-full bg-[#eef2eb] p-2 text-black">
            <ArrowUpRight className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-black/65">Completed</h3>
          <p className="mt-1 text-3xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-black">{completedCount}</p>
        </article>

        <article className="rounded-[28px] bg-white p-5 text-black shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <div className="inline-flex rounded-full bg-[#eef2eb] p-2 text-black">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-black/65">Disputed</h3>
          <p className="mt-1 text-3xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-black">{disputedCount}</p>
        </article>
      </div>

      {error ? (
        <p className="rounded-xl border border-[#eccbcb] bg-[#fae8e8] px-4 py-3 text-sm font-semibold text-[#8f1f2f]">{error}</p>
      ) : null}

      <div className="overflow-hidden rounded-4xl bg-white shadow-[0_18px_38px_-14px_rgba(26,36,6,0.34)]">
        <div className="flex items-center justify-between border-b border-[#1A2406]/10 bg-[#F7F8F2] px-5 py-4">
          <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-[#1A2406]/65">Agreement Directory</h3>
          <p className="text-xs text-[#1A2406]/50">Open title for full detail page</p>
        </div>

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
                <td colSpan={8} className="text-center text-[#607062]">Loading agreements...</td>
              </tr>
            ) : agreements.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-[#607062]">No agreements found.</td>
              </tr>
            ) : (
              agreements.map((agreement) => (
                <tr key={agreement.id}>
                  <td>
                    <Link href={`/agreements/${agreement.id}`} className="group inline-flex items-center gap-1.5 font-semibold text-[#1A2406]">
                      <span className="group-hover:underline">{agreement.title}</span>
                      <ChevronRight className="h-3.5 w-3.5 opacity-45 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                    </Link>
                  </td>
                  <td>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] ${statusBadgeClass(agreement.status)}`}>
                      {agreement.status}
                    </span>
                  </td>
                  <td>
                    <span className="font-semibold text-[#122016]">{formatAmount(agreement.amount)}</span>
                    <span className="ml-1 text-xs uppercase text-[#5f6f64]">{agreement.currency}</span>
                  </td>
                  <td className="text-[#1A2406]/80">{agreement.creator.email}</td>
                  <td className="text-[#1A2406]/80">{agreement.receiver.email}</td>
                  <td>
                    <span className="rounded-full bg-[#eef4ea] px-2.5 py-1 text-[11px] font-semibold text-[#365543]">
                      {agreement.milestones.length}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${agreement._count.tickets > 0 ? "bg-[#fbefdf] text-[#865520]" : "bg-[#e9f6ee] text-[#286642]"}`}
                    >
                      {agreement._count.tickets}
                    </span>
                  </td>
                  <td className="text-[#1A2406]/60">{formatDate(agreement.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
