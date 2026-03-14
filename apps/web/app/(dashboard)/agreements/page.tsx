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
      await fetch("http://localhost:5000/agreements", {
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

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "PENDING":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "ACTIVE":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "COMPLETED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "CANCELLED":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  /* ─── Sub-components ─────────────────────────────────────────────── */

  const AgreementCard = ({ agreement, type }: { agreement: Agreement; type: "incoming" | "outgoing" }) => (
    <Card className="group relative overflow-hidden border border-slate-200 bg-white transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-0.5">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 transition-opacity group-hover:opacity-100" />
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <span className="truncate">{agreement.title}</span>
            </CardTitle>
            <CardDescription className="mt-2 text-xs">
              {type === "incoming"
                ? `From: ${agreement.creator.name} (${agreement.creator.email})`
                : `To: ${agreement.receiver.name} (${agreement.receiver.email})`}
            </CardDescription>
          </div>
          <Badge variant="outline" className={`${getStatusColor(agreement.status)} text-xs shrink-0`}>
            {agreement.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {agreement.description && (
          <p className="text-sm text-slate-500 line-clamp-2">{agreement.description}</p>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Total</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5">
              {agreement.amount} <span className="text-xs font-medium text-slate-400">{agreement.currency}</span>
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Milestones</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5">{agreement.milestones.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-1">
          <Clock className="w-3 h-3" />
          Created {new Date(agreement.createdAt).toLocaleDateString()}
        </div>
      </CardContent>
    </Card>
  );

  const ProjectCard = ({ project }: { project: OnchainProject }) => {
    const isExpanded = releasingProjectId === project.projectId;
    return (
      <Card className="group relative overflow-hidden border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/30 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-100/60 hover:-translate-y-0.5">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
        <CardContent className="py-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-white" />
              </div>
              <p className="font-bold text-slate-900">Project #{project.projectId.toString()}</p>
            </div>
            <Badge
              variant={project.isCompleted ? "default" : project.isFunded ? "default" : "secondary"}
              className={
                project.isCompleted
                  ? "bg-slate-100 text-slate-700"
                  : project.isFunded
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
              }
            >
              {project.isCompleted ? "Completed" : project.isFunded ? "Funded" : "Pending"}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/80 border border-emerald-100 p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Escrowed</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">
                {formatPusdAmount(project.amount)} <span className="text-xs text-slate-400">PUSD</span>
              </p>
            </div>
            <div className="rounded-xl bg-white/80 border border-emerald-100 p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Freelancer</p>
              <p className="text-sm font-mono font-medium text-slate-700 mt-1.5">
                {shortAddress(project.freelancer)}
              </p>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 font-mono">
            Vault: {shortAddress(ESCROW_CONTRACT_ADDRESS)}
          </p>

          {/* Release Milestone Section */}
          {project.isFunded && !project.isCompleted && (
            <div className="pt-2 space-y-2">
              {isExpanded ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-emerald-600" />
                    <p className="text-sm font-semibold text-emerald-800">Release Milestone</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`release-${project.projectId}`} className="text-xs text-emerald-700">
                      PUSD Amount to Release
                    </Label>
                    <Input
                      id={`release-${project.projectId}`}
                      type="number"
                      placeholder="e.g. 50"
                      step="0.01"
                      value={releaseAmount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReleaseAmount(e.target.value)}
                      className="bg-white border-emerald-200 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleReleaseMilestone(project.projectId)}
                      disabled={isReleasing}
                      className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
                    >
                      {isReleasing ? (
                        <Loader2 className="mr-1.5 w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Zap className="mr-1.5 w-3.5 h-3.5" />
                      )}
                      {isReleasing ? "Releasing…" : "Confirm Release"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReleasingProjectId(null);
                        setReleaseAmount("");
                      }}
                      className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setReleasingProjectId(project.projectId);
                    setReleaseAmount("");
                  }}
                  className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-all"
                >
                  <ArrowUpRight className="mr-1.5 w-3.5 h-3.5" />
                  Release Milestone
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  /* ─── Render ─────────────────────────────────────────────────────── */

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
      {/* ── Wallet Connection Banner ─── */}
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-2xl shadow-indigo-950/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/15 via-transparent to-transparent" />
        <div className="absolute top-4 right-4 w-24 h-24 rounded-full bg-indigo-500/10 blur-2xl" />
        <CardHeader className="relative z-10">
          <CardTitle className="flex items-center gap-2.5 text-lg">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            PayCrow Smart Escrow
          </CardTitle>
          <CardDescription className="text-indigo-200/70 text-sm">
            Connect wallet on Sepolia · Sign PUSD permit · Lock funds in one flow
          </CardDescription>
        </CardHeader>
        <CardContent className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <ConnectButton
            client={thirdwebClient}
            chain={sepolia}
            accountAbstraction={{
              chain: sepolia,
              sponsorGas: true,
            }}
            connectButton={{
              label: "Connect Smart Wallet",
            }}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={`${txStepMeta[txStep].color} border text-xs font-medium`}>
              {txStepMeta[txStep].label}
            </Badge>
            {smartAccountAddress && (
              <Badge variant="outline" className="text-indigo-200 border-indigo-400/40 text-xs">
                SA: {shortAddress(smartAccountAddress)}
              </Badge>
            )}
            {permitOwnerAddress && (
              <Badge variant="outline" className="text-indigo-200 border-indigo-400/40 text-xs">
                EOA: {shortAddress(permitOwnerAddress)}
              </Badge>
            )}
            <Badge
              variant="outline"
              className={`text-xs ${isSmartAccountMode ? "text-emerald-300 border-emerald-400/40" : "text-slate-300 border-slate-500/40"}`}
            >
              {isSmartAccountMode ? "AA Mode" : "EOA Mode"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* ── Header + Create Button ─── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 font-jakarta">
            Agreements
          </h1>
          <p className="text-slate-500 mt-1.5 text-sm">
            Create milestone-based escrow agreements and manage payouts.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-xl hover:shadow-indigo-500/30">
              <Plus className="mr-2 w-4 h-4" />
              Create Agreement
            </Button>
          </DialogTrigger>

          {/* ── Create Dialog ─── */}
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-0 bg-white shadow-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                Create & Fund Agreement
              </DialogTitle>
              <DialogDescription className="text-sm">
                Signs a PUSD permit and calls <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">createAndFundAgreement</code> on PayCrowEscrow in one step.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 pt-2">
              {/* Wallet Info */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-semibold text-slate-700">Smart Account:</span>
                  <span className="font-mono text-slate-500">{smartAccountAddress ? shortAddress(smartAccountAddress) : "Not connected"}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full bg-indigo-400" />
                  <span className="font-semibold text-slate-700">Permit/Funding EOA:</span>
                  <span className="font-mono text-slate-500">{permitOwnerAddress ? shortAddress(permitOwnerAddress) : "Not available"}</span>
                </div>
                {isSmartAccountMode && (
                  <p className="text-[11px] text-indigo-600 mt-1">
                    These addresses differ in ERC-4337 mode. Permit and funding use the EOA address.
                  </p>
                )}
              </div>

              {/* Form Fields */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-semibold">Title *</Label>
                <Input
                  id="title"
                  type="text"
                  placeholder="e.g., Mobile App Design"
                  value={formData.title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, title: e.target.value })}
                  className="border-slate-200 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-semibold">Description</Label>
                <Input
                  id="description"
                  type="text"
                  placeholder="Project summary"
                  value={formData.description}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="border-slate-200 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="freelancerAddress" className="text-sm font-semibold">Freelancer Wallet *</Label>
                  <Input
                    id="freelancerAddress"
                    type="text"
                    placeholder="0x..."
                    value={formData.freelancerAddress}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData({ ...formData, freelancerAddress: e.target.value })
                    }
                    className="font-mono text-sm border-slate-200 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-sm font-semibold">PUSD Amount *</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="amount"
                      type="number"
                      placeholder="100"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, amount: e.target.value })}
                      className="pl-9 border-slate-200 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dueDate" className="text-sm font-semibold">Due Date *</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="border-slate-200 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receiverEmail" className="text-sm font-semibold">Freelancer Email</Label>
                  <Input
                    id="receiverEmail"
                    type="email"
                    placeholder="freelancer@example.com"
                    value={formData.receiverEmail}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData({ ...formData, receiverEmail: e.target.value })
                    }
                    className="border-slate-200 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Progress Stepper */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm font-semibold text-slate-800">Transaction Progress</span>
                </div>
                <p className="text-xs text-slate-500 mb-3">{txStepDescription}</p>
                <div className="grid gap-2 md:grid-cols-3">
                  {(["signing", "funding", "verified"] as const).map((step, i) => {
                    const isActive = txStep === step;
                    const isPast =
                      (step === "signing" && ["funding", "verified"].includes(txStep)) ||
                      (step === "funding" && txStep === "verified");
                    return (
                      <div
                        key={step}
                        className={`rounded-lg px-3 py-2.5 text-xs font-medium transition-all duration-300 flex items-center gap-2 ${isActive
                          ? "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200"
                          : isPast
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-white text-slate-400 border border-slate-100"
                          }`}
                      >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isActive
                          ? "bg-indigo-600 text-white"
                          : isPast
                            ? "bg-emerald-500 text-white"
                            : "bg-slate-200 text-slate-500"
                          }`}>
                          {isPast ? "✓" : i + 1}
                        </span>
                        {step === "signing" ? "Permit Signature" : step === "funding" ? "Lock in Escrow" : "Verified"}
                      </div>
                    );
                  })}
                </div>
              </div>

              <Button
                onClick={handleCreateAgreement}
                disabled={isFunding || !permitOwnerAddress}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/20 h-11 text-sm font-semibold"
              >
                {isFunding ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <Zap className="mr-2 w-4 h-4" />}
                {isFunding ? "Processing…" : "Create & Fund Agreement"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Funded Projects On-chain ─── */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
            On-chain Funded Projects
          </CardTitle>
          <CardDescription className="text-sm">
            Live data from PayCrowEscrow on Sepolia. Release milestones to pay freelancers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingProjects ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
              <span>Loading projects from chain…</span>
            </div>
          ) : fundedProjects.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <ShieldCheck className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-sm text-slate-500">No funded projects yet for this account.</p>
              <p className="text-xs text-slate-400 mt-1">Create an agreement above to get started.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {fundedProjects.map((project) => (
                <ProjectCard key={project.projectId.toString()} project={project} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Off-chain Agreement Tabs ─── */}
      <Tabs defaultValue="incoming" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-xl h-11">
          <TabsTrigger value="incoming" className="rounded-lg text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Incoming ({incomingAgreements.length})
          </TabsTrigger>
          <TabsTrigger value="outgoing" className="rounded-lg text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Outgoing ({outgoingAgreements.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="incoming" className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            </div>
          ) : incomingAgreements.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="text-center py-16">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-sm text-slate-500">No incoming agreements yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {incomingAgreements.map((agreement) => (
                <AgreementCard key={agreement.id} agreement={agreement} type="incoming" />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="outgoing" className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            </div>
          ) : outgoingAgreements.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="text-center py-16">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-sm text-slate-500">No outgoing agreements yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {outgoingAgreements.map((agreement) => (
                <AgreementCard key={agreement.id} agreement={agreement} type="outgoing" />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
