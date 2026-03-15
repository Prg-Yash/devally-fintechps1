"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Coins,
  Loader2,
  ArrowRight,
  CheckCircle2,
  Clock,
  XCircle,
  Wallet,
  CreditCard,
  Zap,
  ArrowLeft,
  IndianRupee,
  ShieldCheck,
  Activity,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import Script from "next/script";
import { useActiveAccount, useActiveWallet, useAdminWallet } from "thirdweb/react";
import { formatPcc, inrToPcc, INR_TO_PCC_RATE } from "@/lib/paycrow-coin";
import { useRouter } from "next/navigation";

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Purchase {
  id: string;
  amount: number;
  pccAmount: number;
  conversionRate: number;
  conversionType: string;
  status: string;
  createdAt: string;
  razorpayOrderId: string;
}

// ─── Animation Variants (matching dashboard) ──────────────────────────────────
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

// ─── Rolling Counter (matching dashboard) ─────────────────────────────────────
const RollingCounter = ({ value, prefix = "", suffix = "", decimals = 0 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    let start = displayValue;
    const end = value;
    if (start === end) return;
    const duration = 1200;
    const startTime = performance.now();
    const update = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 5);
      setDisplayValue(start + (end - start) * ease);
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }, [value]);

  const format = (num: number) =>
    num.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  return (
    <span className="tabular-nums font-medium tracking-tight">
      {prefix}{isMounted ? format(displayValue) : format(value)}{suffix}
    </span>
  );
};

const API_BASE_URL = "/api";

// ─── Status helpers ────────────────────────────────────────────────────────────
const getStatusMeta = (status: string) => {
  const s = status.toUpperCase();
  if (s === "SUCCESS" || s === "COMPLETED")
    return {
      label: "Completed",
      bg: "bg-[#1A2406] text-white",
      cardBg: "bg-[#16A34A]/5 border-[#16A34A]/10",
      hoverBg: "rgba(22,163,74,0.06)",
      icon: CheckCircle2,
      dot: "bg-[#16A34A]",
    };
  if (s === "PAYMENT_VERIFIED" || s === "CLAIMABLE")
    return {
      label: "Claimable",
      bg: "bg-[#D9F24F]/20 text-[#1A2406]",
      cardBg: "bg-[#D9F24F]/10 border-[#D9F24F]/30",
      hoverBg: "rgba(217,242,79,0.12)",
      icon: Zap,
      dot: "bg-[#D9F24F]",
    };
  if (s === "PENDING")
    return {
      label: "Pending",
      bg: "bg-white border border-black/[0.05] text-[#CA8A04]",
      cardBg: "bg-[#CA8A04]/5 border-[#CA8A04]/15",
      hoverBg: "rgba(202,138,4,0.07)",
      icon: Clock,
      dot: "bg-[#CA8A04]",
    };
  if (s === "CANCELLED")
    return {
      label: "Cancelled",
      bg: "bg-[#1A2406]/5 text-[#1A2406]/40",
      cardBg: "bg-[#1A2406]/[0.03] border-[#1A2406]/5",
      hoverBg: "rgba(26,36,6,0.04)",
      icon: XCircle,
      dot: "bg-[#1A2406]/20",
    };
  if (s === "FAILED" || s === "TRANSFER_FAILED")
    return {
      label: "Failed",
      bg: "bg-red-50 text-red-700",
      cardBg: "bg-red-50/60 border-red-100",
      hoverBg: "rgba(239,68,68,0.06)",
      icon: XCircle,
      dot: "bg-red-400",
    };
  return {
    label: status,
    bg: "bg-gray-100 text-gray-600",
    cardBg: "bg-white/60 border-black/[0.02]",
    hoverBg: "rgba(255,255,255,0.9)",
    icon: Clock,
    dot: "bg-gray-400",
  };
};

