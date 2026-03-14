"use client";

import { useEffect, useMemo, useState } from "react";
import AdminInfoModal from "@/app/components/admin-info-modal";
import { formatDate } from "@/app/lib/admin-api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:5000";

const TICKET_STATUSES = ["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED", "REJECTED"] as const;
const TICKET_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

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

const summarizeError = (err: unknown) => (err instanceof Error ? err.message : "Unexpected error");

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<TicketRow | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const updateTicket = async (
    ticketId: string,
    payload: { status?: string; severity?: string }
  ) => {
    setUpdatingId(ticketId);
    setError(null);
    const url = `${API_BASE_URL}/admin/tickets/${ticketId}`;

    try {
      const response = await fetch(url, {
        method: "PATCH",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(String(response.status));
      }

      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, ...payload } : t))
      );
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket((prev) => (prev ? { ...prev, ...payload } : null));
      }
    } catch {
      setError(
        "Network error: Verify Express is running at port 5000 and CORS is enabled."
      );
    } finally {
      setUpdatingId(null);
    }
  };

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
              <th>Severity</th>
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
                <td colSpan={8}>Loading tickets...</td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={8}>No tickets found.</td>
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
                  <td>
                    <select
                      value={ticket.status}
                      disabled={updatingId === ticket.id}
                      onChange={(e) =>
                        updateTicket(ticket.id, { status: e.target.value })
                      }
                      className="min-w-28 rounded-md border border-[#d9d0bf] bg-[#fffdf8] px-2 py-1 text-sm text-[#122016] focus:border-[#1d4c35] focus:outline-none focus:ring-1 focus:ring-[#1d4c35] disabled:opacity-60"
                    >
                      {TICKET_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={ticket.severity ?? "LOW"}
                      disabled={updatingId === ticket.id}
                      onChange={(e) =>
                        updateTicket(ticket.id, { severity: e.target.value })
                      }
                      className="min-w-24 rounded-md border border-[#d9d0bf] bg-[#fffdf8] px-2 py-1 text-sm text-[#122016] focus:border-[#1d4c35] focus:outline-none focus:ring-1 focus:ring-[#1d4c35] disabled:opacity-60"
                    >
                      {TICKET_SEVERITIES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
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
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-[#d9d0bf] bg-[#fefaf5] p-4 text-[#122016]">
                <h4 className="text-xs font-bold uppercase text-[#526157] mb-3">Ticket Information</h4>
                <div className="space-y-2 text-sm">
                  <p><strong className="text-[#122016]">ID:</strong> <span className="text-[#526157] font-mono">{selectedTicket.id}</span></p>
                  <p><strong>Title:</strong> {selectedTicket.title}</p>
                  <p><strong>Status:</strong> 
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      selectedTicket.status === 'OPEN' ? 'bg-[#fde8c8] text-[#7b4c00]' : 
                      selectedTicket.status === 'IN_REVIEW' ? 'bg-[#ebf4f9] text-[#1f6a8f]' : 
                      'bg-[#dff4e6] text-[#1f6a42]'
                    }`}>
                      {selectedTicket.status}
                    </span>
                  </p>
                  <p><strong>Severity:</strong> 
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      selectedTicket.severity === 'CRITICAL' ? 'bg-[#fde8e8] text-[#8f1f2f]' :
                      selectedTicket.severity === 'HIGH' ? 'bg-[#fde8c8] text-[#7b4c00]' :
                      selectedTicket.severity === 'MEDIUM' ? 'bg-[#ebf4f9] text-[#1f6a8f]' :
                      'bg-[#e8f4eb] text-[#1f6a42]'
                    }`}>
                      {selectedTicket.severity ?? 'LOW'}
                    </span>
                  </p>
                  <p><strong>Reason Category:</strong> <span className="text-[#8f1f2f] font-medium">{selectedTicket.reason}</span></p>
                  <p><strong>Created:</strong> {formatDate(selectedTicket.createdAt)}</p>
                </div>
              </div>

              <div className="rounded-xl border border-[#d9d0bf] bg-[#fffbf9] p-4 text-[#122016]">
                <h4 className="text-xs font-bold uppercase text-[#526157] mb-3">Parties Involved</h4>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-bold text-[#1f6a42] uppercase">Raised By (Complainant)</p>
                    <p className="text-sm font-medium">{selectedTicket.raisedBy.name || 'Anonymous'}</p>
                    <p className="text-xs text-[#526157]">{selectedTicket.raisedBy.email}</p>
                  </div>
                  <div className="pt-2 border-t border-[#ece6d9]">
                    <p className="text-[10px] font-bold text-[#8f1f2f] uppercase">Against (Defendant)</p>
                    <p className="text-sm font-medium">{selectedTicket.againstUser.name || 'Anonymous'}</p>
                    <p className="text-xs text-[#526157]">{selectedTicket.againstUser.email}</p>
                  </div>
                </div>
              </div>
            </div>

            {selectedTicket.evidenceUrl && (
              <div className="rounded-xl border border-[#d9d0bf] bg-[#ebf4f9] p-4 text-[#122016]">
                <h4 className="text-xs font-bold uppercase text-[#526157] mb-3">Evidence Submitted</h4>
                <div className="flex items-center justify-between">
                  <p className="text-sm truncate mr-4">{selectedTicket.evidenceUrl}</p>
                  <a 
                    href={selectedTicket.evidenceUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-md border border-[#1f6a8f] bg-white px-3 py-1.5 text-xs font-bold text-[#1f6a8f] hover:bg-[#ebf4f9]"
                  >
                    View Evidence
                  </a>
                </div>
              </div>
            )}

            {selectedTicket.agreement && (
              <div className="rounded-xl border border-[#d9d0bf] bg-[#f9fdf3] p-4 text-[#122016]">
                <h4 className="text-xs font-bold uppercase text-[#526157] mb-3">Context: Linked Agreement</h4>
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
