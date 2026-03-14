"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Coins, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import Script from "next/script";
import { useRouter } from "next/navigation";

export default function BuyCryptoPage() {
  const [amount, setAmount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const { data: session } = authClient.useSession();
  const router = useRouter();

  const handlePayment = async () => {
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid amount greater than 0");
      return;
    }

    if (!session?.user?.id) {
      toast.error("You must be logged in to purchase stablecoins");
      return;
    }

    setIsLoading(true);

    try {
      // 1. Create a dynamic Razorpay order on our Express API server
      const response = await fetch("http://localhost:5000/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, userId: session.user.id }),
      });

      if (!response.ok) {
        throw new Error("Failed to create Razorpay Order");
      }

      const orderData = await response.json();

      // 2. Open Razorpay Checkout modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amount, // amount in paise
        currency: "INR",
        name: "Devally Fintech",
        description: `Purchase of ${amount} Stablecoins`,
        order_id: orderData.orderId,
        handler: async function (response: any) {
          console.log("✅ Razorpay Payment Succeeded", response);
          
          try {
            // 3. Synchronously verify the payment with our backend
            const verifyRes = await fetch("http://localhost:5000/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            if (verifyRes.ok) {
               toast.success("Payment verified! Your stablecoins have been credited.");
               
               // 4. Call the custom after-payment endpoint
               await fetch("http://localhost:5000/razorpay/after-payment", {
                 method: "POST",
                 headers: { "Content-Type": "application/json" },
                 body: JSON.stringify({ orderId: response.razorpay_order_id })
               });

               router.push("/dashboard");
            } else {
               toast.error("Payment verification failed. Please contact support.");
            }
          } catch (err) {
            console.error("Verification error:", err);
            toast.error("Error connecting to verification server.");
          } finally {
            setAmount(0);
          }
        },
        prefill: {
          name: session.user.name || "User",
          email: session.user.email,
        },
        theme: {
          color: "#2563EB", // Primary blue color
        },
      };

      // @ts-ignore - Razorpay is loaded dynamically via script tag
      const rzp = new window.Razorpay(options);
      
      rzp.on("payment.failed", function (response: any) {
        toast.error(`Payment Failed: ${response.error.description || "Something went wrong."}`);
      });

      rzp.open();
    } catch (error) {
      console.error(error);
      toast.error("Failed to initialize payment. Please check if the API is running.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      
      <div className="max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 mt-10">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">Buy Stablecoins</h1>
          <p className="text-gray-500 mt-2">Fund your escrow wallet instantly using Razorpay.</p>
        </div>

        <Card className="shadow-lg border-primary/20">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Coins className="text-primary w-6 h-6" />
            </div>
            <CardTitle className="text-2xl">Enter Purchase Amount</CardTitle>
            <CardDescription className="text-md">
              1 Stablecoin = ₹1 INR
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
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex justify-between items-center text-blue-900">
              <span className="font-medium text-sm">You will receive:</span>
              <span className="text-2xl font-bold flex items-center">
                {amount || 0} <Coins className="w-5 h-5 ml-2 text-blue-500" />
              </span>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
                className="w-full h-12 text-lg font-medium" 
                onClick={handlePayment} 
                disabled={isLoading || amount <= 0}
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
      </div>
    </>
  );
}