// ─── Page Component ────────────────────────────────────────────────────────────
export default function BuyCryptoPage() {
  const router = useRouter();
  const activeAccount = useActiveAccount();
  const activeWallet = useActiveWallet();
  const adminWallet = useAdminWallet();
  const [amount, setAmount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoadingPurchases, setIsLoadingPurchases] = useState(false);
  const [isClaimingByOrder, setIsClaimingByOrder] = useState<Record<string, boolean>>({});
  const [isPayingByOrder, setIsPayingByOrder] = useState<Record<string, boolean>>({});
  const [isCancellingByOrder, setIsCancellingByOrder] = useState<Record<string, boolean>>({});
  const { data: session } = authClient.useSession();

  const adminAccount = activeWallet?.getAdminAccount?.() || adminWallet?.getAccount?.();
  const payoutWalletAddress = adminAccount?.address || activeAccount?.address;

  useEffect(() => {
    if (session?.user?.id) {
      fetchPurchases(session.user.id);
    }
  }, [session?.user?.id]);

  const fetchPurchases = async (userId: string) => {
    try {
      setIsLoadingPurchases(true);
      const response = await fetch(`${API_BASE_URL}/razorpay/purchases?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setPurchases(data.purchases || []);
      }
    } catch (error) {
      console.error("Error fetching purchases:", error);
    } finally {
      setIsLoadingPurchases(false);
    }
  };

  const convertedPcc = inrToPcc(amount || 0);
  const canPay = Boolean(payoutWalletAddress) && amount > 0 && !isLoading;

  const openRazorpayCheckout = async (input: {
    orderId: string;
    amountInRupees: number;
    walletAddress: string;
    label: string;
  }) => {
    const { orderId, amountInRupees, walletAddress, label } = input;
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!keyId) {
      toast.error("NEXT_PUBLIC_RAZORPAY_KEY_ID is missing in apps/web/.env");
      return;
    }

    const options = {
      key: keyId,
      amount: Math.round(amountInRupees * 100),
      currency: "INR",
      name: "Devally Fintech",
      description: label,
      order_id: orderId,
      handler: async function (response: any) {
        console.log("✅ Razorpay Payment Succeeded", response);
        console.log("⏳ Verifying payment with backend...");

        try {
          const verifyRes = await fetch(`${API_BASE_URL}/razorpay/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              walletAddress,
            }),
          });

          const verifyData = await verifyRes.json().catch(() => ({}));

          if (!verifyRes.ok) {
            console.error("Payment verification failed", verifyData);
            toast.error(verifyData?.message || "Payment verification failed.");
            return;
          }

          toast.success("Payment successful. You can now claim PCC.");
          window.dispatchEvent(new CustomEvent("pcc:purchase-completed"));
          if (session?.user?.id) {
            await fetchPurchases(session.user.id);
          }
        } catch (err) {
          console.error("Verification error:", err);
          toast.error("Error verifying payment");
        } finally {
          setIsLoading(false);
          setIsPayingByOrder((prev) => ({ ...prev, [orderId]: false }));
        }
      },
      modal: {
        ondismiss: function () {
          setIsLoading(false);
          setIsPayingByOrder((prev) => ({ ...prev, [orderId]: false }));
        },
      },
      prefill: {
        name: session?.user?.name || "User",
        email: session?.user?.email,
      },
      theme: {
        color: "#1A2406",
      },
    };

    // @ts-ignore Razorpay is loaded via script
    const rzp = new window.Razorpay(options);
    rzp.on("payment.failed", function (response: any) {
      toast.error(`Payment Failed: ${response.error.description || "Something went wrong."}`);
      setIsLoading(false);
      setIsPayingByOrder((prev) => ({ ...prev, [orderId]: false }));
    });
    rzp.open();
  };

  const handlePayment = async () => {
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid amount greater than 0");
      return;
    }

    if (!session?.user?.id) {
      toast.error("You must be logged in to purchase PCC");
      return;
    }

    if (!payoutWalletAddress) {
      toast.error("Connect your wallet to buy PCC");
      return;
    }

    const walletAddress = payoutWalletAddress;
    console.log("[PCC_RECIPIENT] Using payout wallet for new order", {
      activeAccountAddress: activeAccount?.address,
      adminAccountAddress: adminAccount?.address,
      selectedPayoutWalletAddress: walletAddress,
    });

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/razorpay/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          userId: session.user.id,
          walletAddress,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create Razorpay Order");
      }

      const orderData = await response.json();
      await openRazorpayCheckout({
        orderId: orderData.orderId,
        amountInRupees: amount,
        walletAddress,
        label: `Convert INR to PCC (${amount} INR -> ${formatPcc(convertedPcc)} PCC)`,
      });
      setAmount(0);
    } catch (error) {
      console.error(error);
      toast.error("Failed to initialize payment. Please check if the API is running.");
      setIsLoading(false);
    }
  };

  const handlePayNow = async (purchase: Purchase) => {
    if (!payoutWalletAddress) {
      toast.error("Connect your wallet first");
      return;
    }

    setIsPayingByOrder((prev) => ({ ...prev, [purchase.razorpayOrderId]: true }));
    setIsLoading(true);
    try {
      await openRazorpayCheckout({
        orderId: purchase.razorpayOrderId,
        amountInRupees: purchase.amount,
        walletAddress: payoutWalletAddress,
        label: `Pay pending order (${purchase.amount.toFixed(2)} INR)`,
      });
    } catch (error: any) {
      toast.error(error?.message || "Unable to open payment");
      setIsLoading(false);
      setIsPayingByOrder((prev) => ({ ...prev, [purchase.razorpayOrderId]: false }));
    }
  };

  const handleCancelOrder = async (purchase: Purchase) => {
    if (!session?.user?.id) {
      toast.error("Login required");
      return;
    }

    try {
      setIsCancellingByOrder((prev) => ({ ...prev, [purchase.razorpayOrderId]: true }));
      const res = await fetch(`${API_BASE_URL}/razorpay/cancel-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: purchase.razorpayOrderId,
          userId: session.user.id,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to cancel order");
      }

      toast.success("Order cancelled successfully");
      await fetchPurchases(session.user.id);
    } catch (error: any) {
      toast.error(error?.message || "Cancel failed");
    } finally {
      setIsCancellingByOrder((prev) => ({ ...prev, [purchase.razorpayOrderId]: false }));
    }
  };

  const handleClaimTokens = async (purchase: Purchase) => {
    if (!payoutWalletAddress) {
      toast.error("Connect your wallet first");
      return;
    }

    try {
      setIsClaimingByOrder((prev) => ({ ...prev, [purchase.razorpayOrderId]: true }));

      const claimRes = await fetch(`${API_BASE_URL}/razorpay/complete-claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: purchase.razorpayOrderId,
          walletAddress: payoutWalletAddress,
        }),
      });

      const claimData = await claimRes.json().catch(() => ({}));
      if (!claimRes.ok) {
        throw new Error(claimData?.error || "Claim request failed");
      }

      console.log("[PCC_CLAIM][CLIENT] Claim response", {
        orderId: purchase.razorpayOrderId,
        connectedWallet: activeAccount?.address,
        adminWallet: adminAccount?.address,
        selectedPayoutWalletAddress: payoutWalletAddress,
        txHash: claimData?.txHash,
        mintedTo: claimData?.mintedTo,
        mintedPccAmount: claimData?.mintedPccAmount,
      });

      toast.success("PCC claimed successfully to connected wallet.");
      window.dispatchEvent(new CustomEvent("pcc:purchase-completed"));
      if (session?.user?.id) {
        fetchPurchases(session.user.id);
      }
    } catch (error: any) {
      console.error("Claim tokens failed:", error);
      toast.error(error?.message || "Failed to claim tokens");
    } finally {
      setIsClaimingByOrder((prev) => ({ ...prev, [purchase.razorpayOrderId]: false }));
    }
  };

  // Derived stats
  const completedCount = purchases.filter(p => ["SUCCESS", "COMPLETED"].includes(p.status.toUpperCase())).length;
  const pendingCount = purchases.filter(p => p.status.toUpperCase() === "PENDING").length;
  const claimableCount = purchases.filter(p => ["PAYMENT_VERIFIED", "CLAIMABLE"].includes(p.status.toUpperCase())).length;
  const totalSpent = purchases
    .filter(p => ["SUCCESS", "COMPLETED"].includes(p.status.toUpperCase()))
    .reduce((s, p) => s + p.amount, 0);

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="mx-auto max-w-6xl space-y-8 pt-2 pb-10"
      >
        {/* ── Header ── */}
        <motion.div variants={maskedReveal} className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2 border-b border-[#1A2406]/5">
          <div className="space-y-1">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-[#1A2406]/30 hover:text-[#1A2406] transition-colors text-[10px] font-bold uppercase tracking-widest mb-3"
            >
              <ArrowLeft className="w-3 h-3" />
              Back
            </button>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-[#D9F24F]/10 text-[#1A2406] text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full border border-[#D9F24F]/20 flex items-center gap-1.5 uppercase leading-none">
                <div className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
                Razorpay Gateway: Active
              </span>
            </div>
            <h1 className="font-jakarta text-4xl tracking-[-0.04em] text-[#1A2406]">
              <span className="font-light text-[#1A2406]/40">Acquire </span>
              <span className="font-bold">PayCrow Coin</span>
            </h1>
            <p className="font-sans text-[#1A2406]/30 text-sm font-medium">
              Convert INR → PCC via Razorpay • 1 PCC = ₹{INR_TO_PCC_RATE}
            </p>
          </div>
          <div className="p-4 bg-[#1A2406] rounded-[20px] shadow-lg shadow-[#1A2406]/20">
            <Coins className="w-8 h-8 text-[#D9F24F]" />
          </div>
        </motion.div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            variants={maskedReveal}
            className="relative bg-white/40 backdrop-blur-xl rounded-[24px] p-5 space-y-3 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-white/60 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent pointer-events-none" />
            <div className="flex items-center justify-between relative z-10">
              <span className="font-jakarta text-[9px] font-bold text-[#1A2406]/40 uppercase tracking-widest leading-none">Total Spent</span>
              <div className="p-2 bg-white/80 rounded-xl border border-white shadow-sm">
                <Activity className="w-3.5 h-3.5 text-[#1A2406]" />
              </div>
            </div>
            <p className="font-jakarta text-2xl font-bold tracking-[-0.04em] text-[#1A2406] relative z-10">
              <RollingCounter value={totalSpent} decimals={2} prefix="₹" />
            </p>
          </motion.div>

          <motion.div
            variants={maskedReveal}
            className="relative bg-[#1A2406] text-white rounded-[24px] p-5 space-y-3 shadow-[0_20px_40px_rgba(26,36,6,0.15)] border border-white/5 overflow-hidden"
          >
            <div className="absolute -top-8 -right-8 w-24 h-24 bg-[#D9F24F]/20 blur-[50px] rounded-full pointer-events-none" />
            <div className="flex items-center justify-between relative z-10">
              <span className="font-jakarta text-[9px] font-bold uppercase tracking-widest text-white/40 leading-none">Completed</span>
              <div className="p-2 bg-[#D9F24F] rounded-xl shadow-[0_0_16px_rgba(217,242,79,0.4)]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#1A2406]" />
              </div>
            </div>
            <p className="font-jakarta text-2xl font-bold tracking-[-0.04em] text-[#D9F24F] relative z-10">
              {completedCount} <span className="text-xs font-normal text-white/20 uppercase tracking-[0.2em] ml-1">TXN</span>
            </p>
          </motion.div>

          <motion.div
            variants={maskedReveal}
            className="relative bg-white/40 backdrop-blur-xl rounded-[24px] p-5 space-y-3 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-white/60 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="font-jakarta text-[9px] font-bold text-[#1A2406]/40 uppercase tracking-widest leading-none">Claimable</span>
              <div className="p-2 bg-white/80 rounded-xl border border-white shadow-sm">
                <Zap className="w-3.5 h-3.5 text-[#D9F24F]" />
              </div>
            </div>
            <p className="font-jakarta text-2xl font-bold tracking-[-0.04em] text-[#1A2406]">
              {claimableCount} <span className="text-xs font-bold text-[#1A2406]/20 uppercase tracking-[0.2em] ml-1">Ready</span>
            </p>
          </motion.div>

          <motion.div
            variants={maskedReveal}
            className="relative bg-white/40 backdrop-blur-xl rounded-[24px] p-5 space-y-3 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-white/60 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="font-jakarta text-[9px] font-bold text-[#1A2406]/40 uppercase tracking-widest leading-none">Pending</span>
              <div className="p-2 bg-white/80 rounded-xl border border-white shadow-sm">
                <Clock className="w-3.5 h-3.5 text-[#CA8A04]" />
              </div>
            </div>
            <p className="font-jakarta text-2xl font-bold tracking-[-0.04em] text-[#1A2406]">
              {pendingCount}
            </p>
          </motion.div>
        </div>

        {/* ── Main Purchase Card + Wallet Panel ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Purchase form */}
          <motion.div variants={maskedReveal} className="lg:col-span-7">
            <div className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-[32px] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.04)] space-y-8">

              {/* Section title */}
              <div className="space-y-1">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#1A2406]/30">Capital Deployment</p>
                <h2 className="font-jakarta text-2xl font-bold tracking-[-0.04em] text-[#1A2406]">Enter Purchase Amount</h2>
              </div>

              {/* Amount input */}
              <div className="space-y-3">
                <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A2406]/30 ml-1">
                  Amount (INR)
                </Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-jakarta font-bold text-[#1A2406]/30 text-lg">₹</span>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    className="pl-10 h-16 text-3xl font-jakarta font-bold bg-[#1A2406]/[0.02] border border-[#1A2406]/5 rounded-2xl focus:ring-4 focus:ring-[#D9F24F]/10 focus:border-[#D9F24F]/30 transition-all placeholder:text-[#1A2406]/10"
                    min="1"
                    value={amount || ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Conversion preview */}
              <AnimatePresence>
                {amount > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex items-center justify-between p-5 rounded-2xl bg-[#D9F24F]/10 border border-[#D9F24F]/20"
                  >
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A2406]/40 mb-1">You Pay</p>
                      <p className="font-jakarta text-xl font-bold text-[#1A2406]">
                        ₹{(amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="text-[#1A2406]/20 font-bold text-2xl">→</div>
                    <div className="text-right">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A2406]/40 mb-1">You Receive</p>
                      <p className="font-jakarta text-xl font-bold text-[#1A2406] flex items-center gap-1.5">
                        {formatPcc(convertedPcc)}
                        <Coins className="w-4 h-4 text-[#D9F24F]" />
                        <span className="text-xs font-bold text-[#1A2406]/30 ml-0.5">PCC</span>
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Wallet status */}
              <AnimatePresence mode="wait">
                {!payoutWalletAddress ? (
                  <motion.div
                    key="no-wallet"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-start gap-3 p-4 rounded-2xl bg-[#CA8A04]/5 border border-[#CA8A04]/20"
                  >
                    <Wallet className="w-4 h-4 text-[#CA8A04] mt-0.5 shrink-0" />
                    <p className="text-xs font-medium text-[#CA8A04]">
                      Connect your wallet to enable purchase and receive PCC tokens.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="wallet-connected"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-between p-4 rounded-2xl bg-[#1A2406]/[0.03] border border-[#1A2406]/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A2406]/30 mb-0.5">PCC Receiver Node</p>
                        <p className="text-xs font-mono font-bold text-[#1A2406]">{payoutWalletAddress}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* CTA */}
              <motion.div whileTap={BUTTON_PRESS}>
                <button
                  onClick={handlePayment}
                  disabled={!canPay}
                  className="w-full h-14 rounded-2xl bg-[#1A2406] text-[#D9F24F] font-jakarta font-bold text-sm tracking-tight hover:bg-[#2a3a10] transition-all active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xl shadow-[#1A2406]/20"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Initializing Secure Checkout…
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      Pay with Razorpay
                    </>
                  )}
                </button>
              </motion.div>
            </div>
          </motion.div>

          {/* Info sidebar */}
          <motion.div variants={maskedReveal} className="lg:col-span-5 space-y-4">
            {/* Rate card */}
            <div className="bg-[#1A2406] text-white rounded-[28px] p-6 space-y-5 shadow-2xl shadow-[#1A2406]/30 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#D9F24F]/20 blur-[60px] rounded-full pointer-events-none" />
              <div className="flex items-center gap-2 relative z-10">
                <div className="w-1.5 h-1.5 rounded-full bg-[#D9F24F] animate-pulse" />
                <span className="text-[8px] font-bold uppercase tracking-widest text-white/40 leading-none">Live Conversion Rate</span>
              </div>
              <div className="relative z-10">
                <p className="font-jakarta text-4xl font-bold text-[#D9F24F] tracking-[-0.04em]">
                  ₹{INR_TO_PCC_RATE}
                  <span className="text-base font-normal text-white/20 ml-2 uppercase tracking-[0.15em]">per PCC</span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 relative z-10">
                {[
                  { inr: 100, label: "Starter" },
                  { inr: 500, label: "Growth" },
                  { inr: 1000, label: "Power" },
                  { inr: 5000, label: "Enterprise" },
                ].map(({ inr, label }) => (
                  <button
                    key={inr}
                    onClick={() => setAmount(inr)}
                    className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-[#D9F24F]/20 transition-all text-left group"
                  >
                    <p className="text-[8px] font-bold uppercase tracking-widest text-white/20 mb-1 group-hover:text-[#D9F24F]/60 transition-colors">{label}</p>
                    <p className="text-sm font-jakarta font-bold text-white">₹{inr.toLocaleString("en-IN")}</p>
                    <p className="text-[9px] text-white/30 font-mono">{formatPcc(inrToPcc(inr))} PCC</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Info card */}
            <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-[24px] p-5 space-y-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A2406]/40">How It Works</p>
              {[
                { step: "01", text: "Enter INR amount & connect wallet" },
                { step: "02", text: "Pay securely via Razorpay gateway" },
                { step: "03", text: "Claim PCC directly to your node" },
              ].map(({ step, text }) => (
                <div key={step} className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-[#1A2406] text-[#D9F24F] text-[9px] font-black flex items-center justify-center shrink-0">{step}</span>
                  <p className="text-xs font-medium text-[#1A2406]/60">{text}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ── Purchase History Ledger ── */}
        <div className="space-y-5">
          <motion.div variants={maskedReveal} className="flex items-center justify-between">
            <h2 className="font-jakarta text-xl font-bold tracking-[-0.04em] text-[#1A2406]">
              Settlement Ledger
            </h2>
            {purchases.length > 0 && (
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1A2406]/30">
                {purchases.length} Transaction{purchases.length !== 1 ? "s" : ""}
              </span>
            )}
          </motion.div>

          {isLoadingPurchases ? (
            <div className="h-40 flex items-center justify-center bg-white/20 backdrop-blur-sm rounded-[32px] border border-black/[0.01]">
              <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-[#1A2406]/20 uppercase">
                <Loader2 className="h-4 w-4 animate-spin" />
                Fetching Ledger…
              </div>
            </div>
          ) : purchases.length > 0 ? (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {purchases.map((purchase) => {
                  const meta = getStatusMeta(purchase.status);
                  const StatusIcon = meta.icon;
                  const isCompleted = ["SUCCESS", "COMPLETED"].includes(purchase.status.toUpperCase());

                  return (
                    <motion.div
                      key={purchase.id}
                      variants={maskedReveal}
                      whileHover={{ x: 3, backgroundColor: meta.hoverBg }}
                      className={`${meta.cardBg} backdrop-blur-md border p-6 rounded-[24px] shadow-[0_4px_20px_rgb(0,0,0,0.02)] transition-all group`}
                    >
                      {/* Top row */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-5">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                            isCompleted
                              ? "bg-[#16A34A]/10 text-[#16A34A]"
                              : purchase.status.toUpperCase() === "PENDING"
                              ? "bg-[#CA8A04]/10 text-[#CA8A04]"
                              : purchase.status.toUpperCase() === "PAYMENT_VERIFIED" || purchase.status.toUpperCase() === "CLAIMABLE"
                              ? "bg-[#D9F24F]/20 text-[#1A2406]"
                              : purchase.status.toUpperCase() === "CANCELLED"
                              ? "bg-[#1A2406]/5 text-[#1A2406]/30"
                              : "bg-red-100 text-red-500"
                          }`}>
                            <StatusIcon className="w-5 h-5" />
                          </div>
                          <div className="space-y-0.5">
                            <p className="font-jakarta font-bold text-[#1A2406] text-xl tracking-tight">
                              <RollingCounter value={purchase.amount} decimals={2} prefix="₹" />
                              <span className="text-[#1A2406]/20 text-sm font-normal ml-2">→</span>
                              <span className="text-sm font-bold text-[#1A2406]/50 ml-1">
                                {formatPcc(purchase.pccAmount ?? inrToPcc(purchase.amount))} PCC
                              </span>
                            </p>
                            <div className="flex items-center gap-3 text-[9px] font-bold tracking-widest uppercase text-[#1A2406]/20">
                              <span className="font-mono">
                                TXN_{purchase.razorpayOrderId.slice(-10)}
                              </span>
                              <span className="opacity-30">/</span>
                              <span className="font-sans italic">
                                {new Date(purchase.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className={`px-4 py-2 rounded-full text-[9px] font-extrabold tracking-[0.2em] uppercase self-start ${meta.bg}`}>
                          {meta.label}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <AnimatePresence>
                        {purchase.status === "PAYMENT_VERIFIED" && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 pt-4 border-t border-[#1A2406]/5 flex justify-end"
                          >
                            <motion.button
                              whileTap={BUTTON_PRESS}
                              onClick={() => handleClaimTokens(purchase)}
                              disabled={Boolean(isClaimingByOrder[purchase.razorpayOrderId]) || !payoutWalletAddress}
                              className="px-6 py-2.5 rounded-xl bg-[#1A2406] text-[#D9F24F] text-[10px] font-bold uppercase tracking-widest hover:bg-[#2a3a10] transition-all disabled:opacity-30 flex items-center gap-2"
                            >
                              {isClaimingByOrder[purchase.razorpayOrderId] ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin" />Claiming…</>
                              ) : (
                                <><Zap className="w-3.5 h-3.5" />Claim PCC</>
                              )}
                            </motion.button>
                          </motion.div>
                        )}

                        {purchase.status === "PENDING" && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 pt-4 border-t border-[#1A2406]/5 flex justify-end gap-3"
                          >
                            <motion.button
                              whileTap={BUTTON_PRESS}
                              onClick={() => handleCancelOrder(purchase)}
                              disabled={Boolean(isCancellingByOrder[purchase.razorpayOrderId])}
                              className="px-5 py-2.5 rounded-xl border border-[#1A2406]/10 text-[10px] font-bold uppercase tracking-widest text-[#1A2406]/40 hover:text-[#1A2406] hover:bg-[#1A2406]/5 transition-all disabled:opacity-30 flex items-center gap-2"
                            >
                              {isCancellingByOrder[purchase.razorpayOrderId] ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin" />Cancelling…</>
                              ) : (
                                <><XCircle className="w-3.5 h-3.5" />Cancel</>
                              )}
                            </motion.button>

                            <motion.button
                              whileTap={BUTTON_PRESS}
                              onClick={() => handlePayNow(purchase)}
                              disabled={Boolean(isPayingByOrder[purchase.razorpayOrderId]) || !payoutWalletAddress}
                              className="px-6 py-2.5 rounded-xl bg-[#1A2406] text-[#D9F24F] text-[10px] font-bold uppercase tracking-widest hover:bg-[#2a3a10] transition-all disabled:opacity-30 flex items-center gap-2"
                            >
                              {isPayingByOrder[purchase.razorpayOrderId] ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin" />Opening…</>
                              ) : (
                                <><CreditCard className="w-3.5 h-3.5" />Pay Now</>
                              )}
                            </motion.button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            <motion.div
              variants={maskedReveal}
              className="bg-white/40 backdrop-blur-md border border-dashed border-[#1A2406]/5 rounded-[32px] p-24 text-center"
            >
              <div className="w-16 h-16 bg-white rounded-2xl p-5 shadow-sm mx-auto mb-6 flex items-center justify-center border border-white">
                <Coins className="w-7 h-7 text-[#1A2406]/10" />
              </div>
              <h3 className="font-jakarta text-2xl font-bold text-[#1A2406] mb-3 tracking-[-0.04em]">No Transactions Yet.</h3>
              <p className="text-gray-400 max-w-xs mx-auto text-sm leading-relaxed mb-10 font-medium">
                Make your first INR → PCC purchase to deploy capital into the protocol.
              </p>
              <motion.button
                whileHover={HOVER_SCALE}
                whileTap={BUTTON_PRESS}
                onClick={() => document.getElementById("amount")?.focus()}
                className="bg-[#1A2406] text-white px-10 py-4 rounded-[18px] text-[10px] font-extrabold tracking-[0.2em] uppercase flex items-center gap-3 mx-auto shadow-2xl shadow-[#1A2406]/20"
              >
                Initiate Capital Purchase <ArrowRight className="w-4 h-4" />
              </motion.button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </>
  );
}
