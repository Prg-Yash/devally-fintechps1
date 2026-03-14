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

interface AgreementDetails {
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
}

const summarizeError = (error: unknown) => (error instanceof Error ? error.message : "Unexpected error");
const STATUS_OPTIONS = ["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED", "REJECTED"] as const;
const SEVERITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<TicketRow | null>(null);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [draftStatusByTicket, setDraftStatusByTicket] = useState<Record<string, string>>({});
  const [draftSeverityByTicket, setDraftSeverityByTicket] = useState<Record<string, string>>({});
  const [agreementDetails, setAgreementDetails] = useState<AgreementDetails | null>(null);
  const [isAgreementLoading, setIsAgreementLoading] = useState(false);
  const [agreementError, setAgreementError] = useState<string | null>(null);

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

  useEffect(() => {
    const agreementId = selectedTicket?.agreement?.id;

    if (!agreementId) {
      setAgreementDetails(null);
      setAgreementError(null);
      return;
    }

    const loadAgreementDetails = async () => {
      try {
        setIsAgreementLoading(true);
        setAgreementError(null);

        const response = await fetch(`${API_BASE_URL}/admin/agreements/${agreementId}`, { cache: "no-store" });
        const payload = (await response.json()) as { error?: string; agreement?: AgreementDetails };

        if (!response.ok || !payload.agreement) {
          throw new Error(payload.error || "Failed to fetch agreement details");
        }

        setAgreementDetails(payload.agreement);
      } catch (fetchError: unknown) {
        setAgreementDetails(null);
        setAgreementError(summarizeError(fetchError));
      } finally {
        setIsAgreementLoading(false);
      }
    };

    loadAgreementDetails();
  }, [selectedTicket]);

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
      setSelectedTicket((prev) => (prev?.id === ticketId ? payload.ticket! : prev));
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
                      onClick={() => setSelectedTicket(ticket)}
                    >
                      {ticket.title}
                    </button>
                  </td>
                  <td>
                    <select
                      value={draftStatusByTicket[ticket.id] ?? ticket.status}
                      onChange={(event) =>
                        setDraftStatusByTicket((prev) => ({
                          ...prev,
                          [ticket.id]: event.target.value,
                        }))
                      }
                      className="rounded-md border border-[#d9d0bf] bg-white px-2 py-1 text-xs"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={draftSeverityByTicket[ticket.id] ?? ticket.severity}
                      onChange={(event) =>
                        setDraftSeverityByTicket((prev) => ({
                          ...prev,
                          [ticket.id]: event.target.value,
                        }))
                      }
                      className="rounded-md border border-[#d9d0bf] bg-white px-2 py-1 text-xs"
                    >
                      {SEVERITY_OPTIONS.map((severity) => (
                        <option key={severity} value={severity}>
                          {severity}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{ticket.reason}</td>
                  <td>{ticket.raisedBy.email}</td>
                  <td>{ticket.againstUser.email}</td>
                  <td>{ticket.agreement ? ticket.agreement.title : "-"}</td>
                  <td>{formatDate(ticket.createdAt)}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleUpdateTicket(ticket.id)}
                      disabled={editingTicketId === ticket.id}
                      className="rounded-md border border-[#1f6a42] bg-[#1f6a42] px-3 py-1 text-xs font-semibold text-white disabled:opacity-70"
                    >
                      {editingTicketId === ticket.id ? "Saving..." : "Save"}
                    </button>
                  </td>
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
                      selectedTicket.severity === 'CRITICAL' ? 'bg-[#fde2e2] text-[#8f1f2f]' :
                      selectedTicket.severity === 'HIGH' ? 'bg-[#fde8c8] text-[#7b4c00]' :
                      selectedTicket.severity === 'MEDIUM' ? 'bg-[#ebf4f9] text-[#1f6a8f]' :
                      'bg-[#dff4e6] text-[#1f6a42]'
                    }`}>
                      {selectedTicket.severity}
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
                {isAgreementLoading ? (
                  <p className="text-sm text-[#526157]">Loading agreement details...</p>
                ) : agreementError ? (
                  <p className="text-sm text-[#8f1f2f]">{agreementError}</p>
                ) : agreementDetails ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="rounded-lg border border-[#d9d0bf] bg-white p-3">
                        <p className="text-[10px] font-bold uppercase text-[#526157]">Agreement</p>
                        <p className="mt-1 text-sm font-bold">{agreementDetails.title}</p>
                        <p className="text-[10px] text-[#526157] font-mono">{agreementDetails.id}</p>
                        <p className="mt-2 text-xs text-[#526157]">
                          Status: <span className="font-semibold text-[#122016]">{agreementDetails.status}</span>
                        </p>
                        <p className="text-xs text-[#526157]">
                          Amount: <span className="font-semibold text-[#122016]">{agreementDetails.amount.toLocaleString("en-IN")} {agreementDetails.currency}</span>
                        </p>
                        <p className="text-xs text-[#526157]">Created: {formatDate(agreementDetails.createdAt)}</p>
                      </div>

                      <div className="rounded-lg border border-[#d9d0bf] bg-white p-3">
                        <p className="text-[10px] font-bold uppercase text-[#526157]">Parties</p>
                        <p className="mt-1 text-xs text-[#526157]">Creator</p>
                        <p className="text-sm font-medium">{agreementDetails.creator.name || "Anonymous"}</p>
                        <p className="text-xs text-[#526157]">{agreementDetails.creator.email}</p>
                        <p className="mt-2 text-xs text-[#526157]">Receiver</p>
                        <p className="text-sm font-medium">{agreementDetails.receiver.name || "Anonymous"}</p>
                        <p className="text-xs text-[#526157]">{agreementDetails.receiver.email}</p>
                      </div>
                    </div>

                    {agreementDetails.description ? (
                      <div className="rounded-lg border border-[#d9d0bf] bg-white p-3">
                        <p className="text-[10px] font-bold uppercase text-[#526157]">Description</p>
                        <p className="mt-1 text-sm text-[#122016]">{agreementDetails.description}</p>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="rounded-lg border border-[#d9d0bf] bg-white p-3">
                        <p className="text-[10px] font-bold uppercase text-[#526157]">Project ID</p>
                        <p className="mt-1 text-sm font-mono text-[#122016]">{agreementDetails.projectId ?? "-"}</p>
                      </div>
                      <div className="rounded-lg border border-[#d9d0bf] bg-white p-3">
                        <p className="text-[10px] font-bold uppercase text-[#526157]">Receiver Address</p>
                        <p className="mt-1 text-xs font-mono text-[#122016] break-all">{agreementDetails.receiverAddress ?? "-"}</p>
                      </div>
                      <div className="rounded-lg border border-[#d9d0bf] bg-white p-3">
                        <p className="text-[10px] font-bold uppercase text-[#526157]">Tx Hash</p>
                        <p className="mt-1 text-xs font-mono text-[#122016] break-all">{agreementDetails.transactionHash ?? "-"}</p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-[#d9d0bf] bg-white p-3">
                      <p className="text-[10px] font-bold uppercase text-[#526157] mb-2">Milestones ({agreementDetails.milestones.length})</p>
                      {agreementDetails.milestones.length === 0 ? (
                        <p className="text-xs text-[#526157]">No milestones available.</p>
                      ) : (
                        <div className="space-y-2">
                          {agreementDetails.milestones.map((milestone, index) => (
                            <div key={milestone.id} className="rounded-md border border-[#ece6d9] bg-[#fcfbf8] p-2">
                              <p className="text-xs font-semibold text-[#122016]">{index + 1}. {milestone.title}</p>
                              {milestone.description ? <p className="text-xs text-[#526157]">{milestone.description}</p> : null}
                              <p className="text-[11px] text-[#526157]">
                                Amount: {milestone.amount.toLocaleString("en-IN")} {agreementDetails.currency} | Status: {milestone.status}
                                {milestone.dueDate ? ` | Due: ${formatDate(milestone.dueDate)}` : ""}
                              </p>
                            </div>
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
