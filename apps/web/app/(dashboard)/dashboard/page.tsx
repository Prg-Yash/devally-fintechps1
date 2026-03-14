"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Wallet,
  CheckCircle2,
  Coins,
  FileText,
  ArrowRight,
  TrendingUp,
  Shield,
  Clock,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

// ─── Demo data ────────────────────────────────────────────────────────────────
const demoWallets = [
  {
    id: "w1",
    name: "Main Trading Wallet",
    address: "0x7a59...3f92",
    balance: 14500.50,
    currency: "USDC",
    type: "MetaMask",
  },
  {
    id: "w2",
    name: "Savings / Escrow",
    address: "0x3b12...9a41",
    balance: 50000.00,
    currency: "USDC",
    type: "Coinbase Wallet",
  },
  {
    id: "w3",
    name: "Freelance Earnings",
    address: "0x9c88...1d05",
    balance: 320.75,
    currency: "USDT",
    type: "Phantom",
  },
];

const stats = [
  { label: "Total Locked",   value: "$64,821.25", delta: "+12.4%", icon: Shield,    color: "bg-[#1A2406]",  text: "text-[#D9F24F]" },
  { label: "Released",       value: "$22,000.00", delta: "+3.1%",  icon: TrendingUp, color: "bg-[#D9F24F]",  text: "text-[#1A2406]" },
  { label: "Pending",        value: "$9,400.00",  delta: "0%",     icon: Clock,      color: "bg-white",      text: "text-[#1A2406]" },
];

