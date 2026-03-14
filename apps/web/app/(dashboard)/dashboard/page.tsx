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
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

// ─── Demo data ────────────────────────────────────────────────────────────────
const demoWallets = [
  {
    id: "w1",
    name: "Main Trading Wallet",
    address: "0x7a59 ... 3f92",
    balance: 14500.50,
    currency: "USDC",
    type: "MetaMask",
    connected: true,
  },
  {
    id: "w2",
    name: "Savings / Escrow",
    address: "0x3b12 ... 9a41",
    balance: 50000.00,
    currency: "USDC",
    type: "Coinbase Wallet",
    connected: false,
  },
  {
    id: "w3",
    name: "Freelance Earnings",
    address: "0x9c88 ... 1d05",
    balance: 320.75,
    currency: "USDT",
    type: "Phantom",
    connected: false,
  },
];

const purchaseHistory = [
  {
    id: "order_SR4dUTl78..",
    amount: 200.00,
    date: "3/14/2026, 4:02:15 PM",
    status: "SUCCESS",
  },
  {
    id: "order_SR4dUTl79..",
    amount: 500.00,
    date: "3/14/2026, 4:05:00 PM",
    status: "PENDING",
  }
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
  const fullName = session?.user?.name ?? "User";
  const userEmail = session?.user?.email ?? "";

  const handleLogout = async () => {
    await authClient.signOut();
    window.location.href = "/";
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-6xl mx-auto space-y-12"
    >
      {/* ── Welcome Header ── */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="font-jakarta text-4xl font-bold tracking-tight text-[#1A2406]">
            Welcome, {fullName}!
          </h1>
          <p className="font-inter text-gray-400 mt-1 text-sm">
            {userEmail}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/buy-crypto">
            <button className="flex items-center gap-2 bg-[#2563EB] text-white font-inter text-xs font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity">
              <Coins className="w-4 h-4" />
              Buy Stablecoins
            </button>
          </Link>
          <Link href="/agreements">
            <button className="flex items-center gap-2 bg-[#9333EA] text-white font-inter text-xs font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity">
              <FileText className="w-4 h-4" />
              Agreements
            </button>
          </Link>
          <button className="flex items-center gap-2 bg-white text-[#1A2406] border border-gray-200 font-inter text-xs font-semibold px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
            <Plus className="w-4 h-4" />
            Connect New Wallet
          </button>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 bg-[#DC2626] text-white font-inter text-xs font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </motion.div>

      {/* ── Purchase Summary ── */}
      <motion.div 
        variants={itemVariants} 
        className="bg-[#F0F7FF]/50 border border-[#D9EBFF] rounded-3xl p-8"
      >
        <h2 className="font-jakarta text-lg font-semibold text-[#1E40AF] mb-6">Purchase Summary</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <p className="font-inter text-xs font-medium text-gray-500 mb-2">Total Stablecoins Purchased</p>
            <p className="font-jakarta text-2xl font-bold text-[#16A34A]">₹200.00</p>
          </div>
          <div>
            <p className="font-inter text-xs font-medium text-gray-500 mb-2">Successful Transactions</p>
            <p className="font-jakarta text-2xl font-bold text-[#2563EB]">1</p>
          </div>
          <div>
            <p className="font-inter text-xs font-medium text-gray-500 mb-2">Pending Transactions</p>
            <p className="font-jakarta text-2xl font-bold text-[#CA8A04]">6</p>
          </div>
        </div>
      </motion.div>

      {/* ── Wallets section ── */}
      <motion.div variants={itemVariants}>
        <h2 className="font-jakarta text-2xl font-bold tracking-tight text-[#1A2406] mb-8">
          Your Connected Wallets
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {demoWallets.map((wallet) => {
            const isConnected = connectedWalletId === wallet.id;
            return (
              <motion.div
                key={wallet.id}
                whileHover={{ y: -2 }}
                className={`relative rounded-[24px] p-8 border transition-all duration-300 bg-white
                  ${isConnected
                    ? "border-[#1A2406] border-2 shadow-lg"
                    : "border-gray-100 shadow-sm"
                  }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <h3 className="font-jakarta font-bold text-[#1A2406] text-lg">
                      {wallet.name}
                    </h3>
                    <p className="font-inter text-xs text-gray-400 mt-1">{wallet.address}</p>
                  </div>
                  {isConnected ? (
                    <span className="flex items-center gap-1 text-[10px] font-inter font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded-md border border-gray-200">
                      <CheckCircle2 className="w-3 h-3" />
                      Connected
                    </span>
                  ) : (
                    <span className="text-[10px] font-inter font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                      {wallet.type}
                    </span>
                  )}
                </div>

                {/* Balance */}
                <div className="mb-8">
                  <p className="font-inter text-xs text-gray-400 mb-2">Available Balance</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-jakarta text-3xl font-bold text-[#1A2406]">
                      ₹{wallet.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="font-inter text-xs text-gray-400 font-semibold">{wallet.currency}</span>
                  </div>
                </div>

                {/* CTA */}
                {!isConnected ? (
                  <button
                    onClick={() => setConnectedWalletId(wallet.id)}
                    className="w-full font-inter text-xs font-bold py-3.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-all"
                  >
                    Switch to this Wallet
                  </button>
                ) : (
                  <button className="w-full font-inter text-xs font-bold py-3.5 rounded-xl bg-gray-50 text-gray-400 cursor-default">
                    Currently Active
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* ── Purchase History ── */}
      <motion.div variants={itemVariants} className="space-y-6">
        <h2 className="font-jakarta text-2xl font-bold tracking-tight text-[#1A2406]">
          Purchase History
        </h2>
        <div className="space-y-4">
          {purchaseHistory.map((item) => (
            <div key={item.id} className="bg-white border border-gray-100 p-6 rounded-[20px] flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <p className="font-jakarta font-bold text-[#1A2406]">₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>Order ID: {item.id}</span>
                </div>
                <p className="text-[10px] text-gray-300">{item.date}</p>
              </div>
              <div>
                <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${
                  item.status === "SUCCESS" ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"
                }`}>
                  {item.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
