"use client";

import { useEffect, useMemo, useState } from "react";
import AdminInfoModal from "@/app/components/admin-info-modal";
import { Activity, AlertTriangle, Gauge, Layers3, ShieldCheck, TrendingUp, Users2 } from "lucide-react";
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

const getTopStatus = (rows: StatusCount[]) => {
  if (!rows.length) return { status: "N/A", count: 0 };
  return sortByCount(rows)[0];
};

function RechartsBarWidget({
  title,
  rows,
  onOpen,
}: {
  title: string;
  rows: StatusCount[];
  onOpen: () => void;
}) {
  const chartId = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const sorted = sortByCount(rows).map(row => ({
    ...row,
    color: statusWeightColor[row.status.toUpperCase()] ?? "#8884d8"
  }));
  const lead = getTopStatus(rows);

  return (
    <article className="flex h-96 flex-col overflow-hidden rounded-[34px] bg-white shadow-[0_18px_38px_-14px_rgba(26,36,6,0.34)]">
      <div className="flex items-start justify-between border-b border-[#1A2406]/10 bg-[#F7F8F2] px-5 py-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-[#1A2406]/72">{title}</h3>
          <p className="mt-1 text-xs text-[#1A2406]/55">
            Lead status: <span className="font-semibold text-[#1A2406]">{lead.status}</span> ({lead.count})
          </p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="rounded-full border border-[#1A2406]/14 bg-white px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#1A2406] transition-colors hover:bg-[#eef2e4]"
        >
          View Details
        </button>
      </div>

      <div className="min-h-0 w-full flex-1 px-4 pb-4 pt-3">
        <div className="h-full w-full rounded-2xl border border-[#d9dfcf] bg-[#f9faf6] p-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sorted} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
            <defs>
              {sorted.map((entry, index) => (
                <linearGradient key={`bar-gradient-${chartId}-${index}`} id={`bar-gradient-${chartId}-${index}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#e4ebc7" stopOpacity={0.95} />
                  <stop offset="100%" stopColor={entry.color} stopOpacity={0.95} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="2 4" horizontal={false} stroke="#d8dfd3" />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#1A240699" }} axisLine={{ stroke: "#d8dfd3" }} tickLine={{ stroke: "#d8dfd3" }} />
            <YAxis dataKey="status" type="category" tick={{ fontSize: 11, fill: "#1A2406", fontWeight: 700 }} width={92} axisLine={false} tickLine={false} />
            <Tooltip 
              cursor={{ fill: "rgba(26,36,6,0.06)" }}
              contentStyle={{
                borderRadius: "14px",
                border: "1px solid rgba(26,36,6,0.15)",
                background: "#ffffff",
                color: "#1A2406",
                fontWeight: 700,
                fontSize: "12px",
              }}
              itemStyle={{ color: "#1A2406", fontWeight: 700 }}
              labelStyle={{ color: "#1A240699", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase" }}
              formatter={(value) => [value, "Count"]}
            />
            <Bar dataKey="count" radius={[0, 8, 8, 0]}>
              {sorted.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={`url(#bar-gradient-${chartId}-${index})`} stroke="#1A240622" strokeWidth={1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        </div>
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
  const chartId = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const sorted = sortByCount(rows).map(row => ({
    ...row,
    color: statusWeightColor[row.status.toUpperCase()] ?? "#8884d8",
    name: row.status
  }));

  const total = sorted.reduce((sum, item) => sum + item.count, 0);
  const lead = getTopStatus(rows);

  return (
    <article className="flex h-96 flex-col overflow-hidden rounded-[34px] bg-white shadow-[0_18px_38px_-14px_rgba(26,36,6,0.34)]">
      <div className="flex items-start justify-between border-b border-[#1A2406]/10 bg-[#F7F8F2] px-5 py-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-[#1A2406]/72">{title}</h3>
          <p className="mt-1 text-xs text-[#1A2406]/55">
            Dominant status: <span className="font-semibold text-[#1A2406]">{lead.status}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="rounded-full border border-[#1A2406]/14 bg-white px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#1A2406] transition-colors hover:bg-[#eef2e4]"
        >
          View Details
        </button>
      </div>

      <div className="relative min-h-0 w-full flex-1 px-4 pb-4 pt-3">
        <div className="h-full w-full rounded-2xl border border-[#d9dfcf] bg-[#f9faf6] p-3">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {sorted.map((entry, index) => (
                <linearGradient key={`pie-gradient-${chartId}-${index}`} id={`pie-gradient-${chartId}-${index}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#e4ebc7" stopOpacity={0.95} />
                  <stop offset="100%" stopColor={entry.color} stopOpacity={0.95} />
                </linearGradient>
              ))}
            </defs>
            <Pie
              data={sorted}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={3}
              dataKey="count"
              stroke="#f9faf6"
              strokeWidth={2}
            >
              {sorted.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={`url(#pie-gradient-${chartId}-${index})`} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{
                borderRadius: "14px",
                border: "1px solid rgba(26,36,6,0.15)",
                background: "#ffffff",
                color: "#1A2406",
                boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
              }}
              itemStyle={{ color: "#1A2406", fontWeight: 700 }}
              labelStyle={{ color: "#1A240699", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase" }}
              formatter={(value) => [value, "Count"]}
            />
            <Legend
              verticalAlign="bottom"
              height={42}
              iconType="circle"
              wrapperStyle={{ color: "#1A2406", fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em" }}
            />
          </PieChart>
        </ResponsiveContainer>
        </div>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-8">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-black/70">Total</span>
            <span className="text-2xl font-black text-black">{total}</span>
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
      <div className="flex flex-col gap-6 pb-10">
        <header className="rounded-[40px] border border-[#d9dfcf] bg-transparent px-6 py-8 text-[#121212]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/60">Executive View</p>
            <h2 className="mt-3 text-4xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-black">Platform Analytics</h2>
            <p className="mt-2 max-w-2xl text-sm text-black/75">Global KPIs across users, agreements, disputes, and payments.</p>
          </div>
        </header>
        <div className="rounded-[28px] border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-bold text-red-700">Admin API unavailable.</p>
          <p className="text-xs text-red-600 mt-2 break-all">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7 pb-10">
      <header className="rounded-[40px] border border-[#d9dfcf] bg-transparent px-6 py-8 text-[#121212]">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/60">Executive View</p>
            <h2 className="mt-3 text-4xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-black md:text-5xl">Platform Analytics</h2>
            <p className="mt-2 max-w-2xl text-sm text-black/75">Global KPIs across users, agreements, disputes, and payments.</p>
          </div>

          {data && metrics ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-[#d9dfcf] bg-white px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-black/60">Agreement Completion</p>
                <p className="mt-1 text-xl font-black text-black">{formatPercent(metrics.agreementCompletionRate)}</p>
              </div>
              <div className="rounded-2xl border border-[#d9dfcf] bg-white px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-black/60">Ticket Resolution</p>
                <p className="mt-1 text-xl font-black text-black">{formatPercent(metrics.ticketResolutionRate)}</p>
              </div>
              <div className="rounded-2xl border border-[#d9dfcf] bg-white px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-black/60">Purchase Success</p>
                <p className="mt-1 text-xl font-black text-black">{formatPercent(metrics.purchaseSuccessRate)}</p>
              </div>
              <div className="rounded-2xl border border-[#d9dfcf] bg-white px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-black/60">Open Risk Ratio</p>
                <p className="mt-1 text-xl font-black text-black">{formatPercent(ratio(metrics.openRiskTickets, data.totals.tickets))}</p>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      {error ? <p className="text-sm rounded-lg bg-red-50 p-4 text-[#8f1f2f]">{error}</p> : null}
      
      {isLoading ? (
        <div className="flex h-40 items-center justify-center rounded-[28px] border-2 border-dashed border-[#d9d0bf] bg-[#f7f8f2]">
          <div className="animate-pulse font-bold uppercase tracking-widest text-[#5b6a60]">Gathering Metrics...</div>
        </div>
      ) : null}

      {data && metrics ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              onClick={() => setActiveBlock("users")}
              className="group relative overflow-hidden rounded-[28px] border border-[#d7e2cc] bg-white p-6 text-left text-black shadow-[0_14px_30px_-14px_rgba(26,36,6,0.26)] transition-all hover:-translate-y-0.5"
            >
              <Users2 className="relative h-5 w-5 text-[#5b6a60]" />
              <h3 className="relative mt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5b6a60]">Total Users</h3>
              <strong className="relative mt-2 block text-4xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-black">{data.totals.users}</strong>
            </button>

            <button
              type="button"
              onClick={() => setActiveBlock("agreements")}
              className="group rounded-[28px] border border-[#d7e2cc] bg-white p-6 text-left shadow-[0_14px_30px_-14px_rgba(26,36,6,0.26)] transition-all hover:-translate-y-0.5"
            >
              <Layers3 className="h-5 w-5 text-[#5b6a60]" />
              <h3 className="mt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5b6a60]">Agreements</h3>
              <strong className="mt-2 block text-4xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-[#122016]">{data.totals.agreements}</strong>
            </button>

            <button
              type="button"
              onClick={() => setActiveBlock("tickets")}
              className="group rounded-[28px] border border-[#d7e2cc] bg-white p-6 text-left shadow-[0_14px_30px_-14px_rgba(26,36,6,0.26)] transition-all hover:-translate-y-0.5"
            >
              <ShieldCheck className="h-5 w-5 text-[#5b6a60]" />
              <h3 className="mt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5b6a60]">Tickets</h3>
              <strong className="mt-2 block text-4xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-[#122016]">{data.totals.tickets}</strong>
            </button>

            <button
              type="button"
              onClick={() => setActiveBlock("purchases")}
              className="group rounded-[28px] border border-[#d7e2cc] bg-white p-6 text-left shadow-[0_14px_30px_-14px_rgba(26,36,6,0.26)] transition-all hover:-translate-y-0.5"
            >
              <Activity className="h-5 w-5 text-[#5b6a60]" />
              <h3 className="mt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5b6a60]">Purchases</h3>
              <strong className="mt-2 block text-4xl font-medium tracking-[-0.04em] [font-family:var(--font-jakarta)] text-[#122016]">{data.totals.purchases}</strong>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[26px] border border-[#d7e2cc] bg-white p-5 shadow-[0_14px_30px_-14px_rgba(26,36,6,0.24)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5b6a60]">Agreement Completion</p>
              <p className="mt-2 text-3xl font-black text-[#1f6a42]">{formatPercent(metrics.agreementCompletionRate)}</p>
              <p className="mt-1 text-sm font-medium text-[#122016]">{metrics.completedAgreements} final deliveries</p>
            </div>
            <div className="rounded-[26px] border border-[#d7e2cc] bg-white p-5 shadow-[0_14px_30px_-14px_rgba(26,36,6,0.24)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5b6a60]">Ticket Resolution</p>
              <p className="mt-2 text-3xl font-black text-[#1f6a8f]">{formatPercent(metrics.ticketResolutionRate)}</p>
              <p className="mt-1 text-sm font-medium text-[#122016]">{metrics.resolvedTickets} resolved disputes</p>
            </div>
            <div className="rounded-[26px] border border-[#d7e2cc] bg-white p-5 shadow-[0_14px_30px_-14px_rgba(26,36,6,0.24)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5b6a60]">Purchase Success</p>
              <p className="mt-2 text-3xl font-black text-[#6a8f1f]">{formatPercent(metrics.purchaseSuccessRate)}</p>
              <p className="mt-1 text-sm font-medium text-[#122016]">{metrics.successfulPurchases} settled payments</p>
            </div>
            <div className="relative overflow-hidden rounded-[26px] border border-[#f1d4d8] bg-[#fff7f8] p-5 shadow-[0_14px_30px_-14px_rgba(143,31,47,0.2)]">
              <div className="absolute right-0 top-0 h-full w-2 bg-[#8f1f2f]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8f1f2f]">Risk Tickets Warning</p>
              <p className="mt-2 text-3xl font-black text-[#8f1f2f]">{metrics.openRiskTickets}</p>
              <p className="mt-1 text-sm font-medium text-[#122016]">Tickets requiring review</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <article className="rounded-[30px] bg-white p-5 text-black shadow-[0_18px_34px_-14px_rgba(26,36,6,0.32)]">
              <div className="inline-flex rounded-full bg-[#eef2eb] p-2 text-black"><TrendingUp className="h-4 w-4" /></div>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-black/65">Growth Signal</p>
              <p className="mt-1 text-2xl font-black text-black">{formatPercent((metrics.agreementCompletionRate + metrics.purchaseSuccessRate) / 2)}</p>
              <p className="mt-1 text-xs text-black/70">Composite index from delivery completion and payment outcomes.</p>
            </article>
            <article className="rounded-[30px] bg-white p-5 shadow-[0_18px_34px_-14px_rgba(26,36,6,0.32)]">
              <div className="inline-flex rounded-full bg-[#E7F5EA] p-2 text-[#1E6A3F]"><Gauge className="h-4 w-4" /></div>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5b6a60]">Load Per User</p>
              <p className="mt-1 text-2xl font-black text-[#122016]">{metrics.avgRecordsPerUser}</p>
              <p className="mt-1 text-xs text-[#5b6a60]">Average agreements, tickets, and purchases per registered user.</p>
            </article>
            <article className="rounded-[30px] bg-white p-5 text-black shadow-[0_18px_34px_-14px_rgba(26,36,6,0.32)]">
              <div className="inline-flex rounded-full bg-[#eef2eb] p-2 text-black"><AlertTriangle className="h-4 w-4" /></div>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-black/65">Risk Pressure</p>
              <p className="mt-1 text-2xl font-black text-black">{formatPercent(ratio(metrics.openRiskTickets, data.totals.tickets))}</p>
              <p className="mt-1 text-xs text-black/70">Percentage of tickets in open or in-review states.</p>
            </article>
          </div>

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
            
            <article className="overflow-hidden rounded-[34px] bg-white shadow-[0_18px_38px_-14px_rgba(26,36,6,0.34)]">
              <div className="border-b border-[#1A2406]/10 bg-[#F7F8F2] px-5 py-4">
                <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-[#1A2406]/72">System Health Metrics</h3>
              </div>
              <div className="space-y-4 px-5 py-5">
                <div className="flex items-center justify-between border-b border-[#ece6d9] pb-3">
                  <div>
                    <p className="font-bold text-[#122016]">Avg Objects / User</p>
                    <p className="text-xs text-[#5b6a60]">Platform engagement rating</p>
                  </div>
                  <div className="text-lg font-black">{metrics.avgRecordsPerUser}</div>
                </div>

                <div className="flex items-center justify-between border-b border-[#ece6d9] pb-3">
                  <div>
                    <p className="font-bold text-[#122016]">Failed vs Total Purchases</p>
                    <p className="text-xs text-[#5b6a60]">Failure deviation rate</p>
                  </div>
                  <div className="text-lg font-black">{formatPercent(100 - metrics.purchaseSuccessRate)}</div>
                </div>

                <div className="flex items-center justify-between pb-2">
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
            <div className="rounded-2xl border border-[#d9d0bf] bg-[#fefcf6] p-4 text-[#122016]">
              <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-[#526157]">Tabular Breakdown</h4>
              <div className="space-y-2">
                {sortByCount(blockDetails.rows).map((row) => (
                  <div key={row.status} className="flex items-center justify-between border-b border-[#ece6d9] pb-2 last:border-0 last:pb-0">
                    <span className="text-sm font-medium">{row.status}</span>
                    <span className="font-mono text-sm font-bold">{row.count}</span>
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
