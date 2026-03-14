"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import {
  ArrowLeft,
  DollarSign,
  Gavel,
  Loader2,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Wallet,
  Zap,
  Calendar,
  FileText,
  Send,
  Sparkles,
  Bot,
  Wand2,
  BrainCircuit
} from "lucide-react";
import { ConnectButton, useActiveAccount, useActiveWallet, useAdminWallet } from "thirdweb/react";
import { sepolia } from "thirdweb/chains";
import { prepareContractCall, sendAndConfirmTransaction } from "thirdweb";
import { verifyTypedData } from "viem";

import {
  ESCROW_CONTRACT_ADDRESS,
  PUSD_CONTRACT_ADDRESS,
  PERMIT_DOMAIN,
  getEscrowContract,
  getPusdContract,
  getPermitNonce,
  getProjectCount,
  scalePusdAmount,
  splitSignature,
  shortAddress,
} from "@/lib/escrow";
import { thirdwebClient } from "@/lib/thirdweb-client";

// ─── Animation Variants ───
const SPRING = { type: "spring" as const, stiffness: 300, damping: 30 };
const BUTTON_PRESS = { scale: 0.98 };

const maskedReveal = {
  hidden: { y: 12, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 120, damping: 20 } },
};

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

type TxStep = "idle" | "signing" | "funding" | "verified" | "error";

