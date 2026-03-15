"use client";

import { useEffect, useMemo, useState } from "react";
import AdminInfoModal from "@/app/components/admin-info-modal";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

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

type AnalyticsBlock =
  | "users"
  | "agreements"
  | "tickets"
  | "purchases"
  | "agreementStatus"
  | "ticketStatus"
  | "purchaseStatus";

const statusWeightColor: Record<string, string> = {
  COMPLETED: "#2f7f59",
  SUCCESS: "#2f7f59",
  PAID: "#2f7f59",
  RESOLVED: "#2f7f59",
  CLOSED: "#406f89",
  IN_REVIEW: "#4476a1",
  PENDING: "#b38b2c",
  OPEN: "#bf8a2f",
  ACTIVE: "#6f7d84",
  REJECTED: "#9f3946",
  FAILED: "#9f3946",
  CANCELLED: "#9f3946",
  EXPIRED: "#9f3946",
};

const ratio = (value: number, total: number) => {
  if (!total) return 0;
  return Number(((value / total) * 100).toFixed(1));
};

const getStatusCount = (rows: StatusCount[], names: string[]) => {
  const normalized = new Set(names.map((name) => name.toUpperCase()));
  return rows
    .filter((row) => normalized.has(row.status.toUpperCase()))
    .reduce((sum, row) => sum + row.count, 0);
};

const sortByCount = (rows: StatusCount[]) => [...rows].sort((a, b) => b.count - a.count);

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

