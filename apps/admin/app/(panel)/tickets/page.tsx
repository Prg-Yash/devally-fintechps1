"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatDate } from "@/app/lib/admin-api";
import {
  AlertTriangle,
  ChevronRight,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:5000";

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
  agreement?: {
    id: string;
    title: string;
    status: string;
    projectId?: number | null;
    creatorId?: string;
    receiverId?: string;
  } | null;
}

interface TicketsResponse {
  count: number;
  tickets: TicketRow[];
}

interface ReleaseFundsResponse {
  error?: string;
  ticket?: TicketRow;
  release?: {
    txHash: string;
    amountPusd: string;
    recipient: {
      id: string;
      name: string;
      email: string;
      role: "CREATOR" | "RECEIVER";
      walletAddress: string;
    };
  };
}

const summarizeError = (error: unknown) =>
  error instanceof Error ? error.message : "Unexpected error";
const STATUS_OPTIONS = [
  "OPEN",
  "IN_REVIEW",
  "RESOLVED",
  "CLOSED",
  "REJECTED",
] as const;
const SEVERITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const statusBadgeClass = (status: string) => {
  const normalized = status.toUpperCase();
  if (normalized === "RESOLVED" || normalized === "CLOSED") {
    return "border-[#cae4d0] bg-[#e7f5ea] text-[#1e6a3f]";
  }
  if (normalized === "OPEN" || normalized === "IN_REVIEW") {
    return "border-[#ebdfbd] bg-[#f9f3df] text-[#7a5c1f]";
  }
  if (normalized === "REJECTED") {
    return "border-[#ebc9cf] bg-[#f9e6e9] text-[#8b2937]";
  }
  return "border-[#d8dfd3] bg-[#eef2eb] text-[#4f6055]";
};

