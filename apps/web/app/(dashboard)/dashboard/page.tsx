"use client";

import React, { useEffect, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { CheckCircle2, Coins, FileText, Loader2, LogOut, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      staggerChildren: 0.08,
      ease: "easeOut" as const,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: "easeOut" as const },
  },
};

const generateWalletsForUser = (userId: string): DemoWallet[] => {
  const hash = userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const multiplier = 1 + (hash % 5);

  return [
    {
      id: "w1",
      name: "Main Trading Wallet",
      address: "0x7a59...3f92",
      balance: 14500.5 * multiplier,
      currency: "USDC",
      type: "MetaMask",
    },
    {
      id: "w2",
      name: "Savings / Escrow",
      address: "0x3b12...9a41",
      balance: 50000 * multiplier,
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
    },
  ];
};

const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status.toUpperCase()) {
    case "SUCCESS":
    case "COMPLETED":
      return "default";
    case "PENDING":
      return "secondary";
    case "FAILED":
      return "destructive";
    default:
      return "outline";
  }
};

export default function DashboardPage() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  const [connectedWalletId, setConnectedWalletId] = useState<string>("w1");
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoadingPurchases, setIsLoadingPurchases] = useState(false);
  const [wallets, setWallets] = useState<DemoWallet[]>([]);

  const fullName = session?.user?.name ?? "User";
  const userEmail = session?.user?.email ?? "";

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      return;
    }

    setWallets(generateWalletsForUser(userId));

    const fetchPurchases = async () => {
      try {
        setIsLoadingPurchases(true);
        const response = await fetch(
          `http://localhost:5000/razorpay/purchases?userId=${encodeURIComponent(userId)}`,
        );

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        setPurchases(Array.isArray(data.purchases) ? data.purchases : []);
      } catch (error) {
        console.error("Error fetching purchases:", error);
      } finally {
        setIsLoadingPurchases(false);
      }
    };

    fetchPurchases();
  }, [session?.user?.id]);

  const handleLogout = async () => {
    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => router.push("/login"),
        },
      });
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout");
    }
  };

  const successfulPurchases = purchases.filter((p) => {
    const normalized = p.status.toUpperCase();
    return normalized === "SUCCESS" || normalized === "COMPLETED";
  });

  const pendingPurchases = purchases.filter((p) => p.status.toUpperCase() === "PENDING");

  const totalPurchased = successfulPurchases.reduce((sum, p) => sum + p.amount, 0);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="mx-auto max-w-6xl space-y-10"
    >
      <motion.div variants={itemVariants} className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div>
          <h1 className="font-jakarta text-4xl font-bold tracking-tight text-[#1A2406]">Welcome, {fullName}!</h1>
          <p className="mt-1 text-sm text-gray-500">{userEmail}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link href="/buy-crypto" className="gap-2">
              <Coins className="h-4 w-4" />
              Buy Stablecoins
            </Link>
          </Button>

          <Button asChild variant="secondary">
            <Link href="/agreements" className="gap-2">
              <FileText className="h-4 w-4" />
              Agreements
            </Link>
          </Button>

          <Button variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Connect New Wallet
          </Button>

          <Button variant="destructive" className="gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="border-[#D9EBFF] bg-[#F0F7FF]/70">
          <CardHeader>
            <CardTitle className="text-[#1E40AF]">Purchase Summary</CardTitle>
            <CardDescription>Recent buy-crypto metrics from your account.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingPurchases ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading purchases...
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium text-gray-500">Total Stablecoins Purchased</p>
                  <p className="mt-1 text-2xl font-bold text-[#16A34A]">
                    Rs {totalPurchased.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Successful Transactions</p>
                  <p className="mt-1 text-2xl font-bold text-[#2563EB]">{successfulPurchases.length}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Pending Transactions</p>
                  <p className="mt-1 text-2xl font-bold text-[#CA8A04]">{pendingPurchases.length}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants} className="space-y-5">
        <h2 className="font-jakarta text-2xl font-bold tracking-tight text-[#1A2406]">Your Connected Wallets</h2>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {wallets.map((wallet) => {
            const isConnected = connectedWalletId === wallet.id;

            return (
              <Card
                key={wallet.id}
                className={`relative overflow-hidden transition-all duration-300 ${isConnected ? "border-primary ring-1 ring-primary/20" : "border-gray-200"
                  }`}
              >
                {isConnected ? <div className="absolute left-0 top-0 h-1 w-full bg-primary" /> : null}

                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{wallet.name}</CardTitle>
                      <CardDescription className="mt-1 font-mono">{wallet.address}</CardDescription>
                    </div>
                    {isConnected ? (
                      <Badge variant="default" className="bg-primary/10 text-primary hover:bg-primary/20">
                        <CheckCircle2 className="h-3 w-3" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{wallet.type}</Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div>
                    <span className="text-sm font-medium text-gray-500">Available Balance</span>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-gray-900">
                        Rs {wallet.balance.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span className="text-sm font-semibold text-gray-500">{wallet.currency}</span>
                    </div>
                  </div>

                  {!isConnected ? (
                    <Button variant="outline" className="w-full" onClick={() => setConnectedWalletId(wallet.id)}>
                      Switch to this Wallet
                    </Button>
                  ) : (
                    <Button variant="secondary" className="w-full" disabled>
                      Currently Active
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="space-y-5">
        <h2 className="font-jakarta text-2xl font-bold tracking-tight text-[#1A2406]">Purchase History</h2>

        {isLoadingPurchases ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading history...
          </div>
        ) : purchases.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-gray-500">No purchases found yet.</CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {purchases.map((item) => (
              <Card key={item.id} className="gap-4 border-gray-100">
                <CardContent className="flex items-center justify-between gap-4 py-6">
                  <div className="space-y-1">
                    <p className="font-jakarta font-bold text-[#1A2406]">
                      Rs {item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-500">Order ID: {item.razorpayOrderId || item.id}</p>
                    <p className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>

                  <Badge variant={getStatusBadgeVariant(item.status)}>{item.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
