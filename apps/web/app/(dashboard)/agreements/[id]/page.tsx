"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  ShieldCheck, 
  Clock, 
  Wallet, 
  FileText, 
  CheckCircle2, 
  Zap, 
  DollarSign, 
  User, 
  Calendar,
  ChevronRight,
  Shield,
  Box,
  ArrowUpRight,
  Loader2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";  
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  formatPusdAmount,
  getEscrowContract,
  getProjectById,
  shortAddress,
  type OnchainProject,
  scalePusdAmount,
  ESCROW_CONTRACT_ADDRESS,
} from "@/lib/escrow";
import { thirdwebClient } from "@/lib/thirdweb-client";
import { useActiveAccount, useActiveWallet, useAdminWallet } from "thirdweb/react";
import { prepareContractCall, sendAndConfirmTransaction } from "thirdweb";

// ─── Animation Config ───
const SPRING = { type: "spring" as const, stiffness: 300, damping: 30 };
const maskedReveal = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

/* ─── Types ─── */
interface Milestone {
  id: string;
  title: string;
  description?: string;
  amount: number;
  status: string;
  dueDate?: string;
}

interface Agreement {
  id: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  creator: { name: string; email: string; phoneNumber?: string; address?: string };
  receiver: { name: string; email: string; phoneNumber?: string; address?: string };
  milestones: Milestone[];
  projectId?: number;
  receiverAddress?: string;
  transactionHash?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

export default function AgreementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const adminWallet = useAdminWallet();
  const adminAccount = activeWallet?.getAdminAccount?.() || adminWallet?.getAccount?.();
  const activeSigner = adminAccount || account;

  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [onchainData, setOnchainData] = useState<OnchainProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReleasing, setIsReleasing] = useState(false);

  const escrowContract = useMemo(() => getEscrowContract(thirdwebClient), []);

  const fetchDetails = async () => {
    try {
      setIsLoading(true);
      
      let agreementData: Agreement | null = null;
      let targetProjectId: number | null = null;

      // FIRST: Always try to fetch directly by ID
      try {
        const res = await fetch(`${API_BASE_URL}/agreements/${id}`);
        if (res.ok) {
          const data = await res.json();
          agreementData = data.agreement || null;
          targetProjectId = agreementData?.projectId ?? null;
        }
      } catch (e) {
        console.warn("Direct DB fetch failed", e);
      }

      // SECOND: If not found but looks like "pid-X" or just a number, try by projectId
      if (!agreementData) {
        if (id.startsWith("pid-")) {
          targetProjectId = parseInt(id.replace("pid-", ""));
        } else if (!isNaN(Number(id))) {
          targetProjectId = Number(id);
        }

        if (targetProjectId !== null && !isNaN(targetProjectId)) {
          try {
            const searchRes = await fetch(`${API_BASE_URL}/agreements/search?projectId=${targetProjectId}`);
            if (searchRes.ok) {
              const searchData = await searchRes.json();
              agreementData = searchData.agreement || null;
            }
          } catch (e) {
            console.warn("DB search failed or off-chain data missing", e);
          }
        }
      }

      setAgreement(agreementData);

      // 2. Fetch On-chain Data
      if (targetProjectId !== null) {
        try {
          const onchain = await getProjectById(thirdwebClient, BigInt(targetProjectId));
          setOnchainData(onchain);
        } catch (e) {
          console.error("On-chain fetch failed", e);
        }
      }
    } catch (error) {
      console.error("Error fetching details:", error);
      toast.error("Failed to load project details");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchDetails();
  }, [id]);

  const handleReleaseFull = async () => {
    if (!onchainData || !activeSigner) return;
    try {
      setIsReleasing(true);
      const remaining = onchainData.amount - onchainData.releasedAmount;
      
      const tx = prepareContractCall({
        contract: escrowContract,
        method: "function releaseMilestone(uint256 _projectId, uint256 _amount)",
        params: [onchainData.projectId, remaining],
      });

      await sendAndConfirmTransaction({
        account: activeSigner,
        transaction: tx,
      });

      toast.success("Funds successfully released!");
      fetchDetails();
    } catch (error: any) {
      console.error("Release failed:", error);
      toast.error(error?.message || "Transaction failed");
    } finally {
      setIsReleasing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#1A2406]/10" />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A2406]/20">Synthesizing Ledger Details</p>
      </div>
    );
  }

  if (!agreement && !onchainData) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <AlertCircle className="w-10 h-10 text-red-100" />
        <p className="text-sm font-jakarta font-medium text-[#1A2406]/40">Record not found in the protocol</p>
        <Button onClick={() => router.back()} variant="ghost" className="text-xs font-bold uppercase tracking-widest gap-2">
          <ArrowLeft className="w-4 h-4" /> Go Back
        </Button>
      </div>
    );
  }

  const displayTitle = agreement?.title || (onchainData ? `Protocol Project #${onchainData.projectId.toString()}` : "Unknown Project");
  const displayStatus = agreement?.status || (onchainData?.isCompleted ? "COMPLETED" : onchainData?.isFunded ? "FUNDED" : "PENDING");
  const displayId = agreement?.id || (onchainData ? `ONCHAIN-PID-${onchainData.projectId.toString()}` : id);

  const bTotal = onchainData ? BigInt(onchainData.amount) : BigInt(0);
  const bPaid = onchainData ? BigInt(onchainData.releasedAmount) : BigInt(0);
  const remaining = bTotal - bPaid;
  const progress = bTotal > BigInt(0) ? Number((bPaid * BigInt(100)) / bTotal) : 0;

  return (
    <motion.div 
      initial="hidden" 
      animate="visible" 
      variants={stagger}
      className="mx-auto max-w-6xl pt-2 pb-20 space-y-12"
    >
      {/* ── Header ── */}
      <motion.div variants={maskedReveal} className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 border-b border-[#1A2406]/5 pb-12 px-1">
        <div className="space-y-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.back()}
            className="p-0 h-auto hover:bg-transparent text-[#1A2406]/40 hover:text-[#1A2406] transition-colors gap-2 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Back to Registry</span>
          </Button>
          
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-jakarta font-bold tracking-[-0.04em] text-[#1A2406]">
                {displayTitle}
              </h1>
              <Badge className="bg-[#D9F24F] text-[#1A2406] border-none font-black text-[9px] uppercase px-3 py-1 rounded-full shadow-lg shadow-[#D9F24F]/10">
                {displayStatus}
              </Badge>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1A2406]/30 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1A2406]/10" />
              Protocol Reference: {displayId}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {onchainData && (
            <div className="flex flex-col items-end gap-1 px-6 py-4 rounded-3xl bg-[#1A2406]/[0.02] border border-[#1A2406]/5">
              <p className="text-[8px] font-bold uppercase tracking-widest text-[#1A2406]/20">On-Chain Vault</p>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#D9F24F]" />
                <span className="text-sm font-jakarta font-bold text-[#1A2406]">Verified Protocol Project</span>
              </div>
            </div>
          )}
          <div className="p-5 bg-[#1A2406] rounded-[32px] shadow-2xl shadow-[#1A2406]/20">
            <FileText className="w-8 h-8 text-[#D9F24F]" />
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* ── Main Content ── */}
        <div className="lg:col-span-8 space-y-16">
          
          {agreement ? (
            <>
              {/* Section: Narrative */}
              <motion.section variants={maskedReveal} className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-white shadow-sm border border-[#1A2406]/5 flex items-center justify-center">
                    <Box className="w-5 h-5 text-[#1A2406]/40" />
                  </div>
                  <h2 className="text-xl font-jakarta font-bold text-[#1A2406]">Agreement Terms</h2>
                </div>
                
                <div className="p-10 rounded-[40px] bg-white border border-[#1A2406]/5 shadow-sm space-y-8">
                  <div className="space-y-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A2406]/20">The Agreement</p>
                    <p className="text-lg font-medium text-[#1A2406]/80 leading-relaxed italic font-serif">
                      "{agreement.description || "No precise project narration was documented."}"
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-12 pt-8 border-t border-[#1A2406]/5">
                    <div className="space-y-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A2406]/20">People Involved</p>
                      <div className="space-y-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-[#FAFAF9] flex items-center justify-center">
                            <User className="w-5 h-5 text-[#1A2406]/30" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[8px] font-bold uppercase tracking-widest text-[#1A2406]/30">Hiring Party</p>
                            <p className="text-sm font-bold text-[#1A2406]">{agreement.creator?.name}</p>
                            {agreement.creator?.email && <p className="text-xs text-[#1A2406]/60">{agreement.creator.email}</p>}
                            {agreement.creator?.phoneNumber && <p className="text-xs text-[#1A2406]/60">{agreement.creator.phoneNumber}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-[#FAFAF9] flex items-center justify-center">
                            <Shield className="w-5 h-5 text-[#1A2406]/30" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[8px] font-bold uppercase tracking-widest text-[#1A2406]/30">Service Provider</p>
                            <p className="text-sm font-bold text-[#1A2406]">{agreement.receiver?.name}</p>
                            {agreement.receiver?.email && <p className="text-xs text-[#1A2406]/60">{agreement.receiver.email}</p>}
                            {agreement.receiver?.phoneNumber && <p className="text-xs text-[#1A2406]/60">{agreement.receiver.phoneNumber}</p>}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A2406]/20">Timeline</p>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-[#FAFAF9] flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-[#1A2406]/30" />
                        </div>
                        <div>
                          <p className="text-[8px] font-bold uppercase tracking-widest text-[#1A2406]/30">Started On</p>
                          <p className="text-sm font-bold text-[#1A2406]">
                            {new Date(agreement.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.section>

              {/* Section: Milestone Registry */}
              <motion.section variants={maskedReveal} className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-white shadow-sm border border-[#1A2406]/5 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-[#1A2406]/40" />
                  </div>
                  <h2 className="text-xl font-jakarta font-bold text-[#1A2406]">Payment Roadmap</h2>
                </div>

                <div className="space-y-4">
                  {agreement.milestones && agreement.milestones.length > 0 ? agreement.milestones.map((ms, idx) => (
                    <div key={ms.id} className="group relative p-6 rounded-[28px] bg-white border border-[#1A2406]/5 hover:border-[#D9F24F] transition-all duration-500">
                      <div className="flex items-start justify-between gap-6">
                        <div className="flex gap-6">
                          <div className="text-[10px] font-black text-[#1A2406]/10 mt-1">0{idx + 1}</div>
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-jakarta font-bold text-[#1A2406] text-lg leading-none">{ms.title}</h4>
                              <p className="text-xs text-[#1A2406]/40 mt-2 leading-relaxed">{ms.description || "No specific technical requirements documented."}</p>
                            </div>
                            <div className="flex items-center gap-6">
                              <div className="flex items-center gap-2">
                                 <DollarSign className="w-3.5 h-3.5 text-[#1A2406]/20" />
                                 <span className="text-sm font-bold text-[#1A2406]">{ms.amount} <span className="text-[10px] text-[#1A2406]/30 uppercase">PUSD</span></span>
                              </div>
                              {ms.dueDate && (
                                <div className="flex items-center gap-2">
                                   <Calendar className="w-3.5 h-3.5 text-[#1A2406]/20" />
                                   <span className="text-[10px] font-bold uppercase tracking-wider text-[#1A2406]/40">{new Date(ms.dueDate).toLocaleDateString()}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className="rounded-full bg-[#FAFAF9] text-[8px] font-black uppercase tracking-widest text-[#1A2406]/30 border-none px-3 py-1">
                          {ms.status}
                        </Badge>
                      </div>
                    </div>
                  )) : (
                    <div className="p-8 rounded-[28px] bg-[#1A2406]/[0.02] border border-dashed border-[#1A2406]/10 text-center">
                       <p className="text-xs text-[#1A2406]/30 font-medium italic">No milestones defined for this agreement.</p>
                    </div>
                  )}
                </div>
              </motion.section>
            </>
          ) : (
            <motion.section variants={maskedReveal} className="p-10 rounded-[40px] bg-white border border-[#1A2406]/5 shadow-sm space-y-8 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-3xl bg-[#FAFAF9] flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-[#1A2406]/30" />
              </div>
              <h2 className="text-2xl font-jakarta font-bold text-[#1A2406]">Off-chain Data Missing</h2>
              <p className="text-sm text-[#1A2406]/50 max-w-md mx-auto leading-relaxed">
                This project exists securely on the smart contract, but its off-chain details (title, description, payment roadmap, user profiles) were not found in the platform registry.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-6 mt-8 p-6 bg-[#FAFAF9] rounded-3xl text-left w-full justify-center">
                 <div className="space-y-1 text-center sm:text-left">
                   <p className="text-[10px] uppercase tracking-widest font-bold text-[#1A2406]/30">Client Wallet</p>
                   <p className="font-mono text-sm text-[#1A2406]">{onchainData ? shortAddress(onchainData.client) : "..."}</p>
                 </div>
                 <div className="hidden sm:block w-px h-10 bg-[#1A2406]/10 mx-4" />
                 <div className="space-y-1 text-center sm:text-left">
                   <p className="text-[10px] uppercase tracking-widest font-bold text-[#1A2406]/30">Freelancer Wallet</p>
                   <p className="font-mono text-sm text-[#1A2406]">{onchainData ? shortAddress(onchainData.freelancer) : "..."}</p>
                 </div>
              </div>
            </motion.section>
          )}
        </div>

        {/* ── Sidebar: Financial State ── */}
        <div className="lg:col-span-4 sticky top-8 space-y-8">
          
          {/* Vault Balance Card */}
          <motion.div variants={maskedReveal}>
            <Card className="border-0 bg-[#1A2406] text-white rounded-[40px] overflow-hidden shadow-2xl shadow-[#1A2406]/40">
              <div className="absolute top-0 left-0 w-full h-1 bg-white/10">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-[#D9F24F]"
                />
              </div>
              
              <CardContent className="p-8 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#D9F24F] animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Payment Status</span>
                  </div>
                  <Badge className="bg-white/10 text-white/60 text-[8px] font-mono border-none">LIVE</Badge>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-[40px] font-jakarta font-bold tracking-tighter leading-none">
                      {formatPusdAmount(remaining)}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#D9F24F]">Available in Vault</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                    <div>
                      <p className="text-[8px] font-bold uppercase tracking-widest text-white/20 mb-1">Total PUSD</p>
                      <p className="text-sm font-bold text-white/80">{formatPusdAmount(bTotal)}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-bold uppercase tracking-widest text-white/20 mb-1">Paid Out</p>
                      <p className="text-sm font-bold text-[#D9F24F]">-{formatPusdAmount(bPaid)}</p>
                    </div>
                  </div>
                </div>

                {onchainData && !onchainData.isCompleted && remaining > 0n && (
                   <Button 
                    disabled={isReleasing || !activeSigner}
                    onClick={handleReleaseFull}
                    className="w-full h-14 rounded-2xl bg-[#D9F24F] text-[#1A2406] hover:bg-[#c4db47] font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl shadow-[#D9F24F]/10"
                   >
                     {isReleasing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Zap className="w-4 h-4" /> Authorize Full Payout</>}
                   </Button>
                )}

                {!onchainData && (
                  <div className="p-6 rounded-3xl bg-white/5 border border-white/5 text-center space-y-4">
                    <ShieldCheck className="w-8 h-8 text-white/10 mx-auto" />
                    <p className="text-[10px] text-white/40 font-medium leading-relaxed italic">
                      This agreement matches an off-chain record. Escrow funding pending.
                    </p>
                  </div>
                )}

                {onchainData?.isCompleted && (
                  <div className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-white/5 text-[#D9F24F] border border-white/5 text-[10px] font-bold uppercase tracking-widest">
                    <CheckCircle2 className="w-4 h-4" /> Vault Fully Settled
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Verification Footnote */}
          <motion.div variants={maskedReveal} className="p-8 rounded-[32px] bg-[#1A2406]/[0.02] border border-dashed border-[#1A2406]/10 flex flex-col items-center text-center gap-6">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-[#1A2406]/40" />
            </div>
            <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A2406] mb-2">Network Verification</p>
                <p className="text-[10px] font-medium text-[#1A2406]/40 leading-relaxed">
                    Protected by PayCrow Secure Protocol.<br/>
                    On-chain protection: {shortAddress(ESCROW_CONTRACT_ADDRESS)}
                </p>
            </div>
            <div className="w-full pt-4 border-t border-[#1A2406]/5">
              <p className="text-[9px] font-mono text-[#1A2406]/20 truncate">
                {onchainData?.freelancer ? `Target: ${onchainData.freelancer}` : "Identity Pending"}
              </p>
            </div>
          </motion.div>

        </div>
      </div>
    </motion.div>
  );
}
