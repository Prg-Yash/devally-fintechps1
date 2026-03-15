"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  CheckCircle2,
  Clock3,
  Coins,
  ExternalLink,
  Loader2,
  MinusCircle,
  PlusCircle,
  Search,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  convertInrToCurrency,
  convertCurrencyToInr,
  formatDisplayCurrency,
  useDisplayCurrencyPreference,
} from "@/lib/display-currency";

const API_BASE_URL = "/api";
const SEPOLIA_TX_BASE_URL = "https://sepolia.etherscan.io/tx/";

type WithdrawStatus = "PENDING" | "COMPLETED" | "FAILED";

type WithdrawalEntry = {
  id: string;
  userId: string;
  walletAddress: string;
  fromAddress?: string;
  burnAddress?: string;
  toWalletAddress?: string;
  toUserAccount?: string;
  amountPcc: number;
  amountInr?: number;
  amountBaseUnits: string;
  txHash: string | null;
  status: WithdrawStatus | string;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

type WithdrawalSummary = {
  claimablePcc: number;
  claimableInr: number;
  totalWithdrawnPcc: number;
  totalWithdrawnInr: number;
  averageWithdrawalInr: number;
  largestWithdrawalInr: number;
  thisMonthWithdrawnInr: number;
  thisMonthWithdrawalCount: number;
  conversionRate: number;
  completedCount: number;
  pendingCount: number;
  failedCount: number;
};

const EMPTY_SUMMARY: WithdrawalSummary = {
  claimablePcc: 0,
  claimableInr: 0,
  totalWithdrawnPcc: 0,
  totalWithdrawnInr: 0,
  averageWithdrawalInr: 0,
  largestWithdrawalInr: 0,
  thisMonthWithdrawnInr: 0,
  thisMonthWithdrawalCount: 0,
  conversionRate: 1,
  completedCount: 0,
  pendingCount: 0,
  failedCount: 0,
};

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const reveal = {
  hidden: { y: 12, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 120, damping: 22 },
  },
};

function formatPcc(value: unknown) {
  const numeric = Number(value ?? 0);
  const safeValue = Number.isFinite(numeric) ? numeric : 0;
  return safeValue.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
}

