"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Loader2,
  Plus,
  Send,
  ShieldCheck,
  Wallet,
  Zap,
  ChevronRight,
  ShieldAlert,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import { ConnectButton, useActiveAccount, useActiveWallet, useAdminWallet } from "thirdweb/react";
import { sepolia } from "thirdweb/chains";
import { prepareContractCall, readContract, sendAndConfirmTransaction } from "thirdweb";
import { verifyTypedData } from "viem";

import {
  ESCROW_CONTRACT_ADDRESS,
  PUSD_CONTRACT_ADDRESS,
  PERMIT_DOMAIN,
  getEscrowContract,
  getPusdContract,
  getPermitNonce,
  getProjectsForClient,
  scalePusdAmount,
  formatPusdAmount,
  splitSignature,
  shortAddress,
  type OnchainProject,
} from "@/lib/escrow";
import { thirdwebClient } from "@/lib/thirdweb-client";

// ─── Animation Variants ───
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
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: SPRING }
};

/* ─── Types ────────────────────────────────────────────────────────────── */

interface Agreement {
  id: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  creator: { id: string; name: string; email: string };
  receiver: { id: string; name: string; email: string };
  milestones: Milestone[];
  projectId?: number;
}

interface Milestone {
  id: string;
  title: string;
  description?: string;
  amount: number;
  status: string;
  dueDate?: string;
}

type TxStep = "idle" | "signing" | "funding" | "verified" | "error";