function RechartsBarWidget({
  title,
  rows,
  onOpen,
}: {
  title: string;
  rows: StatusCount[];
  onOpen: () => void;
}) {
  const sorted = sortByCount(rows).map(row => ({
    ...row,
    color: statusWeightColor[row.status.toUpperCase()] ?? "#8884d8"
  }));

  return (
    <article className="rounded-2xl border border-[#d9d0bf] bg-[#fffdf8] p-5 shadow-[0_4px_14px_rgba(18,32,22,0.05)] flex flex-col h-[380px]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold text-[#122016]">{title}</h3>
        <button
          type="button"
          onClick={onOpen}
          className="rounded-md border border-[#d9d0bf] bg-[#f4f8eb] px-3 py-1.5 text-xs font-bold uppercase text-[#2b4a36] hover:bg-[#e4ebd3] transition-colors"
        >
          View Details
        </button>
      </div>

      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sorted} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5dccb" />
            <XAxis type="number" tick={{fontSize: 12, fill: '#5b6a60'}} />
            <YAxis dataKey="status" type="category" tick={{fontSize: 11, fill: '#122016', fontWeight: 600}} width={90} />
            <Tooltip 
              cursor={{fill: '#f0edd9'}}
              contentStyle={{ borderRadius: '12px', borderColor: '#d9d0bf', fontWeight: 600, fontSize: '12px' }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {sorted.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function RechartsPieWidget({
  rows,
  title,
  onOpen,
}: {
  rows: StatusCount[];
  title: string;
  onOpen: () => void;
}) {
  const sorted = sortByCount(rows).map(row => ({
    ...row,
    color: statusWeightColor[row.status.toUpperCase()] ?? "#8884d8",
    name: row.status
  }));

  const total = sorted.reduce((sum, item) => sum + item.count, 0);

  return (
    <article className="rounded-2xl border border-[#d9d0bf] bg-[#fffdf8] p-5 shadow-[0_4px_14px_rgba(18,32,22,0.05)] flex flex-col h-[380px]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold text-[#122016]">{title}</h3>
        <button
          type="button"
          onClick={onOpen}
          className="rounded-md border border-[#d9d0bf] bg-[#f4f8eb] px-3 py-1.5 text-xs font-bold uppercase text-[#2b4a36] hover:bg-[#e4ebd3] transition-colors"
        >
          View Details
        </button>
      </div>

      <div className="flex-1 w-full min-h-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={sorted}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="count"
              stroke="none"
            >
              {sorted.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.1)' }}
              itemStyle={{ fontWeight: 'bold' }}
            />
            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center pb-8">
            <span className="text-xs font-bold text-[#5b6a60] uppercase">Total</span>
            <span className="text-2xl font-black text-[#122016]">{total}</span>
        </div>
      </div>
    </article>
  );
}

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
        const response = await fetch(`${API_BASE_URL}/admin/analytics`, { cache: "no-store", headers: { 'Accept': 'application/json' } });
        
        let payload;
        try {
          payload = await response.json();
        } catch(e) {
          throw new Error("Invalid Server Response format. Endpoints might be down.");
        }

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
    if (!data || !activeBlock) return null;

    if (activeBlock === "agreements") {
      return {
        title: "Agreements - Volume Summary",
        rows: [
          { status: "TOTAL_AGREEMENTS", count: data.totals.agreements },
          { status: "COMPLETED", count: getStatusCount(data.agreementsByStatus, ["COMPLETED"]) },
        ],
      };
    }
    if (activeBlock === "tickets") {
      return {
        title: "Tickets - Volume Summary",
        rows: [
          { status: "TOTAL_TICKETS", count: data.totals.tickets },
          { status: "OPEN_OR_IN_REVIEW", count: getStatusCount(data.ticketsByStatus, ["OPEN", "IN_REVIEW"]) },
        ],
      };
    }
    if (activeBlock === "purchases") {
      return {
        title: "Purchases - Volume Summary",
        rows: [
          { status: "TOTAL_PURCHASES", count: data.totals.purchases },
          { status: "SUCCESSFUL", count: getStatusCount(data.purchasesByStatus, ["SUCCESS", "COMPLETED", "PAID", "CAPTURED"]) },
        ],
      };
    }
    if (activeBlock === "agreementStatus") return { title: "Agreement Status Details", rows: data.agreementsByStatus };
    if (activeBlock === "ticketStatus") return { title: "Ticket Status Details", rows: data.ticketsByStatus };
    if (activeBlock === "purchaseStatus") return { title: "Purchase Status Details", rows: data.purchasesByStatus };

    return { title: "User Metrics", rows: [{ status: "TOTAL_USERS", count: data.totals.users }] };
  }, [activeBlock, data]);

  const metrics = useMemo(() => {
    if (!data) return null;

    const completedAgreements = getStatusCount(data.agreementsByStatus, ["COMPLETED"]);
    const resolvedTickets = getStatusCount(data.ticketsByStatus, ["RESOLVED", "CLOSED"]);
    const openRiskTickets = getStatusCount(data.ticketsByStatus, ["OPEN", "IN_REVIEW"]);
    const successfulPurchases = getStatusCount(data.purchasesByStatus, ["SUCCESS", "COMPLETED", "PAID", "CAPTURED"]);

    return {
      completedAgreements,
      resolvedTickets,
      openRiskTickets,
      successfulPurchases,
      agreementCompletionRate: ratio(completedAgreements, data.totals.agreements),
      ticketResolutionRate: ratio(resolvedTickets, data.totals.tickets),
      purchaseSuccessRate: ratio(successfulPurchases, data.totals.purchases),
      avgRecordsPerUser: data.totals.users > 0
        ? Number(((data.totals.agreements + data.totals.tickets + data.totals.purchases) / data.totals.users).toFixed(2))
        : 0,
    };
  }, [data]);

  if (!data && !isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <h2 className="text-3xl font-bold tracking-tight text-[#122016]">Platform Analytics</h2>
          <p className="mt-2 text-[#5b6a60]">Global KPIs across users, agreements, disputes, and payments.</p>
        </header>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-bold text-red-700">Admin API unavailable.</p>
          <p className="text-xs text-red-600 mt-2 break-all">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-10">
      <header>
        <h2 className="text-3xl font-bold tracking-tight text-[#122016]">Platform Analytics</h2>
        <p className="mt-2 text-[#5b6a60]">Global KPIs across users, agreements, disputes, and payments.</p>
      </header>

      {error ? <p className="text-sm rounded-lg bg-red-50 p-4 text-[#8f1f2f]">{error}</p> : null}
      
      {isLoading ? (
        <div className="h-40 flex items-center justify-center border-2 border-dashed border-[#d9d0bf] rounded-2xl">
          <div className="animate-pulse font-bold text-[#5b6a60]">Gathering Metrics...</div>
        </div>
      ) : null}

      {data && metrics ? (
        <>
          {/* Primary Top KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <button type="button" onClick={() => setActiveBlock("users")} className="group relative overflow-hidden rounded-2xl bg-[#1A2406] p-6 text-left transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-[#D9F24F]/10 border border-transparent hover:border-[#D9F24F]/30">
              <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/5 blur-2xl group-hover:bg-[#D9F24F]/10 transition-colors" />
              <h3 className="text-sm font-medium text-white/60">Total Users</h3>
              <strong className="mt-2 block text-4xl font-black text-white">{data.totals.users}</strong>
            </button>
            
            <button type="button" onClick={() => setActiveBlock("agreements")} className="group relative overflow-hidden rounded-2xl bg-white p-6 text-left transition-all hover:scale-[1.02] hover:shadow-xl border border-[#d9d0bf]">
              <h3 className="text-sm font-medium text-[#5b6a60]">Agreements</h3>
              <strong className="mt-2 block text-4xl font-black text-[#122016]">{data.totals.agreements}</strong>
            </button>

            <button type="button" onClick={() => setActiveBlock("tickets")} className="group relative overflow-hidden rounded-2xl bg-white p-6 text-left transition-all hover:scale-[1.02] hover:shadow-xl border border-[#d9d0bf]">
              <h3 className="text-sm font-medium text-[#5b6a60]">Tickets</h3>
              <strong className="mt-2 block text-4xl font-black text-[#122016]">{data.totals.tickets}</strong>
            </button>

            <button type="button" onClick={() => setActiveBlock("purchases")} className="group relative overflow-hidden rounded-2xl bg-white p-6 text-left transition-all hover:scale-[1.02] hover:shadow-xl border border-[#d9d0bf]">
              <h3 className="text-sm font-medium text-[#5b6a60]">Purchases</h3>
              <strong className="mt-2 block text-4xl font-black text-[#122016]">{data.totals.purchases}</strong>
            </button>
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#d9d0bf] bg-[#fffdf8] p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-[#5b6a60]">Agreement Completion</p>
              <p className="mt-2 text-3xl font-black text-[#1f6a42]">{formatPercent(metrics.agreementCompletionRate)}</p>
              <p className="mt-1 text-sm font-medium text-[#122016]">{metrics.completedAgreements} final deliveries</p>
            </div>
            <div className="rounded-2xl border border-[#d9d0bf] bg-[#fffdf8] p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-[#5b6a60]">Ticket Resolution</p>
              <p className="mt-2 text-3xl font-black text-[#1f6a8f]">{formatPercent(metrics.ticketResolutionRate)}</p>
              <p className="mt-1 text-sm font-medium text-[#122016]">{metrics.resolvedTickets} resolved disputes</p>
            </div>
            <div className="rounded-2xl border border-[#d9d0bf] bg-[#fffdf8] p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-[#5b6a60]">Purchase Success</p>
              <p className="mt-2 text-3xl font-black text-[#6a8f1f]">{formatPercent(metrics.purchaseSuccessRate)}</p>
              <p className="mt-1 text-sm font-medium text-[#122016]">{metrics.successfulPurchases} settled payments</p>
            </div>
            <div className="rounded-2xl border border-[#fde2e2] bg-[#fffafa] p-5 relative overflow-hidden">
              <div className="absolute right-0 top-0 w-2 h-full bg-[#8f1f2f]" />
              <p className="text-xs font-bold uppercase tracking-wider text-[#8f1f2f]">Risk Tickets Warning</p>
              <p className="mt-2 text-3xl font-black text-[#8f1f2f]">{metrics.openRiskTickets}</p>
              <p className="mt-1 text-sm font-medium text-[#122016]">Tickets requiring review</p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <RechartsBarWidget
              title="Agreement Status Flow"
              rows={data.agreementsByStatus}
              onOpen={() => setActiveBlock("agreementStatus")}
            />
            <RechartsBarWidget
              title="Dispute Ticket States"
              rows={data.ticketsByStatus}
              onOpen={() => setActiveBlock("ticketStatus")}
            />
          </div>
          
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <RechartsPieWidget
              title="Purchase Status Ratio"
              rows={data.purchasesByStatus}
              onOpen={() => setActiveBlock("purchaseStatus")}
            />
            
            <article className="rounded-2xl border border-[#d9d0bf] bg-white p-6 shadow-[0_4px_14px_rgba(18,32,22,0.05)]">
              <h3 className="mb-4 text-base font-bold text-[#122016]">System Health Metrics</h3>
              <div className="space-y-4">
                 <div className="flex justify-between items-center border-b border-[#ece6d9] pb-3">
                   <div>
                     <p className="font-bold text-[#122016]">Avg Objects / User</p>
                     <p className="text-xs text-[#5b6a60]">Platform engagement rating</p>
                   </div>
                   <div className="text-lg font-black">{metrics.avgRecordsPerUser}</div>
                 </div>
                 
                 <div className="flex justify-between items-center border-b border-[#ece6d9] pb-3">
                   <div>
                     <p className="font-bold text-[#122016]">Failed vs Total Purchases</p>
                     <p className="text-xs text-[#5b6a60]">Failure deviation rate</p>
                   </div>
                   <div className="text-lg font-black">{formatPercent(100 - metrics.purchaseSuccessRate)}</div>
                 </div>

                 <div className="flex justify-between items-center pb-2">
                   <div>
                     <p className="font-bold text-[#122016]">Open Risk Ratio</p>
                     <p className="text-xs text-[#5b6a60]">Support load percentage</p>
                   </div>
                   <div className="text-lg font-black text-[#8f1f2f]">
                     {formatPercent(ratio(metrics.openRiskTickets, data.totals.tickets))}
                   </div>
                 </div>
              </div>
            </article>
          </div>

        </>
      ) : null}

      <AdminInfoModal
        open={Boolean(activeBlock && blockDetails)}
        title={blockDetails?.title || "Data Viewer"}
        onClose={() => setActiveBlock(null)}
      >
        {blockDetails ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-[#d9d0bf] bg-[#fefcf6] p-4 text-[#122016]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#526157] mb-4">Tabular Breakdown</h4>
              <div className="space-y-2">
                {sortByCount(blockDetails.rows).map((row) => (
                  <div key={row.status} className="flex justify-between items-center border-b border-[#ece6d9] pb-2 last:border-0 last:pb-0">
                    <span className="font-medium text-sm">{row.status}</span>
                    <span className="font-bold font-mono text-sm">{row.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <details className="rounded-xl border border-dashed border-[#d9d0bf] bg-[#fafaf8] p-3 text-[#122016]">
              <summary className="cursor-pointer font-bold text-sm text-[#526157]">Developer Logs (JSON Payload)</summary>
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all text-[11px] font-mono leading-relaxed bg-white p-3 rounded-lg border border-[#ece6d9]">
                {JSON.stringify(data, null, 2)}
              </pre>
            </details>
          </div>
        ) : null}
      </AdminInfoModal>
    </div>
  );
}
