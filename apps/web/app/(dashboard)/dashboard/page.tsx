"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Wallet,
  CheckCircle2,
  Coins,
  FileText,
  Loader2,
  LogOut,
  ArrowRight,
  TrendingUp,
  Shield,
  Clock,
  Plus,
  ArrowUpRight,
  CreditCard,
  ShieldCheck,
  Activity,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface Purchase {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  razorpayOrderId: string;
}

interface DemoWallet {
  id: string;
  name: string;
  address: string;
  balance: number;
  currency: string;
  type: string;
}

// ─── Animation Variants (Solv. Style) ───────────────────────────────────────
const SPRING = { type: "spring" as const, stiffness: 300, damping: 30 };
const HOVER_SCALE = { scale: 1.01, transition: SPRING };
const BUTTON_PRESS = { scale: 0.98 };

const maskedReveal = {
  hidden: { y: 12, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 120, damping: 20 } },
};

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: SPRING }
};

// ─── Compact Rolling Counter ───
const RollingCounter = ({ value, prefix = "", suffix = "", decimals = 0 }: { value: number, prefix?: string, suffix?: string, decimals?: number }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    let start = displayValue;
    const end = value;
    if (start === end) return;
    const duration = 1500;
    const startTime = performance.now();
    const update = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 5); 
      const current = start + (end - start) * ease;
      setDisplayValue(current);
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }, [value]);

  const format = (num: number) => {
    return num.toLocaleString('en-IN', { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    });
  };

  return (
    <span className="tabular-nums font-medium tracking-tight">
      {prefix}{isMounted ? format(displayValue) : format(value)}{suffix}
    </span>
  );
};

