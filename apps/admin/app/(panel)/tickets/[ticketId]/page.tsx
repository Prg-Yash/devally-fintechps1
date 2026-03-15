"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { formatDate } from "@/app/lib/admin-api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:5000";

const STATUS_OPTIONS = ["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED", "REJECTED"] as const;
const SEVERITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

type TicketDetails = {
  id: string;
  title: string;
  description: string;
  reason: string;
  status: string;
  severity: string;
  evidenceUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  raisedBy: { id: string; name: string; email: string };
  againstUser: { id: string; name: string; email: string };
  agreement?: { id: string; title: string; status: string } | null;
};

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

export default function TicketDetailsPage() {
  const params = useParams<{ ticketId: string }>();
  const ticketId = useMemo(() => params?.ticketId ?? "", [params]);

  const [ticket, setTicket] = useState<TicketDetails | null>(null);
  const [agreement, setAgreement] = useState<AgreementDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreementError, setAgreementError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("OPEN");
  const [severity, setSeverity] = useState<string>("LOW");

  const fetchTicket = useCallback(async () => {
    if (!ticketId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/admin/tickets/${ticketId}`, { cache: "no-store" });
      const payload = (await response.json()) as { error?: string; ticket?: TicketDetails };

      if (!response.ok || !payload.ticket) {
        throw new Error(payload.error || "Failed to fetch ticket details");
      }

      setTicket(payload.ticket);
      setStatus(payload.ticket.status);
      setSeverity(payload.ticket.severity);
    } catch (fetchError: unknown) {
      setError(summarizeError(fetchError));
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  useEffect(() => {
    const agreementId = ticket?.agreement?.id;

    if (!agreementId) {
      setAgreement(null);
      setAgreementError(null);
      return;
    }

    const fetchAgreement = async () => {
      try {
        setAgreementError(null);
        const response = await fetch(`${API_BASE_URL}/admin/agreements/${agreementId}`, { cache: "no-store" });
        const payload = (await response.json()) as { error?: string; agreement?: AgreementDetails };

        if (!response.ok || !payload.agreement) {
          throw new Error(payload.error || "Failed to fetch agreement details");
        }

        setAgreement(payload.agreement);
      } catch (fetchError: unknown) {
        setAgreement(null);
        setAgreementError(summarizeError(fetchError));
      }
    };

    fetchAgreement();
  }, [ticket]);

  const updateTicket = async () => {
    if (!ticket) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/admin/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, severity }),
      });

      const payload = (await response.json()) as { error?: string; ticket?: TicketDetails };

      if (!response.ok || !payload.ticket) {
        throw new Error(payload.error || "Failed to update ticket");
      }

      setTicket(payload.ticket);
    } catch (updateError: unknown) {
      setError(summarizeError(updateError));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <section className="admin-page"><p>Loading ticket details...</p></section>;
  }

  if (!ticket) {
    return (
      <section className="admin-page">
        <p className="text-sm text-[#8f1f2f]">{error || "Ticket not found"}</p>
      </section>
    );
  }

  return (
    <section className="admin-page space-y-6">
      <header className="admin-page-header">
        <h2>{ticket.title}</h2>
        <p>Ticket ID: <span className="font-mono">{ticket.id}</span></p>
        <div className="mt-2">
          <Link href="/tickets" className="text-sm font-semibold text-[#1d4c35] hover:underline">
            Back to Tickets
          </Link>
        </div>
      </header>

      {error ? <p className="text-sm text-[#8f1f2f]">{error}</p> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-[#d9d0bf] bg-[#fffdf8] p-4">
          <h3 className="text-xs font-bold uppercase text-[#526157]">Ticket Overview</h3>
          <div className="mt-3 space-y-2 text-sm text-[#122016]">
            <p><strong>Reason:</strong> {ticket.reason}</p>
            <p><strong>Description:</strong> {ticket.description}</p>
            <p><strong>Created:</strong> {formatDate(ticket.createdAt)}</p>
            <p><strong>Last Updated:</strong> {formatDate(ticket.updatedAt)}</p>
          </div>
        </article>

        <article className="rounded-xl border border-[#d9d0bf] bg-[#fffdf8] p-4">
          <h3 className="text-xs font-bold uppercase text-[#526157]">Admin Actions</h3>
          <div className="mt-3 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-[#526157]">Status</label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="w-full rounded-md border border-[#d9d0bf] bg-white px-3 py-2 text-sm"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-[#526157]">Severity</label>
              <select
                value={severity}
                onChange={(event) => setSeverity(event.target.value)}
                className="w-full rounded-md border border-[#d9d0bf] bg-white px-3 py-2 text-sm"
              >
                {SEVERITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={updateTicket}
              disabled={saving}
              className="rounded-md border border-[#1f6a42] bg-[#1f6a42] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </article>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-[#d9d0bf] bg-[#fffbf9] p-4 text-[#122016]">
          <h3 className="text-xs font-bold uppercase text-[#526157]">Raised By</h3>
          <p className="mt-2 text-sm font-semibold">{ticket.raisedBy.name || "Anonymous"}</p>
          <p className="text-sm text-[#526157]">{ticket.raisedBy.email}</p>
          <p className="mt-2 text-xs font-mono text-[#526157]">{ticket.raisedBy.id}</p>
        </article>

        <article className="rounded-xl border border-[#d9d0bf] bg-[#fffbf9] p-4 text-[#122016]">
          <h3 className="text-xs font-bold uppercase text-[#526157]">Against User</h3>
          <p className="mt-2 text-sm font-semibold">{ticket.againstUser.name || "Anonymous"}</p>
          <p className="text-sm text-[#526157]">{ticket.againstUser.email}</p>
          <p className="mt-2 text-xs font-mono text-[#526157]">{ticket.againstUser.id}</p>
        </article>
      </div>

      {ticket.evidenceUrl ? (
        <article className="rounded-xl border border-[#d9d0bf] bg-[#ebf4f9] p-4 text-[#122016]">
          <h3 className="text-xs font-bold uppercase text-[#526157]">Evidence</h3>
          <p className="mt-2 text-sm break-all">{ticket.evidenceUrl}</p>
          <a
            href={ticket.evidenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block rounded-md border border-[#1f6a8f] bg-white px-3 py-1.5 text-xs font-bold text-[#1f6a8f]"
          >
            Open Evidence
          </a>
        </article>
      ) : null}

      <article className="rounded-xl border border-[#d9d0bf] bg-[#f9fdf3] p-4 text-[#122016]">
        <h3 className="text-xs font-bold uppercase text-[#526157]">Linked Agreement</h3>

        {!ticket.agreement ? (
          <p className="mt-2 text-sm text-[#526157]">No agreement linked to this ticket.</p>
        ) : agreementError ? (
          <p className="mt-2 text-sm text-[#8f1f2f]">{agreementError}</p>
        ) : !agreement ? (
          <p className="mt-2 text-sm text-[#526157]">Loading agreement details...</p>
        ) : (
          <div className="mt-3 space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-[#d9d0bf] bg-white p-3">
                <p className="text-[10px] font-bold uppercase text-[#526157]">Agreement</p>
                <p className="mt-1 text-sm font-bold">{agreement.title}</p>
                <p className="text-[10px] text-[#526157] font-mono">{agreement.id}</p>
                <p className="mt-2 text-xs text-[#526157]">
                  Status: <span className="font-semibold text-[#122016]">{agreement.status}</span>
                </p>
                <p className="text-xs text-[#526157]">
                  Amount: <span className="font-semibold text-[#122016]">{agreement.amount.toLocaleString("en-IN")} {agreement.currency}</span>
                </p>
              </div>

              <div className="rounded-lg border border-[#d9d0bf] bg-white p-3">
                <p className="text-[10px] font-bold uppercase text-[#526157]">Parties</p>
                <p className="mt-1 text-xs text-[#526157]">Creator</p>
                <p className="text-sm font-medium">{agreement.creator.name || "Anonymous"}</p>
                <p className="text-xs text-[#526157]">{agreement.creator.email}</p>
                <p className="mt-2 text-xs text-[#526157]">Receiver</p>
                <p className="text-sm font-medium">{agreement.receiver.name || "Anonymous"}</p>
                <p className="text-xs text-[#526157]">{agreement.receiver.email}</p>
              </div>
            </div>

            {agreement.description ? (
              <div className="rounded-lg border border-[#d9d0bf] bg-white p-3">
                <p className="text-[10px] font-bold uppercase text-[#526157]">Description</p>
                <p className="mt-1 text-sm text-[#122016]">{agreement.description}</p>
              </div>
            ) : null}

            <div className="rounded-lg border border-[#d9d0bf] bg-white p-3">
              <p className="text-[10px] font-bold uppercase text-[#526157] mb-2">Milestones ({agreement.milestones.length})</p>
              {agreement.milestones.length === 0 ? (
                <p className="text-xs text-[#526157]">No milestones defined.</p>
              ) : (
                <div className="space-y-2">
                  {agreement.milestones.map((milestone, index) => (
                    <div key={milestone.id} className="rounded-md border border-[#ece6d9] bg-[#fcfbf8] p-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[#122016]">{index + 1}. {milestone.title}</p>
                        <span className="text-xs font-semibold text-[#1f6a42]">
                          {milestone.amount.toLocaleString("en-IN")} {agreement.currency}
                        </span>
                      </div>
                      {milestone.description ? <p className="mt-1 text-xs text-[#526157]">{milestone.description}</p> : null}
                      <p className="mt-1 text-xs text-[#526157]">Status: {milestone.status}</p>
                      <p className="mt-1 text-xs text-[#526157]">Due: {milestone.dueDate ? formatDate(milestone.dueDate) : "-"}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </article>
    </section>
  );
}