// ─── Animation variants ────────────────────────────────────────────────────────
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [connectedWalletId, setConnectedWalletId] = useState<string>("w1");
  const { data: session } = authClient.useSession();
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-6xl mx-auto space-y-10"
    >
      {/* ── Header ── */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="font-inter text-sm text-gray-500 mb-1 tracking-wide uppercase">Welcome back</p>
          <h1 className="font-jakarta text-4xl md:text-5xl font-semibold tracking-[-0.04em] text-[#1A2406] leading-tight">
            Hey, {firstName} 👋
          </h1>
          <p className="font-inter text-gray-500 mt-2 text-sm">
            Manage your wallets, monitor escrows, and track agreements — all in one place.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link href="/buy-crypto">
            <button className="flex items-center gap-2 bg-[#1A2406] text-white font-inter text-sm font-medium px-5 py-2.5 rounded-full hover:bg-[#2a3a0a] transition-colors">
              <Coins className="w-4 h-4" />
              Buy Stablecoins
            </button>
          </Link>
          <Link href="/agreements">
            <button className="flex items-center gap-2 bg-[#D9F24F] text-[#1A2406] font-inter text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-[#c8e040] transition-colors">
              <FileText className="w-4 h-4" />
              Agreements
            </button>
          </Link>
        </div>
      </motion.div>

      {/* ── Stats row ── */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(({ label, value, delta, icon: Icon, color, text }) => (
          <div
            key={label}
            className={`${color} rounded-[28px] p-6 flex items-start justify-between shadow-sm`}
          >
            <div>
              <p className={`font-inter text-xs font-medium ${text} opacity-70 mb-2 uppercase tracking-wider`}>{label}</p>
              <p className={`font-jakarta text-3xl font-semibold tracking-[-0.04em] ${text}`}>{value}</p>
              <p className={`font-inter text-xs mt-1 ${text} opacity-60`}>{delta} this month</p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${text === "text-[#D9F24F]" ? "bg-white/10" : "bg-[#1A2406]/10"}`}>
              <Icon className={`w-5 h-5 ${text}`} />
            </div>
          </div>
        ))}
      </motion.div>

      {/* ── Wallets section ── */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-jakarta text-2xl font-semibold tracking-[-0.03em] text-[#1A2406]">
            Connected Wallets
          </h2>
          <button className="flex items-center gap-1.5 font-inter text-sm text-[#1A2406] border border-[#1A2406]/20 px-4 py-2 rounded-full hover:bg-[#1A2406] hover:text-white transition-all">
            <Plus className="w-3.5 h-3.5" />
            Add Wallet
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {demoWallets.map((wallet) => {
            const isConnected = connectedWalletId === wallet.id;
            return (
              <motion.div
                key={wallet.id}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
                className={`relative rounded-[24px] p-6 border transition-all duration-300 bg-white
                  ${isConnected
                    ? "border-[#1A2406] shadow-[0_0_0_1px_rgba(26,36,6,0.12)] shadow-xl"
                    : "border-gray-100 shadow-sm hover:shadow-md"
                  }`}
              >
                {/* Active bar */}
                {isConnected && (
                  <div className="absolute top-0 left-6 right-6 h-0.5 bg-[#D9F24F] rounded-full" />
                )}

                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-jakarta font-semibold text-[#1A2406] text-base leading-tight">
                      {wallet.name}
                    </p>
                    <p className="font-mono text-xs text-gray-400 mt-0.5">{wallet.address}</p>
                  </div>
                  {isConnected ? (
                    <span className="flex items-center gap-1 text-xs font-inter font-semibold bg-[#D9F24F] text-[#1A2406] px-2.5 py-1 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      Active
                    </span>
                  ) : (
                    <span className="text-xs font-inter text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                      {wallet.type}
                    </span>
                  )}
                </div>

                {/* Balance */}
                <div className="mb-5">
                  <p className="font-inter text-xs text-gray-400 mb-1">Available Balance</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-jakarta text-3xl font-semibold tracking-[-0.04em] text-[#1A2406]">
                      ${wallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="font-inter text-sm text-gray-400 font-medium">{wallet.currency}</span>
                  </div>
                </div>

                {/* CTA */}
                {!isConnected ? (
                  <button
                    onClick={() => setConnectedWalletId(wallet.id)}
                    className="w-full flex items-center justify-center gap-2 border border-[#1A2406]/20 text-[#1A2406] font-inter text-sm font-medium py-2.5 rounded-xl hover:bg-[#1A2406] hover:text-white transition-all"
                  >
                    Switch to this Wallet <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <div className="w-full flex items-center justify-center gap-2 bg-[#1A2406]/5 text-[#1A2406] font-inter text-sm font-medium py-2.5 rounded-xl">
                    <Wallet className="w-3.5 h-3.5" />
                    Currently Active
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* ── Quick actions ── */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Create Escrow */}
        <div className="bg-[#1A2406] rounded-[28px] p-8 flex flex-col justify-between min-h-[180px] relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[#D9F24F]/10 group-hover:scale-125 transition-transform duration-700" />
          <div>
            <p className="font-inter text-xs text-white/50 uppercase tracking-widest mb-2">Get started</p>
            <h3 className="font-jakarta text-2xl font-semibold tracking-[-0.03em] text-white leading-tight">
              Deploy a New Escrow
            </h3>
            <p className="font-inter text-sm text-white/60 mt-2">
              Lock funds in a smart contract and release on milestone completion.
            </p>
          </div>
          <button className="mt-6 self-start flex items-center gap-2 bg-[#D9F24F] text-[#1A2406] font-inter text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-white transition-colors relative z-10">
            Create Escrow <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* View Agreements */}
        <div className="bg-[#D9F24F] rounded-[28px] p-8 flex flex-col justify-between min-h-[180px] relative overflow-hidden group">
          <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-[#1A2406]/10 group-hover:scale-125 transition-transform duration-700" />
          <div>
            <p className="font-inter text-xs text-[#1A2406]/60 uppercase tracking-widest mb-2">Contracts</p>
            <h3 className="font-jakarta text-2xl font-semibold tracking-[-0.03em] text-[#1A2406] leading-tight">
              View Agreements
            </h3>
            <p className="font-inter text-sm text-[#1A2406]/70 mt-2">
              Review, sign, and manage all your active escrow agreements.
            </p>
          </div>
          <Link href="/agreements">
            <button className="mt-6 self-start flex items-center gap-2 bg-[#1A2406] text-[#D9F24F] font-inter text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-[#2a3a0a] transition-colors relative z-10">
              Open Agreements <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
