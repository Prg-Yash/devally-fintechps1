"use client";

import { useEffect, useMemo, useState } from "react";
import AdminInfoModal from "@/app/components/admin-info-modal";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:5000";

interface StatusCount {
  status: string;
  count: number;
}

interface AnalyticsResponse {
  totals: {
    users: number;
    agreements: number;
    tickets: number;
    purchases: number;
  };
  agreementsByStatus: StatusCount[];
  ticketsByStatus: StatusCount[];
  purchasesByStatus: StatusCount[];
}

const summarizeError = (error: unknown) => (error instanceof Error ? error.message : "Unexpected error");

type AnalyticsBlock = "users" | "agreements" | "tickets" | "purchases";

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeBlock, setActiveBlock] = useState<AnalyticsBlock | null>(null);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`${API_BASE_URL}/admin/analytics`, { cache: "no-store" });
        const payload = (await response.json()) as AnalyticsResponse | { error?: string };

        if (!response.ok || !("totals" in payload)) {
          throw new Error(("error" in payload && payload.error) || "Failed to fetch analytics");
        }

        setData(payload);
      } catch (fetchError: unknown) {
        setError(summarizeError(fetchError));
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalytics();
  }, []);

  const blockDetails = useMemo(() => {
    if (!data || !activeBlock) {
      return null;
    }

    if (activeBlock === "agreements") {
      return { title: "Agreement Status Breakdown", rows: data.agreementsByStatus };
    }

    if (activeBlock === "tickets") {
      return { title: "Ticket Status Breakdown", rows: data.ticketsByStatus };
    }

    if (activeBlock === "purchases") {
      return { title: "Purchase Status Breakdown", rows: data.purchasesByStatus };
    }

    return {
      title: "User Metrics",
      rows: [{ status: "TOTAL_USERS", count: data.totals.users }],
    };
  }, [activeBlock, data]);

  if (!data && !isLoading) {
    return (
      <section className="admin-page">
        <header className="admin-page-header">
          <h2>Platform Analytics</h2>
          <p>Global KPIs across users, agreements, disputes, and payments.</p>
        </header>
        <div className="table-wrap p-4">
          <p className="text-sm text-red-700">Admin API unavailable. Start backend on port 5000.</p>
          <p className="text-xs text-gray-600 mt-2 break-all">{error}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <header className="admin-page-header">
        <h2>Platform Analytics</h2>
        <p>Global KPIs across users, agreements, disputes, and payments. Click any KPI card for detail popup.</p>
      </header>

      {error ? <p className="text-sm text-[#8f1f2f]">{error}</p> : null}

      {isLoading ? <p>Loading analytics...</p> : null}

      {data ? (
        <>
          <div className="stat-grid">
            <button type="button" className="stat-card text-left" onClick={() => setActiveBlock("users")}>
              <h3>Users</h3>
              <strong>{data.totals.users}</strong>
            </button>
            <button type="button" className="stat-card text-left" onClick={() => setActiveBlock("agreements")}>
              <h3>Agreements</h3>
              <strong>{data.totals.agreements}</strong>
            </button>
            <button type="button" className="stat-card text-left" onClick={() => setActiveBlock("tickets")}>
              <h3>Tickets</h3>
              <strong>{data.totals.tickets}</strong>
            </button>
            <button type="button" className="stat-card text-left" onClick={() => setActiveBlock("purchases")}>
              <h3>Purchases</h3>
              <strong>{data.totals.purchases}</strong>
            </button>
          </div>

          <div className="panel-grid">
            <article className="panel-card">
              <h3>Agreement Status</h3>
              <ul>
                {data.agreementsByStatus.map((item) => (
                  <li key={item.status}>
                    <span>{item.status}</span>
                    <strong>{item.count}</strong>
                  </li>
                ))}
              </ul>
            </article>

            <article className="panel-card">
              <h3>Ticket Status</h3>
              <ul>
                {data.ticketsByStatus.map((item) => (
                  <li key={item.status}>
                    <span>{item.status}</span>
                    <strong>{item.count}</strong>
                  </li>
                ))}
              </ul>
            </article>

            <article className="panel-card">
              <h3>Purchase Status</h3>
              <ul>
                {data.purchasesByStatus.map((item) => (
                  <li key={item.status}>
                    <span>{item.status}</span>
                    <strong>{item.count}</strong>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </>
      ) : null}

      <AdminInfoModal
        open={Boolean(activeBlock && blockDetails)}
        title={blockDetails?.title || "Analytics Details"}
        onClose={() => setActiveBlock(null)}
      >
        {blockDetails ? (
          <>
            <div className="rounded-xl border border-[#d9d0bf] bg-[#fefcf6] p-4">
              <h4 className="mb-2 mt-0">Breakdown</h4>
              {blockDetails.rows.map((row) => (
                <p key={row.status}>
                  <strong>{row.status}:</strong> {row.count}
                </p>
              ))}
            </div>

            <details className="rounded-xl border border-dashed border-[#d9d0bf] bg-[#fcfaf5] p-3">
              <summary className="cursor-pointer font-semibold">Raw Complete Data</summary>
              <pre className="mt-3 max-h-[340px] overflow-auto whitespace-pre-wrap break-words text-xs">
                {JSON.stringify(data, null, 2)}
              </pre>
            </details>
          </>
        ) : null}
      </AdminInfoModal>
    </section>
  );
}
