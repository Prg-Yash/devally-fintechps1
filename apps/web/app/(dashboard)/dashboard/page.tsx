"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, CheckCircle2, Coins, FileText, Loader2, LogOut } from "lucide-react";
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
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">Welcome, {session?.user?.name || "User"}!</h1>
          <p className="text-gray-500 mt-2">{session?.user?.email}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/buy-crypto">
            <Button className="shrink-0 bg-blue-600 hover:bg-blue-700">
              <Coins className="w-4 h-4 mr-2" />
              Buy Stablecoins
            </Button>
          </Link>
          <Link href="/agreements">
            <Button variant="default" className="shrink-0 bg-purple-600 hover:bg-purple-700">
              <FileText className="w-4 h-4 mr-2" />
              Agreements
            </Button>
          </Link>
          <Button variant="outline" className="shrink-0 group">
            <Wallet className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
            Connect New Wallet
          </Button>
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

                <CardFooter className="pt-2">
                  {!isConnected ? (
                    <Button 
                      variant="outline" 
                      className="w-full hover:bg-primary hover:text-white transition-colors"
                      onClick={() => setConnectedWalletId(wallet.id)}
                    >
                      Switch to this Wallet
                    </Button>
                  ) : (
                    <Button 
                      variant="secondary" 
                      className="w-full bg-gray-100 text-gray-500 cursor-default"
                    >
                      Currently Active
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      {isLoadingPurchases ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : purchases.length > 0 ? (
        <div>
          <h2 className="text-2xl font-bold mb-4">Purchase History</h2>
          <div className="space-y-3">
            {purchases.map((purchase) => (
              <Card key={purchase.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold">₹{purchase.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                      <p className="text-sm text-gray-500">Order ID: {purchase.razorpayOrderId.slice(0, 15)}...</p>
                      <p className="text-sm text-gray-400">{new Date(purchase.createdAt).toLocaleString()}</p>
                    </div>
                    <Badge className={getStatusColor(purchase.status)}>
                      {purchase.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