function shortAddress(value: string) {
  if (value.length < 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function shortHash(value: string) {
  if (value.length < 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function normalizePccInput(value: number) {
  const fixed = value.toFixed(6);
  return fixed.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

const STATUS_STYLE: Record<
  WithdrawStatus,
  { label: string; className: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  COMPLETED: {
    label: "Completed",
    className: "bg-[#1A2406] text-white",
    Icon: CheckCircle2,
  },
  PENDING: {
    label: "Pending",
    className: "bg-white border border-black/[0.05] text-[#CA8A04]",
    Icon: Clock3,
  },
  FAILED: {
    label: "Failed",
    className: "bg-white border border-black/[0.05] text-red-500",
    Icon: XCircle,
  },
};

export default function WithdrawPage() {
  const { data: session } = authClient.useSession();
  const currency = useDisplayCurrencyPreference("INR");

  const [withdrawals, setWithdrawals] = useState<WithdrawalEntry[]>([]);
  const [summary, setSummary] = useState<WithdrawalSummary>(EMPTY_SUMMARY);
  const [withdrawAmountInput, setWithdrawAmountInput] = useState("");
  const [withdrawMode, setWithdrawMode] = useState<"token" | "money">("money");
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | WithdrawStatus>("all");

  const canWithdraw = summary.claimablePcc > 0;

  const claimableInr = summary.claimableInr || summary.claimablePcc;
  const totalWithdrawnInr = summary.totalWithdrawnInr || summary.totalWithdrawnPcc;

  const parsedWithdrawInput = Number(withdrawAmountInput);
  const normalizedInput = Number.isFinite(parsedWithdrawInput) ? parsedWithdrawInput : 0;

  const requestedInr = useMemo(() => {
    if (!Number.isFinite(normalizedInput) || normalizedInput <= 0) {
      return 0;
    }
    if (withdrawMode === "token") {
      const rate = summary.conversionRate > 0 ? summary.conversionRate : 1;
      return normalizedInput / rate;
    }
    return convertCurrencyToInr(normalizedInput, currency);
  }, [normalizedInput, withdrawMode, summary.conversionRate, currency]);

  const requestedPcc = useMemo(() => {
    const rate = summary.conversionRate > 0 ? summary.conversionRate : 1;
    return requestedInr * rate;
  }, [requestedInr, summary.conversionRate]);

  const canSubmitWithdraw = canWithdraw && requestedPcc > 0 && requestedPcc <= summary.claimablePcc;

  const filteredWithdrawals = useMemo(() => {
    const query = search.trim().toLowerCase();

    return withdrawals.filter((item) => {
      const statusOk = statusFilter === "all" || item.status.toUpperCase() === statusFilter;
      if (!statusOk) return false;

      if (!query) return true;

      return (
        item.id.toLowerCase().includes(query) ||
        item.walletAddress.toLowerCase().includes(query) ||
        (item.txHash ?? "").toLowerCase().includes(query)
      );
    });
  }, [withdrawals, statusFilter, search]);

  const loadHistory = async () => {
    if (!session?.user?.id) return;

    try {
      setIsLoadingHistory(true);
      const response = await fetch(`${API_BASE_URL}/withdrawals`, { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as {
        withdrawals?: WithdrawalEntry[];
        summary?: Partial<WithdrawalSummary>;
        error?: string;
      };

      if (!response.ok) {
        if ((data as any)?.code === "DB_CLIENT_OUTDATED") {
          throw new Error(
            "Withdraw backend Prisma client is outdated. Run `npx prisma generate` in packages/db and restart apps/web.",
          );
        }
        throw new Error(data.error || "Failed to load withdrawal history");
      }

      const nextSummary: WithdrawalSummary = {
        claimablePcc: Number(data.summary?.claimablePcc ?? 0),
        claimableInr: Number(data.summary?.claimableInr ?? data.summary?.claimablePcc ?? 0),
        totalWithdrawnPcc: Number(data.summary?.totalWithdrawnPcc ?? 0),
        totalWithdrawnInr: Number(data.summary?.totalWithdrawnInr ?? data.summary?.totalWithdrawnPcc ?? 0),
        averageWithdrawalInr: Number(data.summary?.averageWithdrawalInr ?? 0),
        largestWithdrawalInr: Number(data.summary?.largestWithdrawalInr ?? 0),
        thisMonthWithdrawnInr: Number(data.summary?.thisMonthWithdrawnInr ?? 0),
        thisMonthWithdrawalCount: Number(data.summary?.thisMonthWithdrawalCount ?? 0),
        conversionRate: Number(data.summary?.conversionRate ?? 1),
        completedCount: Number(data.summary?.completedCount ?? 0),
        pendingCount: Number(data.summary?.pendingCount ?? 0),
        failedCount: Number(data.summary?.failedCount ?? 0),
      };

      setWithdrawals(Array.isArray(data.withdrawals) ? data.withdrawals : []);
      setSummary(nextSummary);
      setWithdrawAmountInput(nextSummary.claimablePcc > 0 ? normalizePccInput(nextSummary.claimablePcc) : "");
    } catch (error: any) {
      toast.error(error?.message || "Failed to load withdrawals");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [session?.user?.id]);

  const handleWithdraw = async () => {
    if (!session?.user?.id) {
      toast.error("Please log in to withdraw PCC.");
      return;
    }

    if (summary.claimablePcc <= 0) {
      toast.error("No claimable PCC balance available for withdrawal.");
      return;
    }

    if (!canSubmitWithdraw) {
      toast.error("Enter a valid amount within your claimable balance.");
      return;
    }

    try {
      setIsWithdrawing(true);
      const requestAmount = Number(requestedPcc.toFixed(6));

      const response = await fetch(`${API_BASE_URL}/withdrawals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountPcc: requestAmount,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        withdrawal?: WithdrawalEntry;
      };

      if (!response.ok) {
        throw new Error(data.error || "Withdrawal failed");
      }

      const txHash = data.withdrawal?.txHash;
      if (txHash) {
        toast.success(`Withdrawal successful. Tx ${shortHash(txHash)}`);
      } else {
        toast.success("Withdrawal successful.");
      }

      window.dispatchEvent(new CustomEvent("pcc:purchase-completed"));
      await loadHistory();
      setIsWithdrawModalOpen(false);
    } catch (error: any) {
      toast.error(error?.message || "Withdrawal failed");
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="visible"
      className="mx-auto max-w-6xl space-y-8 pt-2 pb-10"
    >
      <motion.div variants={reveal} className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-[#D9F24F]/10 text-[#1A2406] text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full border border-[#D9F24F]/20 flex items-center gap-1.5 uppercase leading-none">
              <div className="w-1.5 h-1.5 rounded-full bg-[#D9F24F] animate-pulse" />
              PCC Withdrawal Center
            </span>
          </div>
          <h1 className="font-jakarta text-4xl tracking-[-0.04em] text-[#1A2406]">
            <span className="font-light text-[#1A2406]/40">Withdraw </span>
            <span className="font-bold">History</span>
          </h1>
          <p className="font-sans text-[#1A2406]/30 text-sm font-medium">
            Simulate token burn, INR settlement, and track every withdrawal leg.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsWithdrawModalOpen(true)}
          disabled={!canWithdraw || isWithdrawing}
          className="rounded-xl bg-[#1A2406] text-white px-5 py-2.5 text-xs font-bold tracking-tight flex items-center gap-2 shadow-lg shadow-[#1A2406]/10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isWithdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownLeft className="w-4 h-4" />}
          {isWithdrawing ? "Processing..." : "Withdraw Funds"}
        </button>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div variants={reveal} className="rounded-2xl px-5 py-4 bg-white/60 border border-white/70 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
          <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-[#1A2406]/35 mb-2">Claimable (INR Base)</p>
          <p className="font-jakarta text-2xl font-bold tracking-[-0.03em] text-[#1A2406]">{formatDisplayCurrency(claimableInr, currency)}</p>
          <p className="text-[11px] text-[#1A2406]/45 mt-1">INR base: ₹{formatPcc(claimableInr)}</p>
        </motion.div>

        <motion.div variants={reveal} className="rounded-2xl px-5 py-4 bg-[#1A2406] text-white border border-white/5 shadow-[0_12px_30px_rgba(26,36,6,0.18)]">
          <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-white/40 mb-2">Claimable Stablecoins</p>
          <p className="font-jakarta text-2xl font-bold tracking-[-0.03em] text-[#D9F24F]">
            {formatPcc(summary.claimablePcc)} PCC
          </p>
        </motion.div>

        <motion.div variants={reveal} className="rounded-2xl px-5 py-4 bg-white/60 border border-white/70 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
          <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-[#1A2406]/35 mb-2">Total Withdrawn (INR Base)</p>
          <p className="font-jakarta text-2xl font-bold tracking-[-0.03em] text-[#1A2406]">{formatDisplayCurrency(totalWithdrawnInr, currency)}</p>
          <p className="text-[11px] text-[#1A2406]/45 mt-1">INR base: ₹{formatPcc(totalWithdrawnInr)}</p>
        </motion.div>

        <motion.div variants={reveal} className="rounded-2xl px-5 py-4 bg-white/60 border border-white/70 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
          <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-[#1A2406]/35 mb-2">Completed Withdrawals</p>
          <p className="font-jakarta text-2xl font-bold tracking-[-0.03em] text-[#1A2406]">{summary.completedCount}</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div variants={reveal} className="rounded-2xl px-5 py-4 bg-white/60 border border-white/70 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
          <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-[#1A2406]/35 mb-2">Average Withdrawal</p>
          <p className="font-jakarta text-xl font-bold tracking-[-0.03em] text-[#1A2406]">{formatDisplayCurrency(summary.averageWithdrawalInr, currency)}</p>
        </motion.div>
        <motion.div variants={reveal} className="rounded-2xl px-5 py-4 bg-white/60 border border-white/70 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
          <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-[#1A2406]/35 mb-2">Largest Withdrawal</p>
          <p className="font-jakarta text-xl font-bold tracking-[-0.03em] text-[#1A2406]">{formatDisplayCurrency(summary.largestWithdrawalInr, currency)}</p>
        </motion.div>
        <motion.div variants={reveal} className="rounded-2xl px-5 py-4 bg-white/60 border border-white/70 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
          <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-[#1A2406]/35 mb-2">This Month</p>
          <p className="font-jakarta text-xl font-bold tracking-[-0.03em] text-[#1A2406]">{formatDisplayCurrency(summary.thisMonthWithdrawnInr, currency)}</p>
          <p className="text-[11px] text-[#1A2406]/45 mt-1">{summary.thisMonthWithdrawalCount} withdrawals</p>
        </motion.div>
      </div>

      <motion.div variants={reveal} className="rounded-2xl border border-[#e5ddce] bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] uppercase text-[#1A2406]/40">Withdraw Setup</p>
            <p className="text-sm text-[#1A2406]/60 mt-1">Withdrawals burn stablecoins and settle equivalent money in simulation.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              const inrMax = summary.claimableInr || summary.claimablePcc;
              const moneyMax = convertInrToCurrency(inrMax, currency);
              setWithdrawAmountInput(normalizePccInput(withdrawMode === "token" ? summary.claimablePcc : moneyMax));
            }}
            className="rounded-lg border border-[#d9d0bf] px-3 py-1.5 text-xs font-semibold text-[#1A2406]"
          >
            Use Max
          </button>
        </div>

        <div className="rounded-xl border border-[#d9d0bf] bg-[#fcfbf8] px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-[#1A2406]/40">Settlement Route</p>
          <p className="mt-2 text-sm font-semibold text-[#1A2406] break-all">
            Stablecoin Burn Simulation {"->"} Fiat Settlement Simulation
          </p>
        </div>

        {summary.claimablePcc <= 0 ? (
          <p className="text-xs text-[#1A2406]/45">
            Withdraw is enabled only when claimable INR is greater than 0.
          </p>
        ) : null}
      </motion.div>

      <div className="space-y-5">
        <motion.div variants={reveal} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="font-jakarta text-xl font-bold tracking-[-0.04em] text-[#1A2406]">Withdrawal Ledger</h2>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#1A2406]/25" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by user or tx hash"
                className="pl-9 pr-4 py-2.5 text-xs font-medium bg-white/60 border border-black/[0.04] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9F24F]/40 w-56"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | WithdrawStatus)}
              className="px-3 py-2.5 text-xs font-bold bg-white/60 border border-black/[0.04] rounded-xl text-[#1A2406]/70"
            >
              <option value="all">All</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </motion.div>

        <div className="space-y-2.5">
          {isLoadingHistory ? (
            <div className="bg-white/50 border border-[#ece6d9] rounded-2xl p-8 text-center text-sm text-[#526157]">
              Loading withdrawal history...
            </div>
          ) : null}

          {!isLoadingHistory && filteredWithdrawals.length === 0 ? (
            <div className="bg-white/40 border border-dashed border-[#1A2406]/10 rounded-2xl p-10 text-center">
              <p className="font-jakarta text-lg font-bold text-[#1A2406]/40 tracking-tight">No withdrawals found.</p>
            </div>
          ) : null}

          {!isLoadingHistory
            ? filteredWithdrawals.map((entry) => {
              const normalizedStatus = (entry.status.toUpperCase() as WithdrawStatus) || "PENDING";
              const statusCfg = STATUS_STYLE[normalizedStatus] ?? STATUS_STYLE.PENDING;

              return (
                <motion.div
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/70 border border-black/[0.03] rounded-2xl px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <p className="font-jakarta font-bold text-[#1A2406] text-base tracking-tight flex items-center gap-2 flex-wrap">
                      <Coins className="w-4 h-4 text-[#1A2406]/50" />
                      {formatDisplayCurrency(entry.amountInr ?? entry.amountPcc, currency)}
                    </p>
                    <p className="text-[11px] text-[#1A2406]/40">
                      {formatDisplayCurrency(entry.amountInr ?? entry.amountPcc, currency)}
                    </p>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1A2406]/35 break-all">
                      From: {shortAddress(entry.fromAddress || "-")}
                    </p>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1A2406]/35 break-all">
                      Burn: {shortAddress(entry.burnAddress || "-")}
                    </p>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1A2406]/35 break-all">
                      Settlement: {shortAddress(entry.toWalletAddress || entry.walletAddress)}
                    </p>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1A2406]/35 break-all">
                      To User: {entry.toUserAccount || entry.userId}
                    </p>
                    <p className="text-[11px] text-[#1A2406]/35">
                      {new Date(entry.createdAt).toLocaleString("en-IN")}
                    </p>
                    {entry.failureReason ? (
                      <p className="text-xs text-red-600">{entry.failureReason}</p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap md:justify-end">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-extrabold tracking-[0.16em] uppercase ${statusCfg.className}`}>
                      <statusCfg.Icon className="w-3 h-3" />
                      {statusCfg.label}
                    </span>

                    {entry.txHash ? (
                      <a
                        href={`${SEPOLIA_TX_BASE_URL}${entry.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] px-2.5 py-1.5 text-xs font-semibold text-[#1A2406]/70 hover:text-[#1A2406]"
                      >
                        {shortHash(entry.txHash)}
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : null}
                  </div>
                </motion.div>
              );
            })
            : null}
        </div>
      </div>

      {isWithdrawModalOpen ? (
        <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-[1px] flex items-center justify-center px-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#d9d0bf] bg-white p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-jakarta text-xl font-bold text-[#1A2406]">Withdraw Simulation</h3>
              <button
                type="button"
                className="rounded-md border border-[#d9d0bf] px-2 py-1 text-xs font-semibold"
                onClick={() => setIsWithdrawModalOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-xs font-bold ${withdrawMode === "money" ? "bg-[#1A2406] text-white" : "bg-[#f6f3eb] text-[#1A2406]"}`}
                onClick={() => setWithdrawMode("money")}
              >
                <PlusCircle className="w-3.5 h-3.5 inline mr-1" /> Money ({currency})
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-xs font-bold ${withdrawMode === "token" ? "bg-[#1A2406] text-white" : "bg-[#f6f3eb] text-[#1A2406]"}`}
                onClick={() => setWithdrawMode("token")}
              >
                <MinusCircle className="w-3.5 h-3.5 inline mr-1" /> Tokens (PCC)
              </button>
            </div>

            <div>
              <p className="text-xs font-semibold text-[#1A2406]/60 mb-2">
                Enter amount in {withdrawMode === "token" ? "PCC" : currency}
              </p>
              <input
                value={withdrawAmountInput}
                onChange={(event) => setWithdrawAmountInput(event.target.value)}
                className="w-full rounded-xl border border-[#d9d0bf] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D9F24F]/40"
                placeholder="0"
                inputMode="decimal"
              />
            </div>

            <div className="rounded-xl border border-[#d9d0bf] bg-[#fcfbf8] p-3 space-y-1.5 text-xs text-[#1A2406]/75">
              <p>Requested burn: {formatPcc(requestedPcc)} PCC</p>
              <p>Requested settlement: {formatDisplayCurrency(requestedInr, currency)}</p>
              <p>INR base: ₹{formatPcc(requestedInr)}</p>
              <p>Claimable burn: {formatPcc(summary.claimablePcc)} PCC</p>
            </div>

            {!canSubmitWithdraw ? (
              <p className="text-xs text-[#8f1f2f]">
                Enter a positive amount within available claimable balance.
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleWithdraw}
              disabled={!canSubmitWithdraw || isWithdrawing}
              className="w-full rounded-xl bg-[#1A2406] text-white px-4 py-2.5 text-sm font-bold disabled:opacity-50"
            >
              {isWithdrawing ? "Processing..." : "Confirm Withdraw"}
            </button>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
