"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownLeft,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  Download,
  Search,
  Filter,
  ExternalLink,
  Server,
} from "lucide-react";

// ─── Animation Variants ──────────────────────────────────────────────────────
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

// ─── Static Stat Cards data ───────────────────────────────────────────────────
const STAT_CARDS = [
  { label: "Total Withdrawn",   value: "₹1,24,380.00" },
  { label: "Active Protocols",  value: "13",            dark: true },
  { label: "Live PCC Balance",  value: "3,595 PCC" },
  { label: "Awaiting Proof",    value: "3" },
  { label: "Total Nodes PCC",   value: "3,595 PCC" },
  { label: "Completed Txns",    value: "9" },
];

// ─── Static Staking Nodes ────────────────────────────────────────────────────
const NODES = [
  { id: "n1", name: "Main Trading Node",  address: "0x7A59…3F92", pcc: "1,820 PCC", liquidity: "₹29,001.00", currency: "USDC", primary: true  },
  { id: "n2", name: "Savings Vault",      address: "0x3B12…9A41", pcc: "970 PCC",   liquidity: "₹1,00,000.00", currency: "USDC", primary: false },
  { id: "n3", name: "Growth Escrow",      address: "0x9C88…1D05", pcc: "805 PCC",   liquidity: "₹641.50",    currency: "USDT", primary: false },
];

// ─── Static Transactions ─────────────────────────────────────────────────────
type TxStatus = "completed" | "pending" | "failed";

interface Tx {
  id: string;
  walletName: string;
  pcc: string;
  inr: string;
  txHash: string;
  date: string;
  status: TxStatus;
}