const txStepMeta: Record<TxStep, { label: string; color: string }> = {
  idle: { label: "Ready", color: "bg-slate-100 text-slate-600" },
  signing: { label: "Signing Permit", color: "bg-amber-100 text-amber-700" },
  funding: { label: "Locking Funds", color: "bg-blue-100 text-blue-700" },
  verified: { label: "Verified ✓", color: "bg-emerald-100 text-emerald-700" },
  error: { label: "Failed", color: "bg-red-100 text-red-700" },
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

/* ─── Main Page Component ──────────────────────────────────────────────── */

export default function AgreementsPage() {
  const { data: session } = authClient.useSession();
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const adminWallet = useAdminWallet();
  const adminAccount = activeWallet?.getAdminAccount?.() || adminWallet?.getAccount?.();

  const [incomingAgreements, setIncomingAgreements] = useState<Agreement[]>([]);
  const [outgoingAgreements, setOutgoingAgreements] = useState<Agreement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [txStep, setTxStep] = useState<TxStep>("idle");

  const [fundedProjects, setFundedProjects] = useState<OnchainProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // Release milestone state
  const [releasingProjectId, setReleasingProjectId] = useState<bigint | null>(null);
  const [releaseAmount, setReleaseAmount] = useState("");
  const [isReleasing, setIsReleasing] = useState(false);
  const [activeTab, setActiveTab] = useState<"incoming" | "outgoing">("incoming");

  const escrowContract = useMemo(() => getEscrowContract(thirdwebClient), []);
  const pusdContract = useMemo(() => getPusdContract(thirdwebClient), []);

  const permitOwnerAddress = adminAccount?.address || account?.address || null;
  const smartAccountAddress = account?.address || null;
  const isSmartAccountMode =
    Boolean(smartAccountAddress) &&
    Boolean(adminAccount?.address) &&
    smartAccountAddress !== adminAccount?.address;

  /* ─── Data Fetching ──────────────────────────────────────────────── */

  const fetchAgreements = async () => {
    if (!session?.user?.id) return;
    try {
      setIsLoading(true);
      const [incomingRes, outgoingRes] = await Promise.all([
        fetch(`${API_BASE_URL}/agreements/incoming?userId=${session.user.id}`),
        fetch(`${API_BASE_URL}/agreements/outgoing?userId=${session.user.id}`),
      ]);
      if (incomingRes.ok) {
        const data = await incomingRes.json();
        setIncomingAgreements(data.agreements || []);
      }
      if (outgoingRes.ok) {
        const data = await outgoingRes.json();
        setOutgoingAgreements(data.agreements || []);
      }
    } catch (error) {
      console.error("Error fetching agreements:", error);
      toast.error(`Failed to fetch agreements - make sure the API server is running on ${API_BASE_URL}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOnchainProjects = async () => {
    if (!permitOwnerAddress) {
      setFundedProjects([]);
      return;
    }
    try {
      setIsLoadingProjects(true);
      const projects = await getProjectsForClient(thirdwebClient, permitOwnerAddress, 12);
      setFundedProjects(projects);
    } catch (error) {
      console.error("Error fetching onchain projects:", error);
      toast.error("Failed to load funded projects from chain");
    } finally {
      setIsLoadingProjects(false);
    }
  };

  useEffect(() => {
    if (session?.user?.id) fetchAgreements();
  }, [session?.user?.id]);

  useEffect(() => {
    fetchOnchainProjects();
  }, [permitOwnerAddress]);


  /* ─── Release Milestone ──────────────────────────────────────────── */

  const handleReleaseMilestone = async (projectId: bigint) => {
    if (!releaseAmount || Number(releaseAmount) <= 0) {
      toast.error("Enter a valid PUSD amount to release");
      return;
    }

    const fundingAccount = adminAccount || account;
    if (!fundingAccount) {
      toast.error("Connect your wallet first");
      return;
    }

    try {
      setIsReleasing(true);
      const scaledRelease = scalePusdAmount(releaseAmount);

      const tx = prepareContractCall({
        contract: escrowContract,
        method: "function releaseMilestone(uint256 _projectId, uint256 _amount)",
        params: [projectId, scaledRelease],
      });

      await sendAndConfirmTransaction({
        account: fundingAccount,
        transaction: tx,
      });

      toast.success(`Released ${releaseAmount} PUSD to the freelancer!`);
      setReleaseAmount("");
      setReleasingProjectId(null);

      // Refresh project data
      fetchOnchainProjects();
    } catch (error: any) {
      console.error("Release milestone failed:", error);
      toast.error(error?.message || "Failed to release milestone");
    } finally {
      setIsReleasing(false);
    }
  };

  /* ─── Status Badge Colors ────────────────────────────────────────── */

  const getStatusStyle = (status: string) => {
    switch (status.toUpperCase()) {
      case "PENDING":
      case "AWAITING ACTION":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "ACTIVE":
      case "FUNDED":
      case "ACTIVE CONTRACT":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "COMPLETED":
      case "SETTLED":
      case "SUCCESSFULLY SETTLED":
        return "bg-blue-50 text-blue-700 border-blue-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toUpperCase()) {
      case "PENDING": return "Awaiting Action";
      case "FUNDED": return "Active Contract";
      case "COMPLETED": return "Successfully Settled";
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toUpperCase()) {
      case "PENDING": return <Clock className="w-3.5 h-3.5" />;
      case "ACTIVE": return <Zap className="w-3.5 h-3.5" />;
      case "COMPLETED": return <CheckCircle2 className="w-3.5 h-3.5" />;
      case "CANCELLED": return <AlertCircle className="w-3.5 h-3.5" />;
      case "FUNDED": return <ShieldCheck className="w-3.5 h-3.5" />;
      default: return <Clock className="w-3.5 h-3.5" />;
    }
  };

  /* ─── Sub-components ─────────────────────────────────────────────── */

  const AgreementCard = ({ agreement, type }: { agreement: Agreement; type: "incoming" | "outgoing" }) => (
    <motion.div variants={itemVariants} whileHover={HOVER_SCALE}>
      <Card className="group relative bg-white/40 backdrop-blur-xl border border-white/60 rounded-[28px] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:border-[#1A2406]/10 transition-all duration-500">
        <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent pointer-events-none" />
        
        <CardHeader className="pb-3 relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5 ${getStatusStyle(agreement.status)}`}>
                  {getStatusIcon(agreement.status)}
                  {agreement.status}
                </Badge>
                <span className="text-[10px] font-mono text-[#1A2406]/20 font-bold uppercase tracking-widest">#{agreement.id.slice(-6)}</span>
              </div>
              <Link href={`/agreements/${agreement.id}`}>
                <CardTitle className="text-lg font-jakarta font-bold text-[#1A2406] tracking-tight mt-2 flex items-center gap-2 hover:text-[#D9F24F] transition-colors cursor-pointer">
                  {agreement.title}
                  <ChevronRight className="w-4 h-4 text-[#1A2406]/10 group-hover:translate-x-1 transition-transform" />
                </CardTitle>
              </Link>
            </div>
            <div className="p-2.5 bg-white/80 rounded-xl border border-white shadow-sm shrink-0">
              <FileText className="w-5 h-5 text-[#1A2406]" />
            </div>
          </div>
          <CardDescription className="text-[11px] font-medium text-[#1A2406]/40 mt-1">
            {type === "incoming"
              ? <>From Hiring Party: <span className="text-[#1A2406]">{agreement.creator.name}</span></>
              : <>To Service Provider: <span className="text-[#1A2406]">{agreement.receiver.name}</span></>}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 relative z-10">
          {agreement.description && (
            <p className="text-sm text-[#1A2406]/70 leading-relaxed line-clamp-2 italic font-serif">
              "{agreement.description}"
            </p>
          )}
          
          <div className="grid grid-cols-2 gap-4 pb-2">
            <div className="rounded-xl bg-slate-50/50 p-3 border border-black/[0.02]">
              <p className="text-[9px] font-bold text-[#1A2406]/20 uppercase tracking-widest leading-none mb-1.5">Full Budget</p>
              <p className="text-lg font-bold text-[#1A2406]">
                {agreement.amount} <span className="text-[10px] text-[#1A2406]/40 uppercase">{agreement.currency}</span>
              </p>
            </div>
            <div className="rounded-xl bg-slate-50/50 p-3 border border-black/[0.02]">
              <p className="text-[9px] font-bold text-[#1A2406]/20 uppercase tracking-widest leading-none mb-1.5">Milestones</p>
              <p className="text-lg font-bold text-[#1A2406]">{agreement.milestones.length}</p>
            </div>
          </div>
          
          <div className="pt-3 border-t border-white/40 flex items-center justify-between">
            <span className="text-[10px] font-medium text-[#1A2406]/30 flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              {new Date(agreement.createdAt).toLocaleDateString()}
            </span>
            <Button
              asChild
              variant="ghost"
              className="text-[10px] h-auto p-0 font-bold tracking-[0.1em] uppercase text-[#1A2406]/40 hover:text-[#1A2406] hover:bg-transparent transition-colors group/btn"
            >
              <Link href={`/agreements/${agreement.id}`}>
                View Details <ArrowUpRight className="w-3.5 h-3.5 group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5 transition-transform" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  const ProjectCard = ({ project }: { project: OnchainProject }) => {
    const metadata = useMemo(() => {
      const pId = Number(project.projectId);
      const all = [...incomingAgreements, ...outgoingAgreements];
      // Try fuzzy matching on string or number
      return all.find((a: any) => Number(a.projectId) === pId);
    }, [project.projectId, incomingAgreements, outgoingAgreements]);

    const detailUrl = metadata 
      ? `/agreements/${metadata.id}` 
      : `/agreements/pid-${project.projectId.toString()}`;

    const bTotal = BigInt(project.amount);
    const bPaid = BigInt(project.releasedAmount);
    
    const totalStr = formatPusdAmount(bTotal);
    const paidStr = formatPusdAmount(bPaid);
    const remaining = bTotal - bPaid;
    const remainingStr = formatPusdAmount(remaining);

    const status = project.isCompleted ? "COMPLETED" : project.isFunded ? "FUNDED" : "PENDING";
    const displayStatus = getStatusLabel(status);
    
    return (
      <motion.div variants={itemVariants} whileHover={HOVER_SCALE}>
        <Card className="group relative bg-white border border-[#1A2406]/5 rounded-[32px] overflow-hidden shadow-sm hover:shadow-xl hover:shadow-[#1A2406]/5 transition-all duration-500">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-[#D9F24F]/10 overflow-hidden">
            <motion.div 
              initial={{ x: "-100%" }}
              animate={{ x: "0%" }}
              transition={{ duration: 1.5, ease: "circOut" }}
              className="h-full bg-[#D9F24F]"
              style={{ width: bTotal > BigInt(0) ? `${Number((bPaid * BigInt(100)) / bTotal)}%` : "0%" }}
            />
          </div>

          <CardHeader className="pb-4 pt-8 px-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <Link href={detailUrl}>
                  <h3 className="text-lg font-jakarta font-bold text-[#1A2406] leading-tight hover:text-[#D9F24F] transition-colors cursor-pointer flex items-center gap-2">
                    {metadata?.title || `Protocol #${project.projectId.toString()}`}
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                </Link>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-[#1A2406]/20 uppercase tracking-widest">
                    Sent to Service Provider: {metadata?.receiver?.name || shortAddress(project.freelancer)}
                  </span>
                </div>
              </div>
              <Badge variant="outline" className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider border-none ${getStatusStyle(status)}`}>
                {displayStatus}
              </Badge>
            </div>
            
            {metadata?.description && (
              <p className="text-xs text-[#1A2406]/50 line-clamp-2 leading-relaxed">
                {metadata.description}
              </p>
            )}
          </CardHeader>

          <CardContent className="px-6 pb-6 space-y-6">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <p className="text-[8px] font-bold text-[#1A2406]/20 uppercase tracking-widest">Full Budget</p>
                <p className="text-xs font-bold text-[#1A2406]">{totalStr}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[8px] font-bold text-[#1A2406]/20 uppercase tracking-widest">Payment Sent</p>
                <p className="text-xs font-bold text-emerald-600">-{paidStr}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[8px] font-bold text-[#1A2406]/20 uppercase tracking-widest">Available</p>
                <p className="text-xs font-bold text-[#1A2406]">{remainingStr}</p>
              </div>
            </div>

            <div className="space-y-3">
              {project.isFunded && !project.isCompleted && remaining > 0n && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setReleasingProjectId(project.projectId);
                      setReleaseAmount(remainingStr);
                    }}
                    className="flex-1 h-11 bg-[#1A2406] text-white hover:bg-[#2c3d0a] font-bold rounded-2xl text-[10px] uppercase tracking-widest shadow-lg shadow-[#1A2406]/10 transition-all active:scale-95"
                  >
                    Settle Full Balance
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="w-11 h-11 p-0 border-[#1A2406]/10 hover:bg-[#D9F24F]/10 rounded-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                  >
                    <Link href={detailUrl}>
                      <ArrowUpRight className="w-4 h-4 text-[#1A2406]" />
                    </Link>
                  </Button>
                </div>
              )}

              {project.isCompleted && (
                <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 italic text-[10px] font-bold uppercase tracking-widest">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Vault fully settled
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const tabs = [
    { id: "incoming", label: "Incoming", count: incomingAgreements.length },
    { id: "outgoing", label: "Outgoing", count: outgoingAgreements.length },
  ];

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="visible"
      className="mx-auto max-w-6xl space-y-10 pt-2 pb-12"
    >

      {/* ── Header Section ── */}
      <motion.div variants={maskedReveal} className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 px-1">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-[#1A2406] text-[#D9F24F] text-[10px] font-bold tracking-[0.2em] px-3 py-1.5 rounded-full border border-[#D9F24F]/20 flex items-center gap-1.5 uppercase leading-none">
              <ShieldAlert className="w-3.5 h-3.5" />
              PayCrow Secure Escrow
            </span>
          </div>
          <h1 className="font-jakarta text-4xl tracking-[-0.04em] text-[#1A2406]">
            Agreements <span className="font-light text-[#1A2406]/40">& Ledgers</span>
          </h1>
          <p className="font-sans text-[#1A2406]/30 text-sm font-medium">
            Manage your on-chain milestone payouts and document digital contracts.
          </p>
        </div>
        
        <Link href="/agreements/new-agreement">
          <motion.div whileHover={HOVER_SCALE} whileTap={BUTTON_PRESS}>
            <button className="rounded-xl bg-[#1A2406] text-white px-6 py-3.5 text-xs font-bold tracking-tight flex items-center gap-2 shadow-xl shadow-[#1A2406]/10">
              <Plus className="w-4 h-4 text-[#D9F24F]" />
              Create New Agreement
            </button>
          </motion.div>
        </Link>
      </motion.div>

      {/* ── On-chain Projects Section ── */}
      <motion.div variants={maskedReveal} className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-jakarta text-xl font-bold tracking-tight text-[#1A2406] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            Active Vault Projects
          </h2>
          <Badge variant="outline" className="rounded-full bg-slate-50 text-[10px] font-bold text-[#1A2406]/30 uppercase tracking-widest border-none">
            On-Chain Verified
          </Badge>
        </div>
        
        {isLoadingProjects ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-[#1A2406]/10" />
            <p className="text-[10px] font-bold tracking-[0.2em] text-[#1A2406]/20 uppercase">Scanning Blockchain Ledgers</p>
          </div>
        ) : fundedProjects.length === 0 ? (
          <div className="bg-white/40 backdrop-blur-md border border-dashed border-[#1A2406]/5 rounded-[32px] p-16 text-center">
            <ShieldCheck className="w-10 h-10 text-[#1A2406]/10 mx-auto mb-4" />
            <p className="text-sm text-[#1A2406]/30 font-medium italic">No active vault projects found for this wallet.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {fundedProjects.map((project) => (
              <ProjectCard key={project.projectId.toString()} project={project} />
            ))}
          </div>
        )}
      </motion.div>

      {/* ── Off-chain Agreements Section ── */}
      <motion.div variants={maskedReveal} className="space-y-8">
        <div className="px-1">
          <h2 className="font-jakarta text-xl font-bold tracking-tight text-[#1A2406] flex items-center gap-2 mb-1">
            <FileText className="w-5 h-5 font-bold" />
            Agreement Records
          </h2>
          <p className="text-[11px] font-medium text-[#1A2406]/30 uppercase tracking-widest">Contractual metadata and drafts</p>
        </div>

        {/* Sliding Tabs (Profile Style) */}
        <div className="relative border-b border-black/[0.05]">
          <div className="flex gap-8 overflow-x-auto scrollbar-none">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative pb-4 px-1 text-xs font-bold uppercase tracking-widest transition-all duration-300 whitespace-nowrap
                  ${activeTab === tab.id ? "text-[#1A2406]" : "text-[#1A2406]/30 hover:text-[#1A2406]/60"}`}
              >
                <div className="flex items-center gap-2">
                  {tab.label}
                  <span className={`px-1.5 py-0.5 rounded-md text-[9px] ${activeTab === tab.id ? 'bg-[#1A2406] text-white' : 'bg-black/[0.05]'}`}>
                    {tab.count}
                  </span>
                </div>
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="active-agreement-tab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D9F24F] shadow-[0_0_10px_rgba(217,242,79,0.8)]"
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.3 }}
          >
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A2406]/10" />
              </div>
            ) : (activeTab === "incoming" ? incomingAgreements : outgoingAgreements).length === 0 ? (
              <div className="bg-white/40 backdrop-blur-md border border-dashed border-[#1A2406]/5 rounded-[32px] p-20 text-center">
                <p className="text-sm text-[#1A2406]/30 font-medium italic">No {activeTab} agreements recorded.</p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {(activeTab === "incoming" ? incomingAgreements : outgoingAgreements).map((agreement) => (
                  <AgreementCard key={agreement.id} agreement={agreement} type={activeTab} />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
