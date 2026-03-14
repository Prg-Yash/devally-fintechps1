"use client";

import { useEffect, useMemo, useState } from "react";
import AdminInfoModal from "@/app/components/admin-info-modal";
import { formatDate } from "@/app/lib/admin-api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:5000";

interface TicketRow {
  id: string;
  title: string;
  reason: string;
  status: string;
  createdAt: string;
  raisedBy: { email: string };
  againstUser: { email: string };
  agreement?: { id: string; title: string } | null;
}

interface TicketsResponse {
  count: number;
  tickets: TicketRow[];
}

const summarizeError = (error: unknown) => (error instanceof Error ? error.message : "Unexpected error");

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<TicketRow | null>(null);

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
      } catch (fetchError: unknown) {
        setError(summarizeError(fetchError));
      } finally {
        setIsLoading(false);
      }
    };

    loadTickets();
  }, []);

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
              <th>Reason</th>
              <th>Raised By</th>
              <th>Against</th>
              <th>Agreement</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7}>Loading tickets...</td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={7}>No tickets found.</td>
              </tr>
            ) : (
              tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td>
                    <button
                      type="button"
                      className="border-0 bg-transparent p-0 font-semibold text-[#1d4c35] hover:underline"
                      onClick={() => setSelectedTicket(ticket)}
                    >
                      {ticket.title}
                    </button>
                  </td>
                  <td>{ticket.status}</td>
                  <td>{ticket.reason}</td>
                  <td>{ticket.raisedBy.email}</td>
                  <td>{ticket.againstUser.email}</td>
                  <td>{ticket.agreement ? ticket.agreement.title : "-"}</td>
                  <td>{formatDate(ticket.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminInfoModal
        open={Boolean(selectedTicket)}
        title={selectedTicket ? `Ticket: ${selectedTicket.title}` : "Ticket"}
        onClose={() => setSelectedTicket(null)}
      >
        {selectedTicket ? (
          <>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <p><strong>ID:</strong> {selectedTicket.id}</p>
              <p><strong>Status:</strong> {selectedTicket.status}</p>
              <p><strong>Reason:</strong> {selectedTicket.reason}</p>
              <p><strong>Created:</strong> {formatDate(selectedTicket.createdAt)}</p>
              <p><strong>Raised By:</strong> {selectedTicket.raisedBy.email}</p>
              <p><strong>Against User:</strong> {selectedTicket.againstUser.email}</p>
              <p className="md:col-span-2"><strong>Agreement:</strong> {selectedTicket.agreement ? `${selectedTicket.agreement.title} (${selectedTicket.agreement.id})` : "No linked agreement"}</p>
            </div>

            <details className="rounded-xl border border-dashed border-[#d9d0bf] bg-[#fcfaf5] p-3">
              <summary className="cursor-pointer font-semibold">Raw Complete Data</summary>
              <pre className="mt-3 max-h-[340px] overflow-auto whitespace-pre-wrap break-words text-xs">
                {JSON.stringify(selectedTicket, null, 2)}
              </pre>
            </details>
          </>
        ) : null}
      </AdminInfoModal>
    </section>
  );
}
