"use client";

import React, { useState, useEffect } from "react";
impimport { motion } from "framer-motion";
import {
  Wallet,
  CheckCircle2,
  Coins,
  FileText, Loader2, 
  ArrowRight,
  TrendingUp,
  Shield,
  Clock,
  Plus,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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

// Enhanced demo wallets with user-specific calculation
const generateWalletsForUser = (userId: string): DemoWallet[] => {
  // Use userId to seed consistent but unique data per user
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const multiplier = 1 + (hash % 5);
  
  return [
    {
      id: "w1",
      name: "Main Trading Wallet",
      address: "0x7a59...3f92",
      balance: 14500.50 * multiplier,
      currency: "USDC",
      type: "MetaMask",
    },
    {
      id: "w2",
      name: "Savings / Escrow",
      address: "0x3b12...9a41",
      balance: 50000.00 * multiplier,
      currency: "USDC",
      type: "Coinbase Wallet",
    },
    {
      id: "w3",
      name: "Freelance Earnings",
      address: "0x9c88...1d05",
      balance: 320.75 * multiplier,
      currency: "USDT",
      type: "Phantom",
    }
  ];
};

export default function DashboardPage() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const [connectedWalletId, setConnectedWalletId] = useState<string>("w1");
  const { data: session } = authClient.useSession();
  const fullName = session?.user?.name ?? "User";
  const userEmail = session?.user?.email ?? "";

  const handleLogout = async () => {
    await authClient.signOut();
    window.location.href = "/";
  };
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoadingPurchases, setIsLoadingPurchases] = useState(false);
  const [wallets, setWallets] = useState<DemoWallet[]>([]);

  useEffect(() => {
    if (session?.user?.id) {
      setWallets(generateWalletsForUser(session.user.id));
      fetchPurchases(session.user.id);
    }
  }, [session?.user?.id]);

  const fetchPurchases = async (userId: string) => {
    try {
      setIsLoadingPurchases(true);
      const response = await fetch(`http://localhost:5000/razorpay/purchases?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setPurchases(data.purchases || []);
      }
    } catch (error) {
      console.error('Error fetching purchases:', error);
    } finally {
      setIsLoadingPurchases(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "SUCCESS":
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "FAILED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const totalPurchased = purchases
    .filter((p) => p.status === "SUCCESS")
    .reduce((sum, p) => sum + p.amount, 0);

  const handleLogout = async () => {
    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            router.push("/login");
          },
        },
      });
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout");
    }
  };

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

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
            <Button 
            variant="destructive" 
            className="shrink-0"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
        </div>
      </motion.div>

      {/* ── Wallets section ── */}
      <motion.div variants={itemVariants}>
        <h2 className="font-jakarta text-2xl font-bold tracking-tight text-[#1A2406] mb-8">
          Your Connected Wallets
        </h2>

      {purchases.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg">Purchase Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Stablecoins Purchased</p>
                <p className="text-2xl font-bold text-green-600">₹{totalPurchased.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Successful Transactions</p>
                <p className="text-2xl font-bold text-blue-600">{purchases.filter(p => p.status === "SUCCESS").length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Pending Transactions</p>
                <p className="text-2xl font-bold text-yellow-600">{purchases.filter(p => p.status === "PENDING").length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-2xl font-bold mb-4">Your Connected Wallets</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {wallets.map((wallet) => {
            const isConnected = connectedWalletId === wallet.id;

            return (
              <Card 
                key={wallet.id} 
                className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg ${
                  isConnected ? "border-primary ring-1 ring-primary/20 shadow-primary/10" : "border-gray-200"
                }`}
              >
                {isConnected && (
                  <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
                )}
                
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{wallet.name}</CardTitle>
                      <CardDescription className="font-mono mt-1">{wallet.address}</CardDescription>
                    </div>
                    {isConnected ? (
                      <Badge variant="default" className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-gray-500">
                        {wallet.type}
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-500 mb-1">Available Balance</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-gray-900">
                        ₹{wallet.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-sm font-semibold text-gray-500">{wallet.currency}</span>
                    </div>
                  </div>
                </CardContent>

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