// ─── Demo Data Utilities ───────────────────────────────────────────────────
const generateWalletsForUser = (userId: string): DemoWallet[] => {
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const multiplier = 1 + (hash % 5);
  return [
    { id: "w1", name: "Main Trading Node", address: "0x7a59 ... 3f92", balance: 14500.5 * multiplier, currency: "USDC", type: "MetaMask" },
    { id: "w2", name: "Savings Vault", address: "0x3b12 ... 9a41", balance: 50000 * multiplier, currency: "USDC", type: "Coinbase" },
    { id: "w3", name: "Growth Escrow", address: "0x9c88 ... 1d05", balance: 320.75 * multiplier, currency: "USDT", type: "Phantom" },
  ];
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

// ─── Dashboard Component ───────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  
  const [connectedWalletId, setConnectedWalletId] = useState<string>("w1");
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoadingPurchases, setIsLoadingPurchases] = useState(false);
  const [wallets, setWallets] = useState<DemoWallet[]>([]);

  const name = session?.user?.name?.split(' ')[0] ?? "User";
  const email = session?.user?.email ?? "";

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    setWallets(generateWalletsForUser(userId));

    const fetchPurchasesData = async () => {
      try {
        setIsLoadingPurchases(true);
        const response = await fetch(
          `${API_BASE_URL}/razorpay/purchases?userId=${encodeURIComponent(userId)}`,
        );

        if (!response.ok) return;

        const data = await response.json();
        setPurchases(Array.isArray(data.purchases) ? data.purchases : []);
      } catch (error) {
        console.error("Purchase fetch network error:", error);
        toast.error("API server is unreachable. Start backend on port 5000.");
      } finally {
        setIsLoadingPurchases(false);
      }
    };

    fetchPurchasesData();
  }, [session?.user?.id]);

  const successfulPurchases = purchases.filter((p) => {
    const normalized = p.status.toUpperCase();
    return normalized === "SUCCESS" || normalized === "COMPLETED";
  });

  const pendingPurchases = purchases.filter((p) => p.status.toUpperCase() === "PENDING");

  const totalPurchased = successfulPurchases.reduce((sum, p) => sum + p.amount, 0);

  const totals = {
    purchased: totalPurchased,
    success: successfulPurchases.length,
    pending: pendingPurchases.length
  };

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#1A2406]/10" />
      </div>
    );
  }

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="visible"
      className="mx-auto max-w-6xl space-y-6 pt-2 pb-10"
    >
      {/* ── Greeting Section (Compact & Technical) ── */}
      <motion.div variants={maskedReveal} className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-[#D9F24F]/10 text-[#1A2406] text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full border border-[#D9F24F]/20 flex items-center gap-1.5 uppercase leading-none">
              <div className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
              System Status: Active
            </span>
          </div>
          <h1 className="font-jakarta text-4xl tracking-[-0.04em] text-[#1A2406]">
            <span className="font-light text-[#1A2406]/40">Hey, </span>
            <span className="font-bold">{name}</span>
          </h1>
          <p className="font-sans text-[#1A2406]/30 text-sm font-medium">
            {email} • Integrated Asset Overview
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <motion.div whileHover={HOVER_SCALE} whileTap={BUTTON_PRESS}>
            <Link href="/buy-crypto">
              <button className="rounded-xl border border-black/[0.04] bg-white text-[#1A2406] px-5 py-2.5 text-xs font-bold tracking-tight hover:bg-[#FAFAF9] transition-all flex items-center gap-2 shadow-sm">
                <Coins className="w-4 h-4" />
                Buy Node Capital
              </button>
            </Link>
          </motion.div>
          
          <motion.div whileHover={HOVER_SCALE} whileTap={BUTTON_PRESS}>
            <button className="rounded-xl bg-[#1A2406] text-white px-5 py-2.5 text-xs font-bold tracking-tight flex items-center gap-2 shadow-lg shadow-[#1A2406]/10">
              <Plus className="w-4 h-4" />
              New Escrow Contract
            </button>
          </motion.div>
        </div>
      </motion.div>

      {/* ── Top Stats (Solv Style Glassmorphism) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <motion.div 
          variants={maskedReveal}
          className="relative bg-white/40 backdrop-blur-xl rounded-[28px] p-6 space-y-4 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-white/60 group overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <span className="font-jakarta text-[10px] font-bold text-[#1A2406]/40 uppercase tracking-widest leading-none">Aggregate Settlement</span>
            <div className="p-2 bg-white/80 rounded-xl border border-white shadow-sm">
              <Activity className="w-4 h-4 text-[#1A2406]" />
            </div>
          </div>
          <div className="space-y-0 relative z-10">
            <p className="font-jakarta text-3xl font-bold tracking-[-0.04em] text-[#1A2406]">
              <RollingCounter value={totals.purchased} decimals={2} prefix="₹" />
            </p>
            <p className="text-[10px] font-sans text-gray-400 font-bold uppercase tracking-tight">On-chain ledger balance</p>
          </div>
        </motion.div>

        <motion.div 
          variants={maskedReveal}
          className="relative bg-[#1A2406] text-white rounded-[28px] p-6 space-y-4 shadow-[0_20px_40px_rgba(26,36,6,0.15)] border border-white/5 overflow-hidden group"
        >
          {/* Solv Glow Accent */}
          <div className="absolute inset-0 bg-gradient-to-tr from-[#D9F24F]/10 via-transparent to-transparent pointer-events-none opacity-50" />
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#D9F24F]/20 blur-[60px] rounded-full pointer-events-none" />
          
          <div className="flex items-center justify-between relative z-10">
            <span className="font-jakarta text-[10px] font-bold uppercase tracking-widest text-white/40 leading-none">Active Protocols</span>
            <div className="p-2 bg-[#D9F24F] rounded-xl shadow-[0_0_20px_rgba(217,242,79,0.4)]">
              <ShieldCheck className="w-4 h-4 text-[#1A2406]" />
            </div>
          </div>
          <div className="space-y-0 relative z-10">
            <p className="font-jakarta text-3xl font-bold tracking-[-0.04em] text-[#D9F24F]">
              {totals.success} <span className="text-sm font-normal text-white/20 uppercase tracking-[0.2em] ml-2">Secured</span>
            </p>
            <p className="text-[10px] font-sans text-white/30 font-bold uppercase tracking-tight">Verified autonomous release</p>
          </div>
        </motion.div>

        <motion.div 
          variants={maskedReveal}
          className="relative bg-white/40 backdrop-blur-xl rounded-[28px] p-6 space-y-4 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-white/60 group overflow-hidden"
        >
          <div className="flex items-center justify-between relative z-10">
            <span className="font-jakarta text-[10px] font-bold text-[#1A2406]/40 uppercase tracking-widest leading-none">Awaiting Proof</span>
            <div className="p-2 bg-white/80 rounded-xl border border-white shadow-sm">
              <Clock className="w-4 h-4 text-[#1A2406]/40" />
            </div>
          </div>
          <div className="space-y-0 relative z-10">
            <p className="font-jakarta text-3xl font-bold tracking-[-0.04em] text-[#1A2406]">
              {totals.pending}
            </p>
            <p className="text-[10px] font-sans text-gray-400 font-bold uppercase tracking-tight">Transaction audit pending</p>
          </div>
        </motion.div>
      </div>


      <motion.div variants={stagger} className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-jakarta text-xl font-bold tracking-[-0.04em] text-[#1A2406]">
            Integrated Staking Nodes
          </h2>
          <button className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1A2406]/30 hover:text-[#1A2406] transition-all flex items-center gap-1.5 active:scale-95">
            Node Registry <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {wallets.map((wallet) => {
            const isConnected = connectedWalletId === wallet.id;
            return (
              <motion.div
                key={wallet.id}
                variants={maskedReveal}
                whileHover={HOVER_SCALE}
                className={`relative rounded-[28px] p-6 transition-all duration-500 overflow-hidden flex flex-col justify-between group
                  ${isConnected 
                    ? "bg-white border-[1px] border-[#1A2406]/10 shadow-[0_20px_40px_rgba(0,0,0,0.03)]" 
                    : "bg-[#FAFAF9]/60 backdrop-blur-sm border border-black/[0.03] shadow-sm hover:bg-white"
                  }`}
              >
                {/* Subtle Noise/Gradient Polish */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.4)_0%,transparent_100%)] pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-0 border border-white pointer-events-none rounded-[28px] opacity-60" />

                <div className="space-y-6 relative z-10">
                  <div className="flex justify-between items-start">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 shadow-sm ${
                      isConnected ? 'bg-[#1A2406] text-[#D9F24F]' : 'bg-white text-[#1A2406]/20 border border-black/[0.03]'
                    }`}>
                      <Wallet className="w-5 h-5" />
                    </div>
                    {isConnected && (
                      <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#1A2406] bg-[#D9F24F]/40 border border-[#D9F24F]/20 px-3 py-1.5 rounded-full">
                        Primary Node
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-jakarta text-base font-bold tracking-tight text-[#1A2406]">
                      {wallet.name}
                    </h3>
                    <p className="font-mono text-[10px] text-[#1A2406]/30 uppercase tracking-[0.1em] overflow-hidden text-ellipsis">
                      {wallet.address}
                    </p>
                  </div>
                </div>

                <div className="mt-8 space-y-6 relative z-10">
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-bold text-[#1A2406]/20 uppercase tracking-[0.15em]">Available Liquidity</p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-jakarta text-2xl font-bold text-[#1A2406] tracking-[-0.02em]">
                        <RollingCounter value={wallet.balance} decimals={2} prefix="₹" />
                      </span>
                      <span className="text-[10px] font-bold text-[#1A2406]/20 tracking-widest">{wallet.currency}</span>
                    </div>
                  </div>

                  {!isConnected ? (
                    <button
                      onClick={() => setConnectedWalletId(wallet.id)}
                      className="w-full text-[9px] font-bold tracking-widest uppercase py-3.5 rounded-xl border border-black/[0.04] text-[#1A2406]/30 hover:bg-[#1A2406] hover:text-white hover:border-[#1A2406] transition-all"
                    >
                      Connect Node
                    </button>
                  ) : (
                    <div className="flex items-center gap-2.5 py-3.5 px-4 rounded-xl bg-[#1A2406]/5 border border-[#1A2406]/5 text-[#1A2406] font-bold text-[9px] tracking-widest uppercase">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
                      Protocol Verified
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* ── Historical Settlement Ledger (Tight Vertical Flow) ── */}
      <div className="space-y-5">
        <motion.div variants={maskedReveal}>
          <h2 className="font-jakarta text-xl font-bold tracking-[-0.04em] text-[#1A2406]">
            Historical Settlement Ledger
          </h2>
        </motion.div>
        
        {isLoadingPurchases ? (
          <div className="h-40 flex items-center justify-center p-20 bg-white/20 backdrop-blur-sm rounded-[32px] border border-black/[0.01]">
            <Loader2 className="w-6 h-6 animate-spin text-[#1A2406]/10" />
          </div>
        ) : purchases.length > 0 ? (
          <div className="space-y-3">
            {purchases.map((item) => (
              <motion.div 
                key={item.id} 
                variants={maskedReveal}
                whileHover={{ x: 3, backgroundColor: "rgba(255,255,255,0.9)" }}
                className="bg-white/60 backdrop-blur-md border border-black/[0.02] p-6 rounded-[24px] flex flex-col md:flex-row md:items-center justify-between shadow-[0_4px_20px_rgb(0,0,0,0.01)] transition-all group"
              >
                <div className="flex items-center gap-6 mb-4 md:mb-0">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                    item.status.toUpperCase() === "SUCCESS" || item.status.toUpperCase() === "COMPLETED" ? "bg-[#16A34A]/5 text-[#16A34A]" : "bg-[#CA8A04]/5 text-[#CA8A04]"
                  }`}>
                    {item.status.toUpperCase() === "SUCCESS" || item.status.toUpperCase() === "COMPLETED" ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-jakarta font-bold text-[#1A2406] text-xl tracking-tight">
                      <RollingCounter value={item.amount} decimals={2} prefix="₹" />
                    </p>
                    <div className="flex items-center gap-3 text-[9px] font-bold tracking-widest uppercase text-[#1A2406]/20">
                      <span className="font-mono">{item.razorpayOrderId ? `TXN_${item.razorpayOrderId.slice(-10)}` : `REF_${item.id.slice(-10)}`}</span>
                      <span className="opacity-30">/</span>
                      <span className="font-sans italic">{new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className={`px-4 py-2.5 rounded-full text-[9px] font-extrabold tracking-[0.2em] uppercase ${
                    item.status.toUpperCase() === "SUCCESS" || item.status.toUpperCase() === "COMPLETED" ? "bg-[#1A2406] text-white" : "bg-white border border-black/[0.05] text-[#CA8A04]"
                  }`}>
                    {item.status}
                  </div>
                  <button className="p-2 border border-black/[0.04] rounded-lg hover:bg-black/[0.02] transition-colors">
                    <FileText className="w-3.5 h-3.5 text-[#1A2406]/40" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div 
            variants={maskedReveal}
            className="bg-white/40 backdrop-blur-md border border-dashed border-[#1A2406]/5 rounded-[32px] p-24 text-center"
          >
            <div className="w-16 h-16 bg-white rounded-2xl p-5 shadow-sm mx-auto mb-6 flex items-center justify-center border border-white">
              <CreditCard className="w-7 h-7 text-[#1A2406]/10" />
            </div>
            <h3 className="font-jakarta text-2xl font-bold text-[#1A2406] mb-3 tracking-[-0.04em]">Settlement Vault is Empty.</h3>
            <p className="text-gray-400 max-w-xs mx-auto text-sm leading-relaxed mb-10 font-medium">
              Initialize a node purchase to deploy capital into the escrow protocol.
            </p>
            <Link href="/buy-crypto">
              <motion.button 
                whileHover={HOVER_SCALE}
                whileTap={BUTTON_PRESS}
                className="bg-[#1A2406] text-white px-10 py-4 rounded-[18px] text-[10px] font-extrabold tracking-[0.2em] uppercase flex items-center gap-3 mx-auto shadow-2xl shadow-[#1A2406]/20"
              >
                Initiate Capital Node <ArrowRight className="w-4 h-4" />
              </motion.button>
            </Link>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
