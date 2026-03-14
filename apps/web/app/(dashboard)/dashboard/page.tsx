"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, CheckCircle2, Coins, FileText } from "lucide-react";
import Link from "next/link";

// Demo data for wallets
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
    type: "Phantom", // (Note: Phantom typically used for Sol, but used here as an example)
  }
];

export default function DashboardPage() {
  const [connectedWalletId, setConnectedWalletId] = useState<string>("w1");

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">User Dashboard</h1>
          <p className="text-gray-500 mt-2">Manage your connected wallets and view your stablecoin balances.</p>
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
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {demoWallets.map((wallet) => {
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
                      ${wallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
  );
}
