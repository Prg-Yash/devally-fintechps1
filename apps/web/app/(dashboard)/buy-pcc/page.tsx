"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Coins, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import Script from "next/script";
import { useActiveAccount, useActiveWallet, useAdminWallet } from "thirdweb/react";
import { formatPcc, inrToPcc, INR_TO_PCC_RATE } from "@/lib/paycrow-coin";

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

const API_BASE_URL = "/api";

export default function BuyCryptoPage() {
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
      console.error('Error fetching purchases:', error);
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
        color: "#2563EB",
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
      // 1. Create a dynamic Razorpay order on our Express API server
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

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "SUCCESS":
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "PAYMENT_VERIFIED":
        return "bg-blue-100 text-blue-800";
      case "CLAIMABLE":
        return "bg-indigo-100 text-indigo-800";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "CANCELLED":
        return "bg-slate-100 text-slate-700";
      case "FAILED":
      case "TRANSFER_FAILED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 mt-10">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">Buy PayCrow Coin (PCC)</h1>
          <p className="text-gray-500 mt-2">Convert INR to PCC securely using Razorpay. {session?.user?.name && `Welcome, ${session.user.name}`}</p>
        </div>

        <Card className="shadow-lg border-primary/20">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Coins className="text-primary w-6 h-6" />
            </div>
            <CardTitle className="text-2xl">Enter Purchase Amount</CardTitle>
            <CardDescription className="text-md">
              1 PCC = ₹{INR_TO_PCC_RATE} INR
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-sm font-semibold">
                Amount (INR)
              </Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-lg">
                  ₹
                </span>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  className="pl-10 text-lg h-14"
                  min="1"
                  value={amount || ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex justify-between items-center text-blue-900">
              <span className="font-medium text-sm">INR to PCC conversion:</span>
              <span className="text-2xl font-bold flex items-center">
                ₹{(amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="mx-2 text-blue-400">→</span>
                {formatPcc(convertedPcc)} <Coins className="w-5 h-5 ml-2 text-blue-500" />
              </span>
            </div>

            {!payoutWalletAddress && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Connect your wallet to enable Razorpay payment and receive PCC.
              </div>
            )}

            {payoutWalletAddress && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                PCC receiver wallet: {payoutWalletAddress}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              className="w-full h-12 text-lg font-medium"
              onClick={handlePayment}
              disabled={!canPay}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Initializing Secure Checkout
                </>
              ) : (
                "Pay with Razorpay"
              )}
            </Button>
          </CardFooter>
        </Card>

        {isLoadingPurchases ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : purchases.length > 0 ? (
          <div>
            <h2 className="text-2xl font-bold mb-4">Your Purchase History</h2>
            <div className="space-y-3">
              {purchases.map((purchase) => (
                <Card key={purchase.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold">₹{purchase.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} → {formatPcc(purchase.pccAmount ?? inrToPcc(purchase.amount))} PCC</p>
                        <p className="text-sm text-gray-500">Conversion: INR to PCC @ ₹{(purchase.conversionRate ?? INR_TO_PCC_RATE).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/PCC</p>
                        <p className="text-sm text-gray-500">Order ID: {purchase.razorpayOrderId.slice(0, 15)}...</p>
                        <p className="text-sm text-gray-400">{new Date(purchase.createdAt).toLocaleString()}</p>
                      </div>
                      <Badge variant="outline" className={getStatusColor(purchase.status)}>
                        {purchase.status}
                      </Badge>
                    </div>

                    {purchase.status === "PAYMENT_VERIFIED" && (
                      <div className="mt-4 flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => handleClaimTokens(purchase)}
                          disabled={Boolean(isClaimingByOrder[purchase.razorpayOrderId]) || !payoutWalletAddress}
                        >
                          {isClaimingByOrder[purchase.razorpayOrderId] ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Claiming...
                            </>
                          ) : (
                            "Claim PCC"
                          )}
                        </Button>
                      </div>
                    )}

                    {purchase.status === "PENDING" && (
                      <div className="mt-4 flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCancelOrder(purchase)}
                          disabled={Boolean(isCancellingByOrder[purchase.razorpayOrderId])}
                        >
                          {isCancellingByOrder[purchase.razorpayOrderId] ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Cancelling...
                            </>
                          ) : (
                            "Cancel"
                          )}
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => handlePayNow(purchase)}
                          disabled={Boolean(isPayingByOrder[purchase.razorpayOrderId]) || !payoutWalletAddress}
                        >
                          {isPayingByOrder[purchase.razorpayOrderId] ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Opening...
                            </>
                          ) : (
                            "Pay Now"
                          )}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
