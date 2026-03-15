"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatAmount, formatDate } from "@/app/lib/admin-api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

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
        <p>Track all escrow agreements and open any agreement on its dedicated details page.</p>
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
                    <Link href={`/agreements/${agreement.id}`} className="font-semibold text-[#1d4c35] hover:underline">
                      {agreement.title}
                    </Link>
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
    </section>
  );
}