const severityBadgeClass = (severity: string) => {
  const normalized = severity.toUpperCase();
  if (normalized === "CRITICAL") {
    return "bg-[#f9e1e4] text-[#8f1f2f]";
  }
  if (normalized === "HIGH") {
    return "bg-[#fae9d0] text-[#8a4f08]";
  }
  if (normalized === "MEDIUM") {
    return "bg-[#f7f3e1] text-[#826a1b]";
  }
  return "bg-[#e8f4ea] text-[#2c6642]";
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [releasingTicketId, setReleasingTicketId] = useState<string | null>(
    null,
  );
  const [releaseModalTicket, setReleaseModalTicket] =
    useState<TicketRow | null>(null);
  const [selectedReleaseUserId, setSelectedReleaseUserId] =
    useState<string>("");
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [releaseSummaryByTicket, setReleaseSummaryByTicket] = useState<
    Record<
      string,
      { txHash: string; recipientEmail: string; amountPusd: string }
    >
  >({});
  const [draftStatusByTicket, setDraftStatusByTicket] = useState<
    Record<string, string>
  >({});
  const [draftSeverityByTicket, setDraftSeverityByTicket] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    const loadTickets = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `${API_BASE_URL}/admin/tickets?limit=200`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as
          | TicketsResponse
          | { error?: string };

        if (!response.ok || !("tickets" in payload)) {
          throw new Error(
            ("error" in payload && payload.error) || "Failed to fetch tickets",
          );
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

      const response = await fetch(
        `${API_BASE_URL}/admin/tickets/${ticketId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status, severity }),
        },
      );

      const payload = (await response.json()) as {
        error?: string;
        ticket?: TicketRow;
      };

      if (!response.ok || !payload.ticket) {
        throw new Error(payload.error || "Failed to update ticket");
      }

      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === ticketId ? payload.ticket! : ticket,
        ),
      );
    } catch (updateError: unknown) {
      setError(summarizeError(updateError));
    } finally {
      setEditingTicketId(null);
    }
  };

  const openReleaseModal = (ticket: TicketRow) => {
    if (!ticket.agreement) {
      setError(
        "This ticket is not linked to an agreement, so no escrow can be released.",
      );
      return;
    }

    if (ticket.agreement.projectId == null) {
      setError(
        "This agreement is not linked to an on-chain escrow project yet. Link/fund the agreement first.",
      );
      return;
    }

    setError(null);
    setReleaseModalTicket(ticket);
    setSelectedReleaseUserId("");
    setReleaseError(null);
  };

  const closeReleaseModal = () => {
    if (releasingTicketId) {
      return;
    }
    setReleaseModalTicket(null);
    setSelectedReleaseUserId("");
    setReleaseError(null);
  };

  const handleReleaseFunds = async () => {
    if (!releaseModalTicket) {
      return;
    }

    if (!selectedReleaseUserId) {
      setReleaseError("Select a user to receive the escrow funds.");
      return;
    }

    try {
      setReleasingTicketId(releaseModalTicket.id);
      setReleaseError(null);
      setError(null);

      const response = await fetch(
        `${API_BASE_URL}/admin/tickets/${releaseModalTicket.id}/release-funds`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selectedUserId: selectedReleaseUserId }),
        },
      );

      const payload = (await response.json()) as ReleaseFundsResponse;

      if (!response.ok || !payload.ticket || !payload.release) {
        throw new Error(payload.error || "Failed to release escrow funds");
      }

      const releasedTicket = payload.ticket;
      const releasedMeta = payload.release;

      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === releasedTicket.id ? releasedTicket : ticket,
        ),
      );
      setDraftStatusByTicket((prev) => ({
        ...prev,
        [releasedTicket.id]: releasedTicket.status,
      }));
      setDraftSeverityByTicket((prev) => ({
        ...prev,
        [releasedTicket.id]: releasedTicket.severity,
      }));
      setReleaseSummaryByTicket((prev) => ({
        ...prev,
        [releasedTicket.id]: {
          txHash: releasedMeta.txHash,
          recipientEmail: releasedMeta.recipient.email,
          amountPusd: releasedMeta.amountPusd,
        },
      }));

      setReleaseModalTicket(null);
      setSelectedReleaseUserId("");
    } catch (releaseFundsError: unknown) {
      setReleaseError(summarizeError(releaseFundsError));
    } finally {
      setReleasingTicketId(null);
    }
  };

  const openCount = useMemo(
    () => tickets.filter((ticket) => ticket.status === "OPEN").length,
    [tickets],
  );
  const inReviewCount = useMemo(
    () => tickets.filter((ticket) => ticket.status === "IN_REVIEW").length,
    [tickets],
  );
  const criticalCount = useMemo(
    () => tickets.filter((ticket) => ticket.severity === "CRITICAL").length,
    [tickets],
  );

  return (
    <section className="admin-page space-y-6">
      <header className="rounded-[40px] border border-[#d9dfcf] bg-transparent px-6 py-8 text-[#121212]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-black/60">
              Dispute Monitoring
            </p>
            <h2 className="mt-2 text-4xl md:text-5xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-black">
              Ticket Control
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/75">
              Review risk signals, tune severity instantly, and move disputes
              through resolution with high clarity.
            </p>
          </div>

          <div className="rounded-full border border-black/20 bg-transparent px-5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/60">
              Queue Health
            </p>
            <p className="mt-1 text-sm font-semibold text-black">
              {tickets.length} active records
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[28px] bg-white p-5 shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <div className="inline-flex rounded-full bg-[#D9F24F]/35 p-2 text-[#1A2406]">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#1A2406]/55">
            Total Tickets
          </h3>
          <strong className="mt-1 block text-3xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-[#1A2406]">
            {tickets.length}
          </strong>
        </article>

        <article className="rounded-[28px] bg-white p-5 shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <div className="inline-flex rounded-full bg-[#FFF1D9] p-2 text-[#7A5C1F]">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#1A2406]/55">
            Open
          </h3>
          <strong className="mt-1 block text-3xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-[#1A2406]">
            {openCount}
          </strong>
        </article>

        <article className="rounded-[28px] bg-white p-5 text-black shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <div className="inline-flex rounded-full bg-[#eef2eb] p-2 text-black">
            <Sparkles className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-black/65">
            In Review
          </h3>
          <strong className="mt-1 block text-3xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-black">
            {inReviewCount}
          </strong>
        </article>

        <article className="rounded-[28px] bg-white p-5 text-black shadow-[0_14px_32px_-12px_rgba(26,36,6,0.26)]">
          <div className="inline-flex rounded-full bg-[#eef2eb] p-2 text-black">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-black/65">
            Critical
          </h3>
          <strong className="mt-1 block text-3xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-black">
            {criticalCount}
          </strong>
        </article>
      </div>

      {error ? (
        <p className="rounded-xl border border-[#eccbcb] bg-[#fae8e8] px-4 py-3 text-sm font-semibold text-[#8f1f2f]">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-4xl bg-white shadow-[0_18px_38px_-14px_rgba(26,36,6,0.34)]">
        <div className="flex items-center justify-between border-b border-[#1A2406]/10 bg-[#F7F8F2] px-5 py-4">
          <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-[#1A2406]/65">
            Dispute Queue
          </h3>
          <p className="text-xs text-[#1A2406]/50">Inline updates enabled</p>
        </div>

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
                <td colSpan={9} className="text-center text-[#607062]">
                  Loading tickets...
                </td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-[#607062]"
                >
                  No tickets found.
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td>
                    <Link
                      href={`/tickets/${ticket.id}`}
                      className="group inline-flex items-center gap-1.5 font-semibold text-[#1A2406]"
                    >
                      <span className="group-hover:underline">
                        {ticket.title}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 opacity-45 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                    </Link>
                  </td>
                  <td>
                    <span
                      className={`mb-1 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] ${statusBadgeClass(draftStatusByTicket[ticket.id] ?? ticket.status)}`}
                    >
                      {draftStatusByTicket[ticket.id] ?? ticket.status}
                    </span>
                    <select
                      value={draftStatusByTicket[ticket.id] ?? ticket.status}
                      onChange={(event) =>
                        setDraftStatusByTicket((prev) => ({
                          ...prev,
                          [ticket.id]: event.target.value,
                        }))
                      }
                      className="block rounded-md border border-[#d8e1d4] bg-white px-2 py-1 text-xs"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span
                      className={`mb-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] ${severityBadgeClass(draftSeverityByTicket[ticket.id] ?? ticket.severity)}`}
                    >
                      {draftSeverityByTicket[ticket.id] ?? ticket.severity}
                    </span>
                    <select
                      value={
                        draftSeverityByTicket[ticket.id] ?? ticket.severity
                      }
                      onChange={(event) =>
                        setDraftSeverityByTicket((prev) => ({
                          ...prev,
                          [ticket.id]: event.target.value,
                        }))
                      }
                      className="block rounded-md border border-[#d8e1d4] bg-white px-2 py-1 text-xs"
                    >
                      {SEVERITY_OPTIONS.map((severity) => (
                        <option key={severity} value={severity}>
                          {severity}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="text-[#233428]">{ticket.reason}</td>
                  <td className="text-[#233428]">{ticket.raisedBy.email}</td>
                  <td className="text-[#233428]">{ticket.againstUser.email}</td>
                  <td className="text-[#4e5f54]">
                    {ticket.agreement ? ticket.agreement.title : "-"}
                  </td>
                  <td className="text-[#506156]">
                    {formatDate(ticket.createdAt)}
                  </td>
                  <td>
                    <div className="flex flex-col items-start gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateTicket(ticket.id)}
                          disabled={
                            editingTicketId === ticket.id ||
                            releasingTicketId === ticket.id
                          }
                          className="rounded-md border border-[#1f6a42] bg-[#1f6a42] px-3 py-1 text-xs font-semibold text-white shadow-[0_6px_12px_rgba(31,106,66,0.2)] disabled:opacity-70"
                        >
                          {editingTicketId === ticket.id ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openReleaseModal(ticket)}
                          disabled={
                            editingTicketId === ticket.id ||
                            releasingTicketId === ticket.id
                          }
                          title={
                            !ticket.agreement
                              ? "No linked agreement"
                              : ticket.agreement.projectId == null
                                ? "Agreement not linked to on-chain escrow"
                                : "Release escrow funds"
                          }
                          className="rounded-md border border-[#7a5c1f] bg-[#f9f3df] px-3 py-1 text-xs font-semibold text-[#7a5c1f] shadow-[0_6px_12px_rgba(122,92,31,0.14)] disabled:opacity-60"
                        >
                          {releasingTicketId === ticket.id
                            ? "Releasing..."
                            : "Release Fund"}
                        </button>
                      </div>

                      {releaseSummaryByTicket[ticket.id] ? (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${releaseSummaryByTicket[ticket.id].txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-medium text-[#1f4c35] underline-offset-2 hover:underline"
                        >
                          Released{" "}
                          {releaseSummaryByTicket[ticket.id].amountPusd} PUSD to{" "}
                          {releaseSummaryByTicket[ticket.id].recipientEmail}
                        </a>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {releaseModalTicket ? (
        <div
          className="admin-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Release escrow funds"
        >
          <div className="w-full max-w-xl rounded-3xl border border-[#d8e1d4] bg-white p-6 shadow-[0_22px_46px_-18px_rgba(18,32,22,0.4)]">
            <h4 className="text-lg font-semibold tracking-[-0.02em] text-[#122016]">
              Release Escrow Funds
            </h4>
            <p className="mt-2 text-sm text-[#526157]">
              Select which ticket participant should receive the escrow payout
              for
              <span className="font-semibold text-[#122016]">
                {" "}
                {releaseModalTicket.title}
              </span>
              .
            </p>

            <div className="mt-4 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-[0.12em] text-[#526157]">
                Beneficiary User
              </label>
              <select
                value={selectedReleaseUserId}
                onChange={(event) =>
                  setSelectedReleaseUserId(event.target.value)
                }
                className="w-full rounded-md border border-[#d8e1d4] bg-white px-3 py-2 text-sm text-[#122016]"
                disabled={Boolean(releasingTicketId)}
              >
                <option value="">Select a user</option>
                {[releaseModalTicket.raisedBy, releaseModalTicket.againstUser]
                  .filter(
                    (user, index, arr) =>
                      arr.findIndex((entry) => entry.id === user.id) === index,
                  )
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
              </select>
            </div>

            {releaseError ? (
              <p className="mt-3 rounded-md border border-[#ebc9cf] bg-[#f9e6e9] px-3 py-2 text-sm font-medium text-[#8b2937]">
                {releaseError}
              </p>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeReleaseModal}
                disabled={Boolean(releasingTicketId)}
                className="rounded-md border border-[#d8e1d4] bg-white px-4 py-2 text-sm font-semibold text-[#3f4f45] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReleaseFunds}
                disabled={!selectedReleaseUserId || Boolean(releasingTicketId)}
                className="rounded-md border border-[#7a5c1f] bg-[#f9f3df] px-4 py-2 text-sm font-semibold text-[#7a5c1f] disabled:opacity-60"
              >
                {releasingTicketId ? "Releasing..." : "Confirm Release"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
