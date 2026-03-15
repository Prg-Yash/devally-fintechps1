"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Download,
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
import { generateAgreementPDF } from "@/lib/generate-agreement-pdf";
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
  getProjectById,
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

type ProjectLookup = Map<number, OnchainProject>;

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

  const hasLoadedAgreementsRef = useRef(false);
  const lastFetchedUserIdRef = useRef<string | null>(null);
  const agreementsFetchInFlightRef = useRef(false);
  const projectsFetchInFlightRef = useRef(false);
  const lastFetchedProjectIdsKeyRef = useRef<string | null>(null);

  const escrowContract = useMemo(() => getEscrowContract(thirdwebClient), []);
  const pusdContract = useMemo(() => getPusdContract(thirdwebClient), []);

  const permitOwnerAddress = adminAccount?.address || account?.address || null;
  const smartAccountAddress = account?.address || null;
  const isSmartAccountMode =
    Boolean(smartAccountAddress) &&
    Boolean(adminAccount?.address) &&
    smartAccountAddress !== adminAccount?.address;

  /* ─── Data Fetching ──────────────────────────────────────────────── */

  const fetchAgreements = async (
    options: { silent?: boolean; force?: boolean } = {},
  ) => {
    const { silent = false, force = false } = options;
    const userId = session?.user?.id;
    if (!userId) return;

    if (agreementsFetchInFlightRef.current) return;
    if (!force && hasLoadedAgreementsRef.current && lastFetchedUserIdRef.current === userId) {
      return;
    }

    try {
      agreementsFetchInFlightRef.current = true;
      if (!silent) {
        setIsLoading(true);
      }

      const [incomingRes, outgoingRes] = await Promise.all([
        fetch(`${API_BASE_URL}/agreements/incoming?userId=${userId}`),
        fetch(`${API_BASE_URL}/agreements/outgoing?userId=${userId}`),
      ]);

      let nextIncoming: Agreement[] | null = null;
      let nextOutgoing: Agreement[] | null = null;

      if (incomingRes.ok) {
        const data = await incomingRes.json();
        nextIncoming = Array.isArray(data?.agreements) ? data.agreements : [];
      } else {
        console.error("Incoming agreements fetch failed", incomingRes.status);
      }

      if (outgoingRes.ok) {
        const data = await outgoingRes.json();
        nextOutgoing = Array.isArray(data?.agreements) ? data.agreements : [];
      } else {
        console.error("Outgoing agreements fetch failed", outgoingRes.status);
      }

      if (nextIncoming !== null) {
        setIncomingAgreements(nextIncoming);
      }
      if (nextOutgoing !== null) {
        setOutgoingAgreements(nextOutgoing);
      }

      if (nextIncoming !== null || nextOutgoing !== null) {
        hasLoadedAgreementsRef.current = true;
        lastFetchedUserIdRef.current = userId;
      }
    } catch (error) {
      console.error("Error fetching agreements:", error);
      toast.error(`Failed to fetch agreements - make sure the API server is running on ${API_BASE_URL}`);
    } finally {
      agreementsFetchInFlightRef.current = false;
      if (!silent) {
        setIsLoading(false);
      }
    }
  };

  const fetchOnchainProjects = async (options: { force?: boolean } = {}) => {
    const { force = false } = options;

    const uniqueProjectIds = Array.from(
      new Set(
        [...incomingAgreements, ...outgoingAgreements]
          .map((agreement) => agreement.projectId)
          .filter((projectId): projectId is number => projectId !== undefined && projectId !== null),
      ),
    ).sort((a, b) => a - b);

    const currentIdsKey = uniqueProjectIds.join(",");

    if (uniqueProjectIds.length === 0) {
      setFundedProjects([]);
      lastFetchedProjectIdsKeyRef.current = null;
      return;
    }

    if (projectsFetchInFlightRef.current) return;
    if (!force && lastFetchedProjectIdsKeyRef.current === currentIdsKey) return;

    try {
      projectsFetchInFlightRef.current = true;
      setIsLoadingProjects(true);

      const results = await Promise.all(
        uniqueProjectIds.map(async (projectId) => {
          try {
            return await getProjectById(thirdwebClient, BigInt(projectId));
          } catch {
            return null;
          }
        }),
      );

      setFundedProjects(results.filter((project): project is OnchainProject => project !== null));
      lastFetchedProjectIdsKeyRef.current = currentIdsKey;
    } catch (error) {
      console.error("Error fetching onchain projects:", error);
      toast.error("Failed to resolve protocol links from chain");
    } finally {
      projectsFetchInFlightRef.current = false;
      setIsLoadingProjects(false);
    }
  };

  useEffect(() => {
    if (!session?.user?.id) return;

    if (lastFetchedUserIdRef.current && lastFetchedUserIdRef.current !== session.user.id) {
      hasLoadedAgreementsRef.current = false;
      lastFetchedUserIdRef.current = null;
      setIncomingAgreements([]);
      setOutgoingAgreements([]);
    }

    fetchAgreements({ silent: false });
  }, [session?.user?.id]);

  useEffect(() => {
    fetchOnchainProjects();
  }, [incomingAgreements, outgoingAgreements]);


  /* ─── Status Badge Colors ────────────────────────────────────────── */

  const getStatusStyle = (status: string) => {
    switch (status.toUpperCase()) {
      case "DRAFT":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "NEGOTIATING":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "READY_TO_FUND":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
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
      case "DRAFT": return "Draft";
      case "NEGOTIATING": return "Negotiating";
      case "READY_TO_FUND": return "Ready To Fund";
      case "PENDING": return "Awaiting Action";
      case "FUNDED": return "Active Contract";
      case "COMPLETED": return "Successfully Settled";
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toUpperCase()) {
      case "DRAFT": return <FileText className="w-3.5 h-3.5" />;
      case "NEGOTIATING": return <Send className="w-3.5 h-3.5" />;
      case "READY_TO_FUND": return <Wallet className="w-3.5 h-3.5" />;
      case "PENDING": return <Clock className="w-3.5 h-3.5" />;
      case "ACTIVE": return <Zap className="w-3.5 h-3.5" />;
      case "COMPLETED": return <CheckCircle2 className="w-3.5 h-3.5" />;
      case "CANCELLED": return <AlertCircle className="w-3.5 h-3.5" />;
      case "FUNDED": return <ShieldCheck className="w-3.5 h-3.5" />;
      default: return <Clock className="w-3.5 h-3.5" />;
    }
  };

  const projectsById = useMemo<ProjectLookup>(() => {
    const map: ProjectLookup = new Map();
    for (const project of fundedProjects) {
      map.set(Number(project.projectId), project);
    }
    return map;
  }, [fundedProjects]);

  /* ─── Sub-components ─────────────────────────────────────────────── */

  const AgreementCard = ({ agreement, type }: { agreement: Agreement; type: "incoming" | "outgoing" }) => {
    const linkedProtocol =
      agreement.projectId !== undefined && agreement.projectId !== null
        ? projectsById.get(Number(agreement.projectId))
        : undefined;

    const linkedTotal = linkedProtocol ? formatPusdAmount(BigInt(linkedProtocol.amount)) : null;
    const linkedPaid = linkedProtocol ? formatPusdAmount(BigInt(linkedProtocol.releasedAmount)) : null;
    const linkedRemaining =
      linkedProtocol
        ? formatPusdAmount(BigInt(linkedProtocol.amount) - BigInt(linkedProtocol.releasedAmount))
        : null;

    return (
      <motion.div variants={itemVariants} whileHover={HOVER_SCALE}>
        <Card className="group relative bg-white/40 backdrop-blur-xl border border-white/60 rounded-[28px] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:border-[#1A2406]/10 transition-all duration-500">
          <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent pointer-events-none" />

          <CardHeader className="pb-3 relative z-10">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5 ${getStatusStyle(agreement.status)}`}>
                    {getStatusIcon(agreement.status)}
                    {getStatusLabel(agreement.status)}
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
            <div className={`rounded-xl border px-3 py-2 ${linkedProtocol ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60"}`}>
              {linkedProtocol ? (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                    Linked Protocol: PID-{linkedProtocol.projectId.toString()}
                  </p>
                  <p className="text-[10px] text-[#1A2406]/70">
                    Vault {linkedTotal} PUSD | Paid {linkedPaid} PUSD | Available {linkedRemaining} PUSD
                  </p>
                </div>
              ) : (
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">
                  Off-chain only record. No on-chain project linked.
                </p>
              )}
            </div>

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
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); generateAgreementPDF(agreement); toast.success("PDF downloaded!"); }}
                  className="text-[10px] font-bold tracking-[0.1em] uppercase text-[#1A2406]/40 hover:text-[#D9F24F] transition-colors flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> PDF
                </button>
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
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const allAgreements = useMemo(() => {
    const byId = new Map<string, Agreement>();
    for (const agreement of [...outgoingAgreements, ...incomingAgreements]) {
      byId.set(agreement.id, agreement);
    }

    return Array.from(byId.values()).sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });
  }, [incomingAgreements, outgoingAgreements]);

  return (
    <motion.div
      variants={stagger}
      initial={false}
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
          <h1 className="font-jakarta text-4xl tracking-[-0.04em] text-[#1A2406]">Agreements</h1>
          <p className="font-sans text-[#1A2406]/30 text-sm font-medium">
            Open one agreement to see both off-chain contract metadata and on-chain escrow state.
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

      {/* ── Unified Agreements Section ── */}
      <motion.div variants={maskedReveal} className="space-y-8">
        <div className="px-1 flex items-center justify-between gap-3">
          <h2 className="font-jakarta text-xl font-bold tracking-tight text-[#1A2406] flex items-center gap-2 mb-1">
            <FileText className="w-5 h-5 font-bold" />
            Agreements
          </h2>
          <Badge variant="outline" className="rounded-full bg-slate-50 text-[10px] font-bold text-[#1A2406]/40 uppercase tracking-widest border-none">
            {allAgreements.length} total
          </Badge>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key="all-agreements"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.3 }}
          >
            {isLoading || isLoadingProjects ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A2406]/10" />
              </div>
            ) : allAgreements.length === 0 ? (
              <div className="bg-white/40 backdrop-blur-md border border-dashed border-[#1A2406]/5 rounded-[32px] p-20 text-center">
                <p className="text-sm text-[#1A2406]/30 font-medium italic">No agreements recorded for this account.</p>
              </div>
            ) : (
              <div className="space-y-10">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-[#1A2406]/40">Outgoing</h3>
                    <Badge variant="outline" className="rounded-full bg-slate-50 text-[10px] font-bold text-[#1A2406]/40 uppercase tracking-widest border-none">
                      {outgoingAgreements.length}
                    </Badge>
                  </div>
                  {outgoingAgreements.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#1A2406]/10 p-8 text-center text-sm text-[#1A2406]/30">
                      No outgoing agreements.
                    </div>
                  ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {outgoingAgreements.map((agreement) => (
                        <AgreementCard key={agreement.id} agreement={agreement} type="outgoing" />
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-[#1A2406]/40">Incoming</h3>
                    <Badge variant="outline" className="rounded-full bg-slate-50 text-[10px] font-bold text-[#1A2406]/40 uppercase tracking-widest border-none">
                      {incomingAgreements.length}
                    </Badge>
                  </div>
                  {incomingAgreements.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#1A2406]/10 p-8 text-center text-sm text-[#1A2406]/30">
                      No incoming agreements.
                    </div>
                  ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {incomingAgreements.map((agreement) => (
                        <AgreementCard key={agreement.id} agreement={agreement} type="incoming" />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