const txStepMeta: Record<TxStep, { label: string; color: string }> = {
  idle: { label: "Ready", color: "bg-slate-100 text-slate-600" },
  signing: { label: "Signing Permit", color: "bg-amber-100 text-amber-700" },
  funding: { label: "Locking Funds", color: "bg-blue-100 text-blue-700" },
  verified: { label: "Verified ✓", color: "bg-emerald-100 text-emerald-700" },
  error: { label: "Failed", color: "bg-red-100 text-red-700" },
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";
const AI_BASE_URL = process.env.NEXT_PUBLIC_AI_BASE_URL ?? "http://localhost:8000";

// ─── AI active-field type ───
type AiActiveField = "idle" | "title" | "description" | "amount" | "dueDate" | "milestones" | "done";

interface MilestoneInput {
  title: string;
  amount: string;
  dueDate: string;
}

export default function NewAgreementPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const adminWallet = useAdminWallet();
  const adminAccount = activeWallet?.getAdminAccount?.() || adminWallet?.getAccount?.();

  const [isFunding, setIsFunding] = useState(false);
  const [txStep, setTxStep] = useState<TxStep>("idle");
  const [txStepDescription, setTxStepDescription] = useState("Waiting for action");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    freelancerAddress: "",
    amount: "",
    dueDate: "",
    receiverEmail: "",
  });

  const [milestones, setMilestones] = useState<MilestoneInput[]>([
    { title: "Initial Draft", amount: "", dueDate: "" }
  ]);

  // ─── AI Generator State ───
  const [aiIdea, setAiIdea] = useState("");
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiActiveField, setAiActiveField] = useState<AiActiveField>("idle");
  const [aiComplexity, setAiComplexity] = useState("");
  const [aiBudgetReasoning, setAiBudgetReasoning] = useState("");
  const [aiTechStack, setAiTechStack] = useState<string[]>([]);

  const escrowContract = useMemo(() => getEscrowContract(thirdwebClient), []);
  const pusdContract = useMemo(() => getPusdContract(thirdwebClient), []);

  const permitOwnerAddress = adminAccount?.address || account?.address || null;
  const smartAccountAddress = account?.address || null;
  const isSmartAccountMode =
    Boolean(smartAccountAddress) &&
    Boolean(adminAccount?.address) &&
    smartAccountAddress !== adminAccount?.address;

  const addMilestone = () => {
    setMilestones([...milestones, { title: "", amount: "", dueDate: "" }]);
  };

  const removeMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const updateMilestone = (index: number, field: keyof MilestoneInput, value: string) => {
    const newMilestones = [...milestones];
    newMilestones[index][field] = value;
    setMilestones(newMilestones);
  };

  // Handle AI Idea from Copilot Query Params
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const passedIdea = params.get("idea");
      if (passedIdea) {
        setAiIdea(passedIdea);
        // Clear param from URL so it doesn't run again on refresh
        window.history.replaceState({}, "", "/agreements/new-agreement");
        // Start generation slightly delayed to allow UI settlement
        setTimeout(() => handleAiGenerate(passedIdea), 800);
      }
    }
  }, []);

  // ─── Helper: delay ───
  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  // ─── AI Agreement Generator ───
  const handleAiGenerate = async (explicitIdea?: string) => {
    const ideaToUse = explicitIdea || aiIdea;
    if (!ideaToUse.trim()) {
      toast.error("Describe your project idea first");
      return;
    }

    setIsAiGenerating(true);
    setAiActiveField("idle");
    setAiComplexity("");
    setAiBudgetReasoning("");
    setAiTechStack([]);

    try {
      const res = await fetch(`${AI_BASE_URL}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_idea: ideaToUse }),
      });

      if (!res.ok) {
        throw new Error(`AI Agent returned ${res.status}`);
      }

      const data = await res.json();

      // Sequential field filling with animation

      // 1. Title
      setAiActiveField("title");
      await delay(600);
      setFormData(prev => ({ ...prev, title: data.title || "" }));
      await delay(400);

      // 2. Description
      setAiActiveField("description");
      await delay(600);
      setFormData(prev => ({ ...prev, description: data.description || "" }));
      await delay(400);

      // 3. Amount
      setAiActiveField("amount");
      await delay(600);
      setFormData(prev => ({ ...prev, amount: String(data.total_budget_pusd || "") }));
      await delay(400);

      // 4. Due Date (calculate from today + estimated_duration_days)
      setAiActiveField("dueDate");
      await delay(600);
      if (data.estimated_duration_days) {
        const due = new Date();
        due.setDate(due.getDate() + data.estimated_duration_days);
        const dueDateStr = due.toISOString().split("T")[0];
        setFormData(prev => ({ ...prev, dueDate: dueDateStr }));
      }
      await delay(400);

      // 5. Milestones
      setAiActiveField("milestones");
      await delay(400);
      if (data.milestones && data.milestones.length > 0) {
        const newMilestones: MilestoneInput[] = data.milestones.map((ms: any) => {
          const msDue = new Date();
          msDue.setDate(msDue.getDate() + (ms.due_days || 7));
          return {
            title: ms.title || "",
            amount: String(ms.amount_pusd || ""),
            dueDate: msDue.toISOString().split("T")[0],
          };
        });
        setMilestones(newMilestones);
      }
      await delay(600);

      // Store extra AI data for display
      setAiComplexity(data.complexity_level || "");
      setAiBudgetReasoning(data.budget_reasoning || "");
      setAiTechStack(data.tech_stack || []);

      setAiActiveField("done");
      toast.success("Agreement generated by AI! All fields are editable.", {
        icon: <Sparkles className="w-4 h-4 text-[#D9F24F]" />,
        duration: 4000,
      });

      setTimeout(() => setAiActiveField("idle"), 3000);

    } catch (error: any) {
      console.error("AI generation failed:", error);
      toast.error(error?.message || "Failed to generate agreement with AI");
      setAiActiveField("idle");
    } finally {
      setIsAiGenerating(false);
    }
  };

  // ─── Gradient border class helper ───
  const getFieldGlow = (field: AiActiveField) => {
    if (aiActiveField === field) {
      return "ai-glow-active";
    }
    return "";
  };



  const saveAgreementMetadata = async (projectId: bigint, txHash?: string) => {
    if (!session?.user?.id || !formData.receiverEmail) return;
    try {
      await fetch(`${API_BASE_URL}/agreements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          amount: formData.amount ? parseFloat(formData.amount) : 0,
          currency: "PUSD",
          receiverEmail: formData.receiverEmail,
          creatorId: session.user.id,
          dueDate: formData.dueDate ? new Date(formData.dueDate) : null,
          projectId: Number(projectId),
          freelancerAddress: formData.freelancerAddress,
          transactionHash: txHash,
          milestones: milestones.map(m => ({
            title: m.title,
            amount: parseFloat(m.amount) || 0,
            dueDate: m.dueDate ? new Date(m.dueDate) : null,
            status: "PENDING"
          }))
        }),
      });
    } catch (error) {
      console.error("Metadata persistence warning:", error);
    }
  };

  const handleCreateAgreement = async () => {
    if (!permitOwnerAddress) {
      toast.error("Connect your smart wallet first");
      return;
    }

    if (activeWallet?.id === "smart" && !adminAccount) {
      toast.error("Could not resolve your admin EOA. Reconnect wallet and try again.");
      return;
    }

    const fundingAccount = adminAccount || account;
    if (!fundingAccount) {
      toast.error("Unable to resolve funding wallet account");
      return;
    }

    const ownerAddress = fundingAccount.address as `0x${string}`;

    const recipientAddr = formData.freelancerAddress.trim();
    if (!recipientAddr || !formData.amount || !formData.title || !formData.dueDate) {
      toast.error("Freelancer wallet, amount, title, and due date are required");
      return;
    }

    // Validate milestones total
    const milestonesTotal = milestones.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);
    if (milestonesTotal > parseFloat(formData.amount)) {
      toast.error(`Milestones total (${milestonesTotal}) exceeds agreement amount (${formData.amount})`);
      return;
    }

    try {
      setIsFunding(true);
      setTxStep("signing");
      setTxStepDescription("Please sign the PUSD permit in your wallet…");

      const scaledAmount = scalePusdAmount(formData.amount);
      const permitDeadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 60); // 1 hour

      const nonce = await getPermitNonce(thirdwebClient, ownerAddress);

      const permitDomain = {
        ...PERMIT_DOMAIN,
        verifyingContract: PUSD_CONTRACT_ADDRESS as `0x${string}`,
      } as const;

      const permitTypes = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      } as const;

      const permitMessage = {
        owner: ownerAddress,
        spender: ESCROW_CONTRACT_ADDRESS as `0x${string}`,
        value: scaledAmount,
        nonce,
        deadline: permitDeadline,
      } as const;

      const signature = await fundingAccount.signTypedData({
        domain: permitDomain,
        types: permitTypes,
        primaryType: "Permit",
        message: permitMessage,
      });

      const signatureValid = await verifyTypedData({
        address: ownerAddress,
        domain: permitDomain,
        types: permitTypes,
        primaryType: "Permit",
        message: permitMessage,
        signature,
      });

      if (!signatureValid) {
        throw new Error("Signature verification failed locally!");
      }

      const { v, r, s } = splitSignature(signature);
      const permitV = Number(v);

      setTxStep("funding");
      setTxStepDescription("Submitting escrow funding transaction on Sepolia…");

      const tx = prepareContractCall({
        contract: escrowContract,
        method:
          "function createAndFundAgreement(address _freelancer, uint256 _amount, uint256 _deadline, uint8 v, bytes32 r, bytes32 s)",
        params: [recipientAddr, scaledAmount, permitDeadline, permitV, r, s],
      });

      const result = await sendAndConfirmTransaction({
        account: fundingAccount,
        transaction: tx,
      });

      // Capture the newly created project's on-chain ID
      let createdProjectId = BigInt(0);
      try {
        const count = await getProjectCount(thirdwebClient);
        createdProjectId = count > BigInt(0) ? count - BigInt(1) : BigInt(0);
      } catch (e) {
        console.error("Failed to fetch new project count", e);
      }
      
      await saveAgreementMetadata(createdProjectId, result.transactionHash);
      
      setTxStep("verified");
      setTxStepDescription("Agreement created & funds locked in escrow ✓");
      toast.success("Funds locked in escrow successfully!");

      setTimeout(() => {
        router.push("/agreements");
      }, 2000);
    } catch (error: any) {
      console.error("Escrow funding failed:", error);
      setTxStep("error");
      setTxStepDescription(error?.message || "Funding failed. Check wallet and signature.");
      toast.error("Failed to fund escrow agreement");
    } finally {
      setIsFunding(false);
      setTimeout(() => setTxStep("idle"), 3000);
    }
  };

  return (
    <>
      {/* ─── Global AI Glow Styles ─── */}
      <style jsx global>{`
        @keyframes aiGradientBorder {
          0% { border-color: #D9F24F; box-shadow: 0 0 8px rgba(217,242,79,0.3), 0 0 20px rgba(217,242,79,0.1); }
          25% { border-color: #a8e063; box-shadow: 0 0 12px rgba(168,224,99,0.4), 0 0 25px rgba(168,224,99,0.15); }
          50% { border-color: #56ab2f; box-shadow: 0 0 16px rgba(86,171,47,0.4), 0 0 30px rgba(86,171,47,0.15); }
          75% { border-color: #a8e063; box-shadow: 0 0 12px rgba(168,224,99,0.4), 0 0 25px rgba(168,224,99,0.15); }
          100% { border-color: #D9F24F; box-shadow: 0 0 8px rgba(217,242,79,0.3), 0 0 20px rgba(217,242,79,0.1); }
        }
        .ai-glow-active {
          animation: aiGradientBorder 1.5s ease-in-out infinite !important;
          border-color: #D9F24F !important;
          border-width: 2px !important;
          border-style: solid !important;
          border-radius: 12px !important;
          transition: all 0.3s ease !important;
        }
        .ai-glow-active input, .ai-glow-active textarea {
          border-color: transparent !important;
        }
        @keyframes aiPulseRing {
          0% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 0.6; }
        }
        .ai-pulse-ring {
          animation: aiPulseRing 2s ease-in-out infinite;
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .ai-shimmer {
          background: linear-gradient(90deg, transparent 0%, rgba(217,242,79,0.15) 50%, transparent 100%);
          background-size: 200% 100%;
          animation: shimmer 2s linear infinite;
        }
      `}</style>

    <motion.div
      variants={stagger}
      initial="hidden"
      animate="visible"
      className="mx-auto max-w-6xl h-[calc(100vh-140px)] flex flex-col pt-4 overflow-hidden"
    >
      {/* ── Header ── */}
      <motion.div variants={maskedReveal} className="shrink-0 bg-[#FAFAF9] pb-8 flex items-center justify-between border-b border-[#1A2406]/5 mb-12">
        <div className="space-y-1">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.back()}
            className="p-0 h-auto hover:bg-transparent text-[#1A2406]/40 hover:text-[#1A2406] mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Agreements
          </Button>
            <h1 className="font-jakarta text-5xl tracking-[-0.05em] text-[#1A2406] font-bold">
              Draft <span className="font-light text-[#1A2406]/30 italic">Agreement</span>
            </h1>
            <p className="font-sans text-[#1A2406]/30 text-[10px] font-bold tracking-widest uppercase">
              Secure Escrow • Global Service Standards
            </p>
        </div>
        <div className="p-4 bg-[#1A2406] rounded-[20px] shadow-lg shadow-[#1A2406]/20">
          <Gavel className="w-8 h-8 text-[#D9F24F]" />
        </div>
      </motion.div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start overflow-hidden">
        {/* ── Left Column: Scattered Form (Scrollable) ── */}
        <div className="lg:col-span-8 h-full overflow-y-auto scrollbar-none pr-4 -mr-4 space-y-20 pb-40">
          {/* Section: Core Identity */}
          <motion.div variants={maskedReveal} className="space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#1A2406]/5 flex items-center justify-center border border-[#1A2406]/5">
                <FileText className="w-5 h-5 text-[#1A2406]/40" />
              </div>
              <h2 className="text-xl font-jakarta font-bold text-[#1A2406] tracking-tight">Project Identity</h2>
            </div>
            
            <div className="grid grid-cols-1 gap-8">
              <div className={`space-y-3 rounded-xl p-1 transition-all duration-300 ${getFieldGlow("title")}`}>
                <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A2406]/30 ml-1">Agreement Title *</Label>
                <Input 
                  placeholder="e.g., Mobile App Design" 
                  value={formData.title} 
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })} 
                  className="bg-transparent border-0 border-b border-[#1A2406]/10 rounded-none h-14 text-2xl font-jakarta font-semibold placeholder:text-[#1A2406]/10 focus:border-[#D9F24F] focus:ring-0 transition-all px-1" 
                />
              </div>

              <div className={`space-y-3 rounded-xl p-1 transition-all duration-300 ${getFieldGlow("description")}`}>
                <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A2406]/30 ml-1">Project Narration (Optional)</Label>
                <textarea 
                  className="w-full bg-[#1A2406]/[0.02] rounded-3xl border border-[#1A2406]/5 p-6 text-base min-h-[140px] outline-none focus:ring-4 focus:ring-[#D9F24F]/10 focus:border-[#D9F24F]/30 transition-all font-medium text-[#1A2406]/70 leading-relaxed placeholder:text-[#1A2406]/10" 
                  value={formData.description} 
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Briefly state deliverables and scope..."
                ></textarea>
              </div>
            </div>
          </motion.div>

          {/* Section: Counterparty & Treasury */}
          <motion.div variants={maskedReveal} className="space-y-8 pt-4 border-t border-[#1A2406]/5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#1A2406]/5 flex items-center justify-center border border-[#1A2406]/5">
                <DollarSign className="w-5 h-5 text-[#1A2406]/40" />
              </div>
              <h2 className="text-xl font-jakarta font-bold text-[#1A2406] tracking-tight">Hiring Details</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
              <div className="space-y-3">
                <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A2406]/30 ml-1">Service Provider Wallet *</Label>
                <div className="relative">
                  <Wallet className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A2406]/20" />
                  <Input 
                    placeholder="0x..." 
                    value={formData.freelancerAddress} 
                    onChange={(e) => setFormData({ ...formData, freelancerAddress: e.target.value })} 
                    className="bg-transparent border-0 border-b border-[#1A2406]/10 rounded-none h-12 font-mono text-sm placeholder:text-[#1A2406]/10 focus:border-[#D9F24F] focus:ring-0 transition-all px-1 pr-8" 
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A2406]/30 ml-1">Service Provider Email *</Label>
                <Input 
                  type="email" 
                  placeholder="user@example.com" 
                  value={formData.receiverEmail} 
                  onChange={(e) => setFormData({ ...formData, receiverEmail: e.target.value })} 
                  className="bg-transparent border-0 border-b border-[#1A2406]/10 rounded-none h-12 text-sm placeholder:text-[#1A2406]/10 focus:border-[#D9F24F] focus:ring-0 transition-all px-1" 
                />
              </div>

              <div className={`space-y-3 rounded-xl p-1 transition-all duration-300 ${getFieldGlow("amount")}`}>
                <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A2406]/30 ml-1">PUSD Total Amount *</Label>
                <div className="relative">
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 font-jakarta font-bold text-[#1A2406]/20 text-xs">PUSD</span>
                  <Input 
                    type="number" 
                    placeholder="500" 
                    value={formData.amount} 
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })} 
                    className="bg-transparent border-0 border-b border-[#1A2406]/10 rounded-none h-12 text-2xl font-jakarta font-bold placeholder:text-[#1A2406]/10 focus:border-[#D9F24F] focus:ring-0 transition-all px-1" 
                  />
                </div>
              </div>

              <div className={`space-y-3 rounded-xl p-1 transition-all duration-300 ${getFieldGlow("dueDate")}`}>
                <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A2406]/30 ml-1">Target Completion Date *</Label>
                <div className="relative">
                  <Calendar className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A2406]/20" />
                  <Input 
                    type="date" 
                    value={formData.dueDate} 
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} 
                    className="bg-transparent border-0 border-b border-[#1A2406]/10 rounded-none h-12 text-sm focus:border-[#D9F24F] focus:ring-0 transition-all px-1 pr-8" 
                  />
                </div>
              </div>
            </div>

            {/* AI Budget Reasoning (shows after AI generates) */}
            <AnimatePresence>
              {aiBudgetReasoning && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-start gap-3 p-4 rounded-2xl bg-[#D9F24F]/5 border border-[#D9F24F]/20"
                >
                  <BrainCircuit className="w-4 h-4 text-[#D9F24F] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A2406]/30 mb-1">AI Price Reasoning</p>
                    <p className="text-xs text-[#1A2406]/60 leading-relaxed">{aiBudgetReasoning}</p>
                    {aiComplexity && (
                      <Badge variant="outline" className="mt-2 text-[8px] font-bold uppercase border-[#D9F24F]/30 text-[#1A2406]/50">
                        {aiComplexity} complexity
                      </Badge>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* AI Tech Stack (shows after AI generates) */}
            <AnimatePresence>
              {aiTechStack.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-start gap-3 p-4 rounded-2xl bg-[#1A2406]/[0.02] border border-[#1A2406]/5"
                >
                  <Zap className="w-4 h-4 text-[#1A2406]/30 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A2406]/30 mb-2">Recommended Tech Stack</p>
                    <div className="flex flex-wrap gap-1.5">
                      {aiTechStack.map((tech, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] font-semibold bg-white border-[#1A2406]/10 text-[#1A2406]/60 rounded-lg px-2.5 py-0.5">
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Section: Milestone Ledger */}
          <motion.div variants={maskedReveal} className={`space-y-8 pt-4 border-t border-[#1A2406]/5 rounded-2xl transition-all duration-300 ${aiActiveField === "milestones" ? "ai-shimmer" : ""}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full bg-[#1A2406]/5 flex items-center justify-center border border-[#1A2406]/5 transition-all ${aiActiveField === "milestones" ? "ai-pulse-ring bg-[#D9F24F]/20 border-[#D9F24F]/30" : ""}`}>
                  <Zap className="w-5 h-5 text-[#1A2406]/40" />
                </div>
                <h2 className="text-xl font-jakarta font-bold text-[#1A2406] tracking-tight">Payment Roadmap</h2>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                onClick={addMilestone}
                className="rounded-2xl border-[#1A2406]/10 hover:bg-[#1A2406] hover:text-[#D9F24F] transition-all font-bold text-[10px] uppercase tracking-widest px-6"
              >
                <Plus className="w-3.5 h-3.5 mr-2" />
                Add Payment Step
              </Button>
            </div>

            <div className="space-y-4">
              <AnimatePresence initial={false}>
                {milestones.map((milestone, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="group relative grid grid-cols-1 md:grid-cols-12 items-end gap-6 p-6 rounded-[24px] bg-white border border-[#1A2406]/5 hover:border-[#1A2406]/10 hover:shadow-xl hover:shadow-[#1A2406]/5 transition-all"
                  >
                    <div className="md:col-span-1 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-xl bg-[#1A2406] text-[#D9F24F] flex items-center justify-center text-[10px] font-bold">
                        {index + 1}
                      </div>
                    </div>
                    <div className="md:col-span-4 space-y-2">
                        <Label className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#1A2406]/20">Milestone Title</Label>
                        <Input 
                        placeholder="Deliverable Name" 
                        value={milestone.title} 
                        onChange={(e) => updateMilestone(index, "title", e.target.value)}
                        className="h-10 bg-transparent border-0 border-b border-[#1A2406]/5 rounded-none font-medium placeholder:text-[#1A2406]/10 focus:border-[#D9F24F] transition-all"
                        />
                    </div>
                    <div className="md:col-span-3 space-y-2">
                        <Label className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#1A2406]/20">Amount (PUSD)</Label>
                        <div className="relative">
                        <Input 
                            type="number" 
                            placeholder="0.00" 
                            value={milestone.amount} 
                            onChange={(e) => updateMilestone(index, "amount", e.target.value)}
                            className="h-10 bg-transparent border-0 border-b border-[#1A2406]/5 rounded-none font-bold placeholder:text-[#1A2406]/10 focus:border-[#D9F24F] transition-all pr-8"
                        />
                        <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#1A2406]/20">PUSD</span>
                        </div>
                    </div>
                    <div className="md:col-span-3 space-y-2">
                        <Label className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#1A2406]/20">Due Date</Label>
                        <div className="relative">
                          <Calendar className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A2406]/20" />
                          <Input 
                              type="date" 
                              value={milestone.dueDate} 
                              onChange={(e) => updateMilestone(index, "dueDate", e.target.value)}
                              className="h-10 bg-transparent border-0 border-b border-[#1A2406]/5 rounded-none text-sm placeholder:text-[#1A2406]/10 focus:border-[#D9F24F] transition-all pr-8"
                          />
                        </div>
                    </div>
                    <div className="md:col-span-1 flex justify-center">
                        {milestones.length > 1 && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => removeMilestone(index)}
                            className="text-[#1A2406]/10 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                        )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            
            <div className="flex items-center justify-between px-6 py-4 rounded-3xl bg-[#1A2406]/[0.02] border border-dashed border-[#1A2406]/10">
              <span className="text-[10px] font-bold text-[#1A2406]/30 uppercase tracking-[0.2em]">Escrow Balance Reconciliation</span>
              <div className="flex items-center gap-3">
                <div className="text-right">
                    <p className="text-[9px] font-bold text-[#1A2406]/20 uppercase mb-0.5">Unallocated Funds</p>
                    <p className={`text-xl font-jakarta font-bold ${
                        milestones.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0) > parseFloat(formData.amount || "0") 
                        ? "text-red-500" 
                        : "text-[#1A2406]"
                    }`}>
                        {Math.max(0, parseFloat(formData.amount || "0") - milestones.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0))} <span className="text-xs text-[#1A2406]/20 font-bold uppercase ml-1">PUSD</span>
                    </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Right Column: AI Generator + Wallet Sidebar ── */}
        <div className="lg:col-span-4 shrink-0 space-y-6 lg:h-full lg:flex lg:flex-col overflow-y-auto scrollbar-none">
          
          {/* ─── AI Agreement Generator Card ─── */}
          <motion.div variants={maskedReveal} className="flex flex-col">
            <Card className={`border-0 rounded-[32px] overflow-hidden shadow-2xl transition-all duration-500 ${
              isAiGenerating 
                ? "bg-gradient-to-br from-[#1A2406] via-[#2a3a10] to-[#1A2406]" 
                : "bg-gradient-to-br from-[#D9F24F] via-[#c4db47] to-[#a8c03a]"
            }`}>
              <CardContent className="p-6 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl ${isAiGenerating ? "bg-[#D9F24F]/20" : "bg-[#1A2406]/10"}`}>
                      <Wand2 className={`w-4 h-4 ${isAiGenerating ? "text-[#D9F24F] animate-spin" : "text-[#1A2406]"}`} />
                    </div>
                    <div>
                      <p className={`text-xs font-bold font-jakarta ${isAiGenerating ? "text-white" : "text-[#1A2406]"}`}>
                        AI Agreement Generator
                      </p>
                      <p className={`text-[8px] font-bold uppercase tracking-widest ${isAiGenerating ? "text-white/40" : "text-[#1A2406]/40"}`}>
                        Powered by Qwen3-32B
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`border-none text-[7px] font-black uppercase px-2 py-0 ${
                    isAiGenerating 
                      ? "bg-[#D9F24F]/10 text-[#D9F24F]" 
                      : "bg-[#1A2406]/10 text-[#1A2406]/60"
                  }`}>
                    {isAiGenerating ? "Generating..." : aiActiveField === "done" ? "✓ Done" : "Ready"}
                  </Badge>
                </div>

                {/* Input */}
                <div className="space-y-2">
                  <textarea
                    value={aiIdea}
                    onChange={(e) => setAiIdea(e.target.value)}
                    placeholder="Describe your project in one line...&#10;e.g., &quot;Build me a SaaS dashboard with auth and analytics&quot;"
                    disabled={isAiGenerating}
                    className={`w-full rounded-2xl border p-4 text-sm min-h-[80px] outline-none resize-none transition-all font-medium leading-relaxed ${
                      isAiGenerating
                        ? "bg-white/5 border-white/10 text-white/60 placeholder:text-white/20"
                        : "bg-white/60 border-[#1A2406]/10 text-[#1A2406] placeholder:text-[#1A2406]/30 focus:ring-4 focus:ring-[#1A2406]/5 focus:border-[#1A2406]/20"
                    }`}
                  />
                </div>

                {/* Generate Button */}
                <motion.div whileTap={BUTTON_PRESS}>
                  <Button
                    onClick={handleAiGenerate}
                    disabled={isAiGenerating || !aiIdea.trim()}
                    className={`w-full h-12 rounded-2xl font-jakarta font-bold text-xs transition-all active:scale-95 disabled:opacity-40 ${
                      isAiGenerating
                        ? "bg-[#D9F24F] text-[#1A2406]"
                        : "bg-[#1A2406] text-[#D9F24F] hover:bg-[#2a3a10] shadow-lg shadow-[#1A2406]/20"
                    }`}
                  >
                    {isAiGenerating ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating Agreement...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Generate with AI
                      </span>
                    )}
                  </Button>
                </motion.div>

                {/* AI Progress Steps */}
                <AnimatePresence>
                  {isAiGenerating && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-1.5 pt-2"
                    >
                      {[
                        { field: "title" as const, label: "Project Title" },
                        { field: "description" as const, label: "Description" },
                        { field: "amount" as const, label: "Market Price" },
                        { field: "dueDate" as const, label: "Timeline" },
                        { field: "milestones" as const, label: "Milestones" },
                      ].map((step) => {
                        const fieldOrder: AiActiveField[] = ["title", "description", "amount", "dueDate", "milestones"];
                        const currentIdx = fieldOrder.indexOf(aiActiveField);
                        const stepIdx = fieldOrder.indexOf(step.field);
                        const isActive = aiActiveField === step.field;
                        const isDone = currentIdx > stepIdx;

                        return (
                          <div key={step.field} className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all ${
                            isActive ? "bg-[#D9F24F]/10" : ""
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full transition-all ${
                              isDone ? "bg-[#D9F24F]" : isActive ? "bg-[#D9F24F] animate-pulse" : "bg-white/10"
                            }`} />
                            <span className={`text-[10px] font-bold uppercase tracking-widest transition-all ${
                              isDone ? "text-[#D9F24F]/80" : isActive ? "text-white" : "text-white/20"
                            }`}>
                              {isDone ? "✓ " : ""}{step.label}
                            </span>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>

          {/* Section: Simple Wallet Card - COMPACTED */}
          <motion.div variants={maskedReveal} className="flex flex-col">
            <Card className="border-0 bg-[#1A2406] text-white rounded-[32px] overflow-hidden shadow-2xl shadow-[#1A2406]/30">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#D9F24F] animate-pulse" />
                        <span className="text-[8px] font-bold uppercase tracking-widest text-white/40 leading-none">Smart Node</span>
                    </div>
                    <Badge variant="outline" className="bg-[#D9F24F]/10 text-[#D9F24F] border-none text-[7px] font-black uppercase px-2 py-0">
                        {isSmartAccountMode ? "AA" : "EOA"}
                    </Badge>
                </div>
                
                <div className="grid grid-cols-1 gap-2">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                    <span className="text-[8px] font-bold uppercase tracking-widest text-white/20">Vault</span>
                    <p className="text-[10px] font-mono font-bold text-[#D9F24F]">
                        {smartAccountAddress ? shortAddress(smartAccountAddress) : "OFF"}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                    <span className="text-[8px] font-bold uppercase tracking-widest text-white/20">Signer</span>
                    <p className="text-[10px] font-mono font-bold text-white/60">
                        {permitOwnerAddress ? shortAddress(permitOwnerAddress) : "OFF"}
                    </p>
                  </div>
                </div>

                <Button 
                  className="w-full h-12 rounded-2xl bg-[#D9F24F] text-[#1A2406] font-jakarta font-bold text-xs hover:bg-[#c4db47] shadow-lg shadow-[#D9F24F]/10 transition-all active:scale-95 disabled:opacity-20" 
                  disabled={isFunding || !permitOwnerAddress} 
                  onClick={handleCreateAgreement}
                >
                  {isFunding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Authorize & Lock Funds"
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
    </>
  );
}