const ALL_TXS: Tx[] = [
  { id: "WD-0001", walletName: "Main Trading Node",  pcc: "2,400 PCC", inr: "₹6,240.00",  txHash: "0xa1b2c3d4…1f2e", date: "Mar 14, 2026", status: "completed" },
  { id: "WD-0002", walletName: "Savings Vault",      pcc: "800 PCC",   inr: "₹2,080.00",  txHash: "0xde3f2a1b…9c4d", date: "Mar 12, 2026", status: "pending"   },
  { id: "WD-0003", walletName: "Growth Escrow",      pcc: "3,100 PCC", inr: "₹8,060.00",  txHash: "0x5f8a1c2e…b3a2", date: "Mar 10, 2026", status: "completed" },
  { id: "WD-0004", walletName: "Main Trading Node",  pcc: "500 PCC",   inr: "₹1,300.00",  txHash: "0x7e9d0f3c…4a1b", date: "Mar 07, 2026", status: "failed"    },
  { id: "WD-0005", walletName: "Savings Vault",      pcc: "1,200 PCC", inr: "₹3,120.00",  txHash: "0x2c4e6a8b…f0d1", date: "Mar 05, 2026", status: "completed" },
  { id: "WD-0006", walletName: "Growth Escrow",      pcc: "4,750 PCC", inr: "₹12,350.00", txHash: "0xb3d5f7a9…e2c0", date: "Feb 28, 2026", status: "completed" },
  { id: "WD-0007", walletName: "Main Trading Node",  pcc: "300 PCC",   inr: "₹780.00",    txHash: "0x1a3c5e7f…9b8d", date: "Feb 25, 2026", status: "pending"   },
  { id: "WD-0008", walletName: "Savings Vault",      pcc: "2,000 PCC", inr: "₹5,200.00",  txHash: "0x8f0e1d2c…3a4b", date: "Feb 20, 2026", status: "completed" },
  { id: "WD-0009", walletName: "Growth Escrow",      pcc: "650 PCC",   inr: "₹1,690.00",  txHash: "0x4b6d8f0a…c2e1", date: "Feb 15, 2026", status: "failed"    },
  { id: "WD-0010", walletName: "Main Trading Node",  pcc: "3,900 PCC", inr: "₹10,140.00", txHash: "0xc9e0f1a2…b3d4", date: "Feb 10, 2026", status: "completed" },
  { id: "WD-0011", walletName: "Savings Vault",      pcc: "1,050 PCC", inr: "₹2,730.00",  txHash: "0x6d8f0e1b…2c3a", date: "Feb 06, 2026", status: "completed" },
  { id: "WD-0012", walletName: "Growth Escrow",      pcc: "420 PCC",   inr: "₹1,092.00",  txHash: "0xe2f4a6b8…0d1c", date: "Jan 30, 2026", status: "pending"   },
];

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: TxStatus }) => {
  const cfg = {
    completed: { label: "COMPLETED", Icon: CheckCircle2, cls: "bg-[#1A2406] text-white" },
    pending:   { label: "PENDING",   Icon: Clock,        cls: "bg-white border border-black/[0.05] text-[#CA8A04]" },
    failed:    { label: "FAILED",    Icon: XCircle,      cls: "bg-white border border-black/[0.05] text-red-500" },
  }[status];
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[8px] font-extrabold tracking-[0.18em] uppercase ${cfg.cls}`}>
      <cfg.Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function WithdrawPage() {
  const [search,  setSearch]  = useState("");
  const [filter,  setFilter]  = useState<"all" | TxStatus>("all");
  const [filterOpen, setFilterOpen] = useState(false);

  const filtered = ALL_TXS.filter((tx) => {
    const okStatus = filter === "all" || tx.status === filter;
    const q = search.toLowerCase();
    const okSearch = !q || tx.id.toLowerCase().includes(q) || tx.walletName.toLowerCase().includes(q) || tx.txHash.toLowerCase().includes(q);
    return okStatus && okSearch;
  });

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="visible"
      className="mx-auto max-w-6xl space-y-8 pt-2 pb-12"
    >
      {/* ── Header ── */}
      <motion.div variants={reveal} className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-[#D9F24F]/10 text-[#1A2406] text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full border border-[#D9F24F]/20 flex items-center gap-1.5 uppercase leading-none">
              <div className="w-1.5 h-1.5 rounded-full bg-[#D9F24F] animate-pulse" />
              PCC Withdraw Ledger
            </span>
          </div>
          <h1 className="font-jakarta text-4xl tracking-[-0.04em] text-[#1A2406]">
            <span className="font-light text-[#1A2406]/40">Withdraw </span>
            <span className="font-bold">History</span>
          </h1>
          <p className="font-sans text-[#1A2406]/30 text-sm font-medium">
            All PCC withdrawal records across every staking node
          </p>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            className="rounded-xl border border-black/[0.04] bg-white text-[#1A2406] px-5 py-2.5 text-xs font-bold tracking-tight hover:bg-[#FAFAF9] transition-all flex items-center gap-2 shadow-sm"
          >
            <Download className="w-4 h-4" /> Export CSV
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            className="rounded-xl bg-[#1A2406] text-white px-5 py-2.5 text-xs font-bold tracking-tight flex items-center gap-2 shadow-lg shadow-[#1A2406]/10"
          >
            <ArrowDownLeft className="w-4 h-4" /> Initiate Withdrawal
          </motion.button>
        </div>
      </motion.div>

      {/* ── 3×2 Stat Widgets ── */}
      <div className="grid grid-cols-3 gap-4">
        {STAT_CARDS.map((card) => (
          <motion.div
            key={card.label}
            variants={reveal}
            className={`relative rounded-2xl px-5 py-4 overflow-hidden
              ${card.dark
                ? "bg-[#1A2406] text-white shadow-[0_12px_30px_rgba(26,36,6,0.18)] border border-white/5"
                : "bg-white/50 backdrop-blur-xl border border-white/70 shadow-[0_4px_20px_rgb(0,0,0,0.02)]"
              }`}
          >
            {card.dark && (
              <>
                <div className="absolute inset-0 bg-gradient-to-tr from-[#D9F24F]/10 via-transparent to-transparent pointer-events-none" />
                <div className="absolute -top-8 -right-8 w-24 h-24 bg-[#D9F24F]/15 blur-[50px] rounded-full pointer-events-none" />
              </>
            )}
            <p className={`text-[9px] font-bold tracking-[0.18em] uppercase mb-2 relative z-10 ${card.dark ? "text-white/40" : "text-[#1A2406]/35"}`}>
              {card.label}
            </p>
            <p className={`font-jakarta text-2xl font-bold tracking-[-0.03em] relative z-10 leading-none ${card.dark ? "text-[#D9F24F]" : "text-[#1A2406]"}`}>
              {card.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* ── Integrated Staking Nodes ── */}
      <motion.div variants={stagger} className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-jakarta text-xl font-bold tracking-[-0.04em] text-[#1A2406]">
            Integrated Staking Nodes
          </h2>
          <button className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1A2406]/30 hover:text-[#1A2406] transition-all flex items-center gap-1.5 active:scale-95">
            Node Registry <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {NODES.map((node) => (
            <motion.div
              key={node.id}
              variants={reveal}
              whileHover={{ scale: 1.01, transition: { type: "spring", stiffness: 300, damping: 30 } }}
              className={`relative rounded-2xl px-5 py-4 overflow-hidden transition-all duration-200
                ${node.primary
                  ? "bg-[#1A2406] text-white shadow-[0_12px_30px_rgba(26,36,6,0.18)] border border-white/5"
                  : "bg-white/50 backdrop-blur-xl border border-white/70 shadow-[0_4px_20px_rgb(0,0,0,0.02)]"
                }`}
            >
              {node.primary && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#D9F24F]/10 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute -top-8 -right-8 w-24 h-24 bg-[#D9F24F]/15 blur-[50px] rounded-full pointer-events-none" />
                </>
              )}

              {/* Card name row */}
              <div className={`flex items-center justify-between mb-2 relative z-10`}>
                <p className={`text-[9px] font-bold tracking-[0.18em] uppercase ${node.primary ? "text-white/40" : "text-[#1A2406]/35"}`}>
                  {node.name}
                </p>
                {node.primary && (
                  <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#1A2406] bg-[#D9F24F] px-2 py-0.5 rounded-full leading-none">
                    Primary
                  </span>
                )}
              </div>

              {/* PCC value */}
              <p className={`font-jakarta text-2xl font-bold tracking-[-0.03em] relative z-10 leading-none ${node.primary ? "text-[#D9F24F]" : "text-[#1A2406]"}`}>
                {node.pcc}
              </p>

              {/* Address + liquidity */}
              <div className={`flex items-center justify-between mt-2.5 relative z-10`}>
                <p className={`font-mono text-[9px] tracking-[0.06em] ${node.primary ? "text-white/25" : "text-[#1A2406]/25"}`}>
                  {node.address}
                </p>
                <p className={`text-[9px] font-bold ${node.primary ? "text-white/30" : "text-[#1A2406]/30"}`}>
                  {node.liquidity} <span className="opacity-60">{node.currency}</span>
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Historical Settlement Ledger ── */}
      <div className="space-y-5">
        <motion.div variants={reveal} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="font-jakarta text-xl font-bold tracking-[-0.04em] text-[#1A2406]">
            Historical Settlement Ledger
          </h2>

          {/* Search & Filter */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#1A2406]/25" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by ID, wallet, hash…"
                className="pl-9 pr-4 py-2.5 text-xs font-medium bg-white/60 border border-black/[0.04] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9F24F]/40 focus:border-[#D9F24F]/40 w-52 placeholder:text-[#1A2406]/20 text-[#1A2406]"
              />
            </div>

            <div className="relative">
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white/60 border border-black/[0.04] rounded-xl text-xs font-bold text-[#1A2406]/40 hover:text-[#1A2406] transition-all"
              >
                <Filter className="w-3.5 h-3.5" />
                {filter === "all" ? "All" : filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
              <AnimatePresence>
                {filterOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.16 }}
                    className="absolute right-0 top-full mt-2 bg-white border border-black/[0.04] rounded-2xl shadow-xl shadow-black/5 overflow-hidden z-20 w-36"
                  >
                    {(["all", "completed", "pending", "failed"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => { setFilter(s); setFilterOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-bold capitalize transition-colors ${filter === s ? "bg-[#1A2406] text-white" : "text-[#1A2406]/50 hover:bg-[#1A2406]/5 hover:text-[#1A2406]"}`}
                      >
                        {s}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* Transaction rows */}
        <div className="space-y-2.5">
          <AnimatePresence mode="popLayout">
            {filtered.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="bg-white/40 backdrop-blur-md border border-dashed border-[#1A2406]/5 rounded-[28px] p-16 text-center"
              >
                <p className="font-jakarta text-xl font-bold text-[#1A2406]/30 tracking-[-0.03em]">No records match your filter.</p>
              </motion.div>
            ) : filtered.map((tx) => (
              <motion.div
                key={tx.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                whileHover={{ x: 3, backgroundColor: "rgba(255,255,255,0.92)" }}
                transition={{ type: "spring", stiffness: 260, damping: 28 }}
                className="bg-white/60 backdrop-blur-md border border-black/[0.02] px-5 py-4 rounded-[20px] flex flex-col md:flex-row md:items-center justify-between shadow-[0_2px_12px_rgb(0,0,0,0.01)] gap-4 group"
              >
                {/* Left */}
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    tx.status === "completed" ? "bg-[#16A34A]/6 text-[#16A34A]" :
                    tx.status === "pending"   ? "bg-[#CA8A04]/6 text-[#CA8A04]" :
                                               "bg-red-500/6 text-red-500"
                  }`}>
                    {tx.status === "completed" ? <CheckCircle2 className="w-4.5 h-4.5" /> :
                     tx.status === "pending"   ? <Clock        className="w-4.5 h-4.5" /> :
                                                 <XCircle      className="w-4.5 h-4.5" />}
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-jakarta font-bold text-[#1A2406] text-base tracking-tight">{tx.pcc}</p>
                      <span className="text-[9px] font-bold tracking-[0.15em] uppercase text-[#1A2406]/20">≈ {tx.inr}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] font-bold tracking-widest uppercase text-[#1A2406]/20 flex-wrap">
                      <span className="font-mono">{tx.id}</span>
                      <span className="opacity-30">/</span>
                      <span className="font-mono">{tx.txHash}</span>
                      <span className="opacity-30">/</span>
                      <span className="text-[#1A2406]/30">{tx.walletName}</span>
                      <span className="opacity-30">•</span>
                      <span className="font-sans italic">{tx.date}</span>
                    </div>
                  </div>
                </div>

                {/* Right */}
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={tx.status} />
                  <div className="flex items-center gap-1">
                    <button className="p-2 border border-black/[0.04] rounded-lg hover:bg-black/[0.02] transition-colors">
                      <ExternalLink className="w-3.5 h-3.5 text-[#1A2406]/25 hover:text-[#1A2406]/50 transition-colors" />
                    </button>
                    <button className="p-2 border border-black/[0.04] rounded-lg hover:bg-black/[0.02] transition-colors">
                      <Server className="w-3.5 h-3.5 text-[#1A2406]/25 hover:text-[#1A2406]/50 transition-colors" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filtered.length > 0 && (
          <motion.p
            variants={reveal}
            className="text-center text-[10px] font-bold tracking-[0.2em] uppercase text-[#1A2406]/20 pt-1"
          >
            Showing {filtered.length} of {ALL_TXS.length} records
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
