"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDate } from "@/app/lib/admin-api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:5000";

interface TicketRow {
  id: string;
  title: string;
  reason: string;
  status: string;
  severity: string;
  evidenceUrl?: string | null;
  createdAt: string;
  raisedBy: { id: string; name: string; email: string };
  againstUser: { id: string; name: string; email: string };
  agreement?: { id: string; title: string; status: string } | null;
}

interface TicketsResponse {
  count: number;
  tickets: TicketRow[];
}

const summarizeError = (error: unknown) => (error instanceof Error ? error.message : "Unexpected error");
const STATUS_OPTIONS = ["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED", "REJECTED"] as const;
const SEVERITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [draftStatusByTicket, setDraftStatusByTicket] = useState<Record<string, string>>({});
  const [draftSeverityByTicket, setDraftSeverityByTicket] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadTickets = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`${API_BASE_URL}/admin/tickets?limit=200`, { cache: "no-store" });
        const payload = (await response.json()) as TicketsResponse | { error?: string };

        if (!response.ok || !("tickets" in payload)) {
          throw new Error(("error" in payload && payload.error) || "Failed to fetch tickets");
        }

        setTickets(payload.tickets);
        setDraftStatusByTicket(
          payload.tickets.reduce<Record<string, string>>((acc, ticket) => {
            acc[ticket.id] = ticket.status;
            return acc;
          }, {}),
        );
        setDraftSeverityByTicket(
          payload.tickets.reduce<Record<string, string>>((acc, ticket) => {
            acc[ticket.id] = ticket.severity;
            return acc;
          }, {}),
        );
      } catch (fetchError: unknown) {
        setError(summarizeError(fetchError));
      } finally {
        setIsLoading(false);
      }
    };

    loadTickets();
  }, []);

  const handleUpdateTicket = async (ticketId: string) => {
    const status = draftStatusByTicket[ticketId];
    const severity = draftSeverityByTicket[ticketId];

    try {
      setEditingTicketId(ticketId);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/admin/tickets/${ticketId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status, severity }),
      });

      const payload = (await response.json()) as { error?: string; ticket?: TicketRow };

      if (!response.ok || !payload.ticket) {
        throw new Error(payload.error || "Failed to update ticket");
      }

      setTickets((prev) => prev.map((ticket) => (ticket.id === ticketId ? payload.ticket! : ticket)));
    } catch (updateError: unknown) {
      setError(summarizeError(updateError));
    } finally {
      setEditingTicketId(null);
    }
  };

  const openCount = useMemo(() => tickets.filter((ticket) => ticket.status === "OPEN").length, [tickets]);
  const inReviewCount = useMemo(() => tickets.filter((ticket) => ticket.status === "IN_REVIEW").length, [tickets]);

  return (
    <section className="admin-page">
      <header className="admin-page-header">
        <h2>Dispute Tickets</h2>
        <p>Monitor all disputes and review ticket context quickly. Click any title to open full info.</p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <article className="rounded-2xl border border-[#d9d0bf] bg-[#fffdf8] p-4">
          <h3 className="text-sm text-[#516157]">Total Tickets</h3>
          <strong className="text-2xl text-[#122016]">{tickets.length}</strong>
        </article>
        <article className="rounded-2xl border border-[#d9d0bf] bg-[#fffdf8] p-4">
          <h3 className="text-sm text-[#516157]">Open</h3>
          <strong className="text-2xl text-[#122016]">{openCount}</strong>
        </article>
        <article className="rounded-2xl border border-[#d9d0bf] bg-[#fffdf8] p-4">
          <h3 className="text-sm text-[#516157]">In Review</h3>
          <strong className="text-2xl text-[#122016]">{inReviewCount}</strong>
        </article>
      </div>

      {error ? <p className="text-sm text-[#8f1f2f]">{error}</p> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Severity</th>
              <th>Reason</th>
              <th>Raised By</th>
              <th>Against</th>
              <th>Agreement</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9}>Loading tickets...</td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={9}>No tickets found.</td>
              </tr>
            ) : (
              tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td>
                    <button
                      type="button"
                      className="border-0 bg-transparent p-0 font-semibold text-[#1d4c35] hover:underline"
                    >
                      <Link href={`/tickets/${ticket.id}`}>{ticket.title}</Link>
                    </button>
                  </td>
                  <td>
                    <select
                      value={draftStatusByTicket[ticket.id] ?? ticket.status}
                      onChange={(event) =>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border border-[#d9d0bf] bg-white p-3">
                      <p className="text-[10px] font-bold uppercase text-[#526157] mb-2">Related Tickets ({agreementDetails.tickets.length})</p>
                      {agreementDetails.tickets.length === 0 ? (
                        <p className="text-xs text-[#526157]">No other tickets are linked to this agreement.</p>
                      ) : (
                        <div className="space-y-2">
                          {agreementDetails.tickets.map((agreementTicket) => (
                            <div key={agreementTicket.id} className="rounded-md border border-[#ece6d9] bg-[#fcfbf8] p-2">
                              <p className="text-xs font-semibold text-[#122016]">{agreementTicket.title}</p>
                              <p className="text-[11px] text-[#526157]">
                                {agreementTicket.status} | {agreementTicket.severity} | {formatDate(agreementTicket.createdAt)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold">{selectedTicket.agreement.title}</p>
                      <p className="text-[10px] text-[#526157] font-mono">{selectedTicket.agreement.id}</p>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-1 rounded border border-[#d9d0bf] bg-white text-[10px] font-bold uppercase">
                        {selectedTicket.agreement.status}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-xl border border-[#d9d0bf] bg-white p-4 text-[#122016]">
               <h4 className="text-xs font-bold uppercase text-[#526157] mb-2">Internal Note / Metadata</h4>
               <p className="text-xs text-[#526157] italic">Automated dispute record for agreement conflict resolution.</p>
            </div>
          </div>
        ) : null}
      </AdminInfoModal>
    </section>
  );
}
