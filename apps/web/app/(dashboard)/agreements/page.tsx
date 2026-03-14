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
  Gavel,
  AlertCircle
} from "lucide-react";
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
  getProjectCount,
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [txStep, setTxStep] = useState<TxStep>("idle");
  const [txStepDescription, setTxStepDescription] = useState("Waiting for action");

  const [fundedProjects, setFundedProjects] = useState<OnchainProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // Release milestone state
  const [releasingProjectId, setReleasingProjectId] = useState<bigint | null>(null);
  const [releaseAmount, setReleaseAmount] = useState("");
  const [isReleasing, setIsReleasing] = useState(false);
  const [activeTab, setActiveTab] = useState<"incoming" | "outgoing">("incoming");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    freelancerAddress: "",
    amount: "",
    dueDate: "",
    receiverEmail: "",
  });

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

  /* ─── Metadata Persistence ───────────────────────────────────────── */

  const saveAgreementMetadata = async (projectId: bigint) => {
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
        }),
      });
    } catch (error) {
      console.error("Metadata persistence warning:", error);
    }
  };

  /* ─── Create & Fund Agreement (Permit + createAndFundAgreement) ── */

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

    try {
      setIsFunding(true);

      // ── Step 1: Request EIP-2612 Permit Signature ──────────────────
      setTxStep("signing");
      setTxStepDescription("Please sign the PUSD permit in your wallet…");

      const scaledAmount = scalePusdAmount(formData.amount);
      const permitDeadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 60); // 1 hour

      // Query on-chain nonce — critical for valid permit
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

      console.log("Permit debug →", {
        ownerAddress,
        spender: ESCROW_CONTRACT_ADDRESS,
        pusd: PUSD_CONTRACT_ADDRESS,
        nonce: nonce.toString(),
        amount: scaledAmount.toString(),
        deadline: permitDeadline.toString(),
        domain: permitDomain,
      });

      const signature = await fundingAccount.signTypedData({
        domain: permitDomain,
        types: permitTypes,
        primaryType: "Permit",
        message: permitMessage,
      });

      console.log("Validating generated signature...");
      const signatureValid = await verifyTypedData({
        address: ownerAddress,
        domain: permitDomain,
        types: permitTypes,
        primaryType: "Permit",
        message: permitMessage,
        signature,
      });

      if (!signatureValid) {
        throw new Error("Signature verification failed locally! The domain parameters (Version, Name, Token Address) may not match the deployed PUSD contract.");
      }

      const { v, r, s } = splitSignature(signature);
      const permitV = Number(v);

      // ── Step 2: Call createAndFundAgreement on PayCrowEscrow ────────
      setTxStep("funding");
      setTxStepDescription("Submitting escrow funding transaction on Sepolia…");

      const dueDateTimestamp = BigInt(Math.floor(new Date(formData.dueDate).getTime() / 1000));

      const tx = prepareContractCall({
        contract: escrowContract,
        method:
          "function createAndFundAgreement(address _freelancer, uint256 _amount, uint256 _deadline, uint8 v, bytes32 r, bytes32 s)",
        params: [recipientAddr, scaledAmount, permitDeadline, permitV, r, s],
      });

      await sendAndConfirmTransaction({
        account: fundingAccount,
        transaction: tx,
      });

      // ── Step 3: Refresh & Done ─────────────────────────────────────
      const projectCount = await getProjectCount(thirdwebClient);
      const projects = await getProjectsForClient(thirdwebClient, ownerAddress, 12);
      setFundedProjects(projects);
      await saveAgreementMetadata(projectCount);

      setTxStep("verified");
      setTxStepDescription("Agreement created & funds locked in escrow ✓");
      toast.success("Funds locked in escrow successfully!");

      setFormData({
        title: "",
        description: "",
        freelancerAddress: "",
        amount: "",
        dueDate: "",
        receiverEmail: "",
      });
      setIsDialogOpen(false);
      fetchAgreements();
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
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "ACTIVE":
        return "bg-[#D9F24F]/20 text-[#1A2406] border-[#D9F24F]/30";
      case "COMPLETED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "CANCELLED":
        return "bg-red-50 text-red-700 border-red-200";
      case "FUNDED":
        return "bg-[#D9F24F]/20 text-[#1A2406] border-[#D9F24F]/30";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
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
              <CardTitle className="text-lg font-jakarta font-bold text-[#1A2406] tracking-tight mt-2 flex items-center gap-2">
                {agreement.title}
                <ChevronRight className="w-4 h-4 text-[#1A2406]/10 group-hover:translate-x-1 transition-transform" />
              </CardTitle>
            </div>
            <div className="p-2.5 bg-white/80 rounded-xl border border-white shadow-sm shrink-0">
              <FileText className="w-5 h-5 text-[#1A2406]" />
            </div>
          </div>
          <CardDescription className="text-[11px] font-medium text-[#1A2406]/40 mt-1">
            {type === "incoming"
              ? <>From: <span className="text-[#1A2406]">{agreement.creator.name}</span></>
              : <>To: <span className="text-[#1A2406]">{agreement.receiver.name}</span></>}
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
              <p className="text-[9px] font-bold text-[#1A2406]/20 uppercase tracking-widest leading-none mb-1.5">Escrowed</p>
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
            <button className="text-[10px] font-bold tracking-[0.1em] uppercase text-[#1A2406]/40 hover:text-[#1A2406] transition-colors flex items-center gap-1">
              View Details <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  const ProjectCard = ({ project }: { project: OnchainProject }) => {
    const isExpanded = releasingProjectId === project.projectId;
    const status = project.isCompleted ? "COMPLETED" : project.isFunded ? "FUNDED" : "PENDING";
    
    return (
      <motion.div variants={itemVariants} whileHover={HOVER_SCALE}>
        <Card className="group relative bg-[#1A2406] text-white rounded-[28px] overflow-hidden shadow-[0_20px_40px_rgba(26,36,6,0.1)] border border-white/5 transition-all duration-500">
          <div className="absolute inset-0 bg-gradient-to-tr from-[#D9F24F]/5 via-transparent to-transparent pointer-events-none opacity-50" />
          
          <CardHeader className="pb-3 relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#D9F24F] rounded-xl shadow-[0_0_20px_rgba(217,242,79,0.2)]">
                  <ShieldCheck className="w-4 h-4 text-[#1A2406]" />
                </div>
                <p className="font-jakarta font-bold text-white tracking-tight">Project #{project.projectId.toString()}</p>
              </div>
              <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase border-none ${getStatusStyle(status)}`}>
                {status}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 relative z-10">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-[20px] bg-white/5 border border-white/5 p-4">
                <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest leading-none mb-2">Total Locked</p>
                <p className="text-xl font-bold text-white">
                  {formatPusdAmount(project.amount)} <span className="text-[10px] text-white/40 uppercase">PUSD</span>
                </p>
              </div>
              <div className="rounded-[20px] bg-white/5 border border-white/5 p-4">
                <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest leading-none mb-2">Freelancer</p>
                <p className="text-xs font-mono font-bold text-[#D9F24F] mt-1 truncate">
                  {shortAddress(project.freelancer)}
                </p>
              </div>
            </div>

            {/* Release Milestone Section */}
            {project.isFunded && !project.isCompleted && (
              <div className="pt-2">
                {isExpanded ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4"
                  >
                    <div className="flex items-center gap-2">
                      <Send className="w-4 h-4 text-[#D9F24F]" />
                      <p className="text-sm font-bold text-white">Release Payout</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Amount to Release (PUSD)</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        value={releaseAmount}
                        onChange={(e) => setReleaseAmount(e.target.value)}
                        className="bg-white/5 border-white/10 rounded-xl text-white h-11 focus:ring-[#D9F24F]/20"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleReleaseMilestone(project.projectId)}
                        disabled={isReleasing}
                        className="flex-1 bg-[#D9F24F] text-[#1A2406] hover:bg-[#c4db47] font-bold rounded-xl"
                      >
                        {isReleasing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Release"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReleasingProjectId(null);
                          setReleaseAmount("");
                        }}
                        className="border-white/10 text-white hover:bg-white/5 rounded-xl"
                      >
                        Cancel
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div whileTap={BUTTON_PRESS}>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setReleasingProjectId(project.projectId);
                        setReleaseAmount("");
                      }}
                      className="w-full border-white/10 text-white hover:bg-[#D9F24F] hover:text-[#1A2406] rounded-xl h-11 text-xs font-bold uppercase tracking-widest transition-all"
                    >
                      <Zap className="mr-2 w-3.5 h-3.5" />
                      Release Milestone
                    </Button>
                  </motion.div>
                )}
              </div>
            )}
            
            <p className="text-[9px] text-white/20 font-mono text-center pt-2">
              Vault Protection: {shortAddress(ESCROW_CONTRACT_ADDRESS)}
            </p>
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
      {/* ── Wallet Banner (Dashboard Style) ── */}
      <motion.div variants={maskedReveal} className="relative bg-[#1A2406] text-white rounded-[32px] p-8 shadow-2xl shadow-[#1A2406]/20 overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-tr from-[#D9F24F]/10 via-transparent to-transparent opacity-50" />
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <ShieldCheck className="w-32 h-32 text-[#D9F24F]" />
        </div>
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#D9F24F] rounded-xl shadow-[0_0_20px_rgba(217,242,79,0.4)] transition-transform group-hover:scale-110">
                <Wallet className="w-5 h-5 text-[#1A2406]" />
              </div>
              <CardTitle className="text-xl font-jakarta font-bold tracking-tight">Smart Settlement Protocol</CardTitle>
            </div>
            <CardDescription className="text-white/40 text-sm font-medium">
              EIP-2612 Permit-enabled Escrow • Sepolia Testnet Active
            </CardDescription>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <ConnectButton
              client={thirdwebClient}
              chain={sepolia}
              accountAbstraction={{ chain: sepolia, sponsorGas: true }}
              connectButton={{ label: "Authenticate Wallet" }}
            />
            
            <div className="flex flex-wrap justify-center gap-2">
              <Badge variant="outline" className={`${txStepMeta[txStep].color} border-none rounded-full px-3 py-1 shadow-sm`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current mr-2 animate-pulse" />
                {txStepMeta[txStep].label}
              </Badge>
              {isSmartAccountMode && (
                <Badge variant="outline" className="bg-[#D9F24F] text-[#1A2406] border-none rounded-full px-3 py-1 font-bold">
                  AA Mode
                </Badge>
              )}
            </div>
          </div>
        </div>
      </motion.div>

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
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <motion.div whileHover={HOVER_SCALE} whileTap={BUTTON_PRESS}>
              <button className="rounded-xl bg-[#1A2406] text-white px-6 py-3.5 text-xs font-bold tracking-tight flex items-center gap-2 shadow-xl shadow-[#1A2406]/10">
                <Plus className="w-4 h-4 text-[#D9F24F]" />
                Create New Agreement
              </button>
            </motion.div>
          </DialogTrigger>
          
          <DialogContent className="max-w-2xl bg-white border border-black/5 rounded-2xl shadow-xl overflow-hidden p-0">
            <div className="bg-[#1A2406] p-6 text-white relative">
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <Gavel className="w-16 h-16" />
              </div>
              <DialogTitle className="text-xl font-jakarta font-bold tracking-tight">Lock Funds in Escrow</DialogTitle>
              <DialogDescription className="text-white/40 text-[11px] font-medium uppercase tracking-[0.05em] mt-0.5">
                Funds are held by the Nexus Smart Vault until released.
              </DialogDescription>
            </div>

            <div className="p-6 space-y-6">
              {/* Wallet Context Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-black/[0.05] bg-slate-50/50 p-3">
                  <p className="text-[9px] font-bold text-[#1A2406]/30 uppercase tracking-widest leading-none mb-2">Smart Account</p>
                  <p className="text-[11px] font-mono font-bold text-[#1A2406]">{smartAccountAddress ? shortAddress(smartAccountAddress) : "Disconnected"}</p>
                </div>
                <div className="rounded-xl border border-black/[0.05] bg-slate-50/50 p-3">
                  <p className="text-[9px] font-bold text-[#1A2406]/30 uppercase tracking-widest leading-none mb-2">Funding EOA</p>
                  <p className="text-[11px] font-mono font-bold text-[#1A2406]">{permitOwnerAddress ? shortAddress(permitOwnerAddress) : "Disconnected"}</p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-[#1A2406]/40">Agreement Title *</Label>
                  <Input placeholder="Mobile App Design" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="rounded-lg h-11 border-black/[0.1]" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-[#1A2406]/40">Freelancer Wallet *</Label>
                    <Input placeholder="0x..." value={formData.freelancerAddress} onChange={(e) => setFormData({ ...formData, freelancerAddress: e.target.value })} className="rounded-lg h-11 font-mono text-xs border-black/[0.1]" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-[#1A2406]/40">Freelancer Email *</Label>
                    <Input type="email" placeholder="user@example.com" value={formData.receiverEmail} onChange={(e) => setFormData({ ...formData, receiverEmail: e.target.value })} className="rounded-lg h-11 border-black/[0.1]" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-[#1A2406]/40">PUSD Total Amount *</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#1A2406]/30" />
                      <Input type="number" placeholder="500" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="pl-8 rounded-lg h-11 border-black/[0.1]" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-[#1A2406]/40">Target Completion *</Label>
                    <Input type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} className="rounded-lg h-11 border-black/[0.1]" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-[#1A2406]/40">Project Narration (Optional)</Label>
                  <textarea 
                    className="w-full rounded-lg border border-black/[0.1] bg-white p-3 text-sm min-h-[60px] outline-none focus:ring-1 focus:ring-[#1A2406]/10" 
                    value={formData.description} 
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Briefly state deliverables and scope..."
                  />
                </div>
              </div>

              {/* Progress Stepper Styled like Tickets */}
              <div className="bg-[#1A2406]/[0.02] border border-black/[0.04] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-3.5 h-3.5 text-[#1A2406]" />
                  <span className="text-[11px] font-bold uppercase text-[#1A2406] tracking-widest">Transaction Pipeline</span>
                </div>
                <p className="text-[11px] font-medium text-[#1A2406]/40 mb-3">{txStepDescription}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["signing", "funding", "verified"] as const).map((step, i) => {
                    const isActive = txStep === step;
                    const isPast = (step === "signing" && ["funding", "verified"].includes(txStep)) || (step === "funding" && txStep === "verified");
                    return (
                      <div key={step} className={`rounded-lg p-2.5 text-[10px] font-bold uppercase tracking-tight transition-all duration-300 flex items-center gap-2 ${isActive ? 'bg-[#1A2406] text-[#D9F24F]' : isPast ? 'bg-[#D9F24F]/20 text-[#1A2406]' : 'bg-slate-100 text-slate-300'}`}>
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] ${isActive ? 'bg-[#D9F24F] text-[#1A2406]' : isPast ? 'bg-[#1A2406] text-[#D9F24F]' : 'bg-slate-200'}`}>
                          {isPast ? "✓" : i + 1}
                        </div>
                        {step === "signing" ? "Sign" : step === "funding" ? "Vault" : "Done"}
                      </div>
                    );
                  })}
                </div>
              </div>

              <motion.div whileTap={BUTTON_PRESS}>
                <Button 
                  className="w-full h-12 rounded-xl bg-[#1A2406] text-[#D9F24F] font-bold text-sm" 
                  disabled={isFunding || !permitOwnerAddress} 
                  onClick={handleCreateAgreement}
                >
                  {isFunding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Authorize & Lock Funds"}
                </Button>
              </motion.div>
            </div>
          </DialogContent>
        </Dialog>
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
            Contractual Ledger
          </h2>
          <p className="text-[11px] font-medium text-[#1A2406]/30 uppercase tracking-widest">Off-chain metadata records</p>
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
