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
  AlertCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  formatPusdAmount,
  getEscrowContract,
  getPermitNonce,
  getProjectById,
  getProjectIdByClientRef,
  getPusdContract,
  PERMIT_DOMAIN,
  PUSD_CONTRACT_ADDRESS,
  splitSignature,
  to65ByteSignatureHex,
  shortAddress,
  type OnchainProject,
  scalePusdAmount,
  ESCROW_CONTRACT_ADDRESS,
} from "@/lib/escrow";
import { thirdwebClient } from "@/lib/thirdweb-client";
import { useActiveAccount, useActiveWallet, useAdminWallet } from "thirdweb/react";
import { prepareContractCall, sendAndConfirmTransaction } from "thirdweb";
import { verifyTypedData } from "viem";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { markMilestonePaidAction } from "./actions";
import { format, isAfter, isBefore, isValid, parseISO, startOfDay } from "date-fns";

type WorkflowEvent =
  | "DRAFT_UPDATED"
  | "CHANGE_REQUESTED"
  | "READY_TO_FUND"
  | "ACCEPTANCE_REMINDER"
  | "PUBLISHED";

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
  paidAt?: string;
  payoutTxHash?: string;
}

interface ChangeRequest {
  id: string;
  note: string;
  createdAt: string;
  requestedBy?: { id: string; name: string; email: string };
}

interface Agreement {
  id: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  creator: { id: string; name: string; email: string; phoneNumber?: string; address?: string };
  receiver: { id: string; name: string; email: string; phoneNumber?: string; address?: string };
  milestones: Milestone[];
  projectId?: number;
  receiverAddress?: string;
  transactionHash?: string;
  fundingError?: string | null;
  dueDate?: string;
  changeRequests?: ChangeRequest[];
}

type MilestoneForm = {
  id?: string;
  title: string;
  description?: string;
  amount: string;
  dueDate: string;
};

const toDateInput = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0] || "";
};

const parseDateInput = (value: string) => {
  if (!value) return null;
  const parsed = parseISO(`${value}T00:00:00`);
  if (!isValid(parsed)) return null;
  return startOfDay(parsed);
};

const API_BASE_URL = "/api";

export default function AgreementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: session } = authClient.useSession();

  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const adminWallet = useAdminWallet();
  const adminAccount = activeWallet?.getAdminAccount?.() || adminWallet?.getAccount?.();
  const connectedWalletAddress = adminAccount?.address || account?.address;
  const fundingAccount = adminAccount || account;

  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [onchainData, setOnchainData] = useState<OnchainProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReleasing, setIsReleasing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [approveWallet, setApproveWallet] = useState("");
  const [fundingError, setFundingError] = useState<string | null>(null);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editMilestones, setEditMilestones] = useState<MilestoneForm[]>([]);

  const todayDate = useMemo(() => startOfDay(new Date()), []);
  const todayDateString = useMemo(() => format(todayDate, "yyyy-MM-dd"), [todayDate]);

  const editTotalAmount = useMemo(() => parseFloat(editAmount) || 0, [editAmount]);
  const editMilestonesTotal = useMemo(
    () => editMilestones.reduce((sum, milestone) => sum + (parseFloat(milestone.amount) || 0), 0),
    [editMilestones],
  );
  const editUnallocatedFunds = useMemo(
    () => Number((editTotalAmount - editMilestonesTotal).toFixed(6)),
    [editTotalAmount, editMilestonesTotal],
  );
  const isEditMilestoneTotalExact = useMemo(
    () => Math.abs(editUnallocatedFunds) < 0.000001,
    [editUnallocatedFunds],
  );

  const maxAmountForEditMilestone = (index: number) => {
    const otherTotal = editMilestones.reduce((sum, milestone, currentIndex) => {
      if (currentIndex === index) return sum;
      return sum + (parseFloat(milestone.amount) || 0);
    }, 0);
    return Math.max(0, editTotalAmount - otherTotal);
  };

  const isEditTimelineValid = useMemo(() => {
    if (!editDueDate) return false;

    const agreementDue = parseDateInput(editDueDate);
    if (!agreementDue) return false;
    if (isBefore(agreementDue, todayDate)) return false;

    for (const milestone of editMilestones) {
      if (!milestone.dueDate) continue;
      const milestoneDue = parseDateInput(milestone.dueDate);
      if (!milestoneDue) return false;
      if (isBefore(milestoneDue, todayDate) || isAfter(milestoneDue, agreementDue)) {
        return false;
      }
    }

    return true;
  }, [editDueDate, editMilestones, todayDate]);

  const escrowContract = useMemo(() => getEscrowContract(thirdwebClient), []);

  const isProtocolRoute = id?.startsWith("pid-") || !isNaN(Number(id));

  const fetchAgreementFromUserLists = async (userId: string, agreementId: string) => {
    const [incomingRes, outgoingRes] = await Promise.all([
      fetch(`${API_BASE_URL}/agreements/incoming?userId=${userId}`),
      fetch(`${API_BASE_URL}/agreements/outgoing?userId=${userId}`),
    ]);

    const incomingData = incomingRes.ok ? await incomingRes.json().catch(() => ({})) : {};
    const outgoingData = outgoingRes.ok ? await outgoingRes.json().catch(() => ({})) : {};

    const incoming = Array.isArray(incomingData?.agreements) ? incomingData.agreements : [];
    const outgoing = Array.isArray(outgoingData?.agreements) ? outgoingData.agreements : [];
    const all = [...incoming, ...outgoing] as Agreement[];

    return all.find((a) => a.id === agreementId) || null;
  };

  const fetchDetails = async () => {
    try {
      setIsLoading(true);

      let agreementData: Agreement | null = null;
      let targetProjectId: number | null = null;

      // For normal agreement links, prefer incoming/outgoing lists scoped by logged-in user.
      if (!isProtocolRoute && session?.user?.id) {
        try {
          agreementData = await fetchAgreementFromUserLists(session.user.id, id);
          targetProjectId = agreementData?.projectId ?? null;
        } catch (e) {
          console.warn("Scoped agreement list fetch failed", e);
        }
      }

      // Always hydrate from direct agreement endpoint when an agreement id is known,
      // because list endpoints can return partial data (e.g., missing dueDate).
      if (agreementData?.id) {
        try {
          const fullRes = await fetch(`${API_BASE_URL}/agreements/${agreementData.id}`);
          if (fullRes.ok) {
            const fullData = await fullRes.json();
            const fullAgreement = fullData?.agreement || null;
            if (fullAgreement) {
              agreementData = {
                ...agreementData,
                ...fullAgreement,
                milestones: fullAgreement.milestones ?? agreementData.milestones,
              };
              targetProjectId = agreementData?.projectId ?? targetProjectId;
            }
          }
        } catch (e) {
          console.warn("Direct agreement hydration failed", e);
        }
      }

      // If not found but looks like "pid-X" or just a number, try by projectId.
      if (!agreementData) {
        // Try direct lookup by agreement id before pid-based fallback.
        try {
          const directRes = await fetch(`${API_BASE_URL}/agreements/${id}`);
          if (directRes.ok) {
            const directData = await directRes.json();
            agreementData = directData?.agreement || null;
            targetProjectId = agreementData?.projectId ?? null;
          }
        } catch (e) {
          console.warn("Direct agreement fetch failed", e);
        }

        if (agreementData) {
          setAgreement(agreementData);
        }

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

      // Canonical URL: if this page was opened via pid-based route but DB mapping exists,
      // redirect to the stable agreement-id URL so both chain and DB data live under one link.
      if (agreementData?.id && id !== agreementData.id) {
        router.replace(`/agreements/${agreementData.id}`);
      }

      setAgreement(agreementData);
      setApproveWallet(agreementData?.receiverAddress || connectedWalletAddress || "");
      setFundingError((agreementData as any)?.fundingError || null);

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
    if (!id) return;
    if (!isProtocolRoute && !session?.user?.id) return;
    fetchDetails();
  }, [id, isProtocolRoute, session?.user?.id]);

  useEffect(() => {
    if (!agreement) return;

    setEditTitle(agreement.title || "");
    setEditDescription(agreement.description || "");
    setEditAmount(String(agreement.amount || ""));
    setEditDueDate(toDateInput(agreement.dueDate));
    setEditMilestones(
      (agreement.milestones || []).map((milestone) => ({
        id: milestone.id,
        title: milestone.title || "",
        description: milestone.description || "",
        amount: String(milestone.amount || ""),
        dueDate: toDateInput(milestone.dueDate),
      })),
    );
  }, [agreement]);

  useEffect(() => {
    // Match buy-PCC wallet resolution so the displayed payout wallet is the real Sepolia address.
    if (!agreement || !session?.user?.id || !connectedWalletAddress) return;
    if (session.user.id !== agreement.receiver?.id) return;

    setApproveWallet(connectedWalletAddress);
  }, [agreement, session?.user?.id, connectedWalletAddress]);

  const agreementIdToClientRefId = (agreementId: string) => {
    const bytes = new TextEncoder().encode(agreementId);
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const tail = (hex.slice(-64) || "0").padStart(64, "0");
    return BigInt(`0x${tail}`);
  };

  const triggerWorkflowNotification = async (event: WorkflowEvent, currentAgreement: Agreement) => {
    try {
      console.info(`[WebAgreementUI] Sending workflow notification event=${event} agreement=${currentAgreement.id}`);

      const response = await fetch("/api/agreements/workflow-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event,
          agreementId: currentAgreement.id,
          agreementTitle: currentAgreement.title,
          creatorId: currentAgreement.creator?.id,
          creatorName: currentAgreement.creator?.name || currentAgreement.creator?.email || "Client",
          receiverId: currentAgreement.receiver?.id,
          receiverName: currentAgreement.receiver?.name || currentAgreement.receiver?.email || "Freelancer",
        }),
      });

      if (!response.ok) {
        const raw = await response.text();
        console.warn(
          `[WebAgreementUI] Workflow notification failed event=${event} agreement=${currentAgreement.id}:`,
          raw,
        );
      }
    } catch (error) {
      console.warn(
        `[WebAgreementUI] Workflow notification error event=${event} agreement=${currentAgreement.id}:`,
        error,
      );
    }
  };

  const handleRequestChanges = async () => {
    if (!agreement || !session?.user?.id) return;
    if (!changeNote.trim()) {
      toast.error("Please add a change request note");
      return;
    }

    try {
      setIsSubmittingReview(true);
      const payload = {
        receiverId: session.user.id,
        note: changeNote,
      };

      const res = await fetch(`${API_BASE_URL}/agreements/${agreement.id}/request-changes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Failed to submit change request (${res.status})`);
      }

      toast.success("Change request submitted");
      await triggerWorkflowNotification("CHANGE_REQUESTED", agreement);
      setChangeNote("");
      await fetchDetails();
    } catch (error: any) {
      toast.error(error?.message || "Failed to request changes");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleApproveForFunding = async () => {
    if (!agreement || !session?.user?.id) return;
    if (!approveWallet.trim()) {
      toast.error("Wallet address is required to approve for funding");
      return;
    }

    try {
      setIsSubmittingReview(true);
      const res = await fetch(`${API_BASE_URL}/agreements/${agreement.id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: session.user.id,
          receiverAddress: approveWallet.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to approve agreement");
      }

      toast.success("Agreement approved and ready to fund");
      await triggerWorkflowNotification("READY_TO_FUND", agreement);
      await fetchDetails();
    } catch (error: any) {
      toast.error(error?.message || "Failed to approve agreement");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleSendAcceptanceEmail = async () => {
    if (!agreement || !session?.user?.id) return;

    try {
      setIsSubmittingReview(true);
      const res = await fetch(`${API_BASE_URL}/agreements/${agreement.id}/resend`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId: session.user.id }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to send acceptance email");
      }

      toast.success("Acceptance email sent to freelancer");
      await triggerWorkflowNotification("ACCEPTANCE_REMINDER", agreement);
      await fetchDetails();
    } catch (error: any) {
      toast.error(error?.message || "Failed to send acceptance email");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const addEditMilestone = () => {
    setEditMilestones((prev) => [...prev, { title: "", description: "", amount: "", dueDate: "" }]);
  };

  const removeEditMilestone = (index: number) => {
    setEditMilestones((prev) => prev.filter((_, i) => i !== index));
  };

  const updateEditMilestone = (index: number, field: keyof MilestoneForm, value: string) => {
    if (field === "amount") {
      setEditMilestones((prev) => {
        const next = [...prev];
        if (value === "") {
          next[index] = { ...next[index], amount: "" };
          return next;
        }

        const numericValue = Math.max(0, parseFloat(value) || 0);
        const otherTotal = prev.reduce((sum, milestone, currentIndex) => {
          if (currentIndex === index) return sum;
          return sum + (parseFloat(milestone.amount) || 0);
        }, 0);
        const cap = Math.max(0, editTotalAmount - otherTotal);
        const clamped = Math.min(numericValue, cap);

        next[index] = { ...next[index], amount: String(clamped) };
        return next;
      });
      return;
    }

    if (field === "dueDate") {
      if (!value) {
        setEditMilestones((prev) => {
          const next = [...prev];
          next[index] = { ...next[index], dueDate: "" };
          return next;
        });
        return;
      }

      const selectedDate = parseDateInput(value);
      if (!selectedDate) {
        toast.error("Invalid milestone due date");
        return;
      }

      if (isBefore(selectedDate, todayDate)) {
        toast.error("Milestone due date cannot be earlier than today");
        return;
      }

      const agreementDue = parseDateInput(editDueDate);
      if (agreementDue && isAfter(selectedDate, agreementDue)) {
        toast.error("Milestone due date cannot be later than target completion date");
        return;
      }
    }

    setEditMilestones((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSaveDraftInline = async () => {
    if (!agreement || !session?.user?.id) return;

    if (!editTitle.trim() || !editAmount || !editDueDate) {
      toast.error("Title, amount, and target completion date are required");
      return;
    }

    if (!editMilestones.length || editMilestones.some((milestone) => !milestone.title.trim())) {
      toast.error("Each milestone requires a title");
      return;
    }

    if (!isEditTimelineValid) {
      toast.error("Please fix invalid timeline dates before saving");
      return;
    }

    const totalAmount = parseFloat(editAmount) || 0;
    const milestoneTotal = editMilestones.reduce((sum, milestone) => sum + (parseFloat(milestone.amount) || 0), 0);

    if (Math.abs(totalAmount - milestoneTotal) >= 0.000001) {
      toast.error("Milestone total must match agreement total");
      return;
    }

    try {
      setIsSavingDraft(true);

      const res = await fetch(`/api/agreements/${agreement.id}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId: session.user.id,
          status: "NEGOTIATING",
          title: editTitle.trim(),
          description: editDescription,
          amount: totalAmount,
          currency: agreement.currency || "PUSD",
          dueDate: editDueDate,
          milestones: editMilestones.map((milestone, index) => ({
            title: milestone.title.trim(),
            description: milestone.description || null,
            amount: parseFloat(milestone.amount) || 0,
            dueDate: milestone.dueDate || null,
            order: index,
            status: "PENDING",
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.code === "DB_SCHEMA_OUTDATED") {
          throw new Error(
            "Database schema is outdated. Run `npx prisma db push` from packages/db and restart `apps/web`.",
          );
        }
        throw new Error(data?.error || "Failed to update draft");
      }

      toast.success("Draft updated. Freelancer approval is required again before publish.");
      await triggerWorkflowNotification("DRAFT_UPDATED", agreement);
      setIsEditingDraft(false);
      await fetchDetails();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update draft");
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handlePublishAndFund = async () => {
    if (!agreement || !session?.user?.id) return;
    if (activeWallet?.id === "smart" && !adminAccount) {
      toast.error("Could not resolve your admin EOA. Reconnect wallet and try again.");
      return;
    }

    if (!fundingAccount) {
      toast.error("Connect MetaMask wallet to publish and fund");
      return;
    }

    if (!agreement.receiverAddress) {
      toast.error("Freelancer wallet address is missing. Ask freelancer to approve first.");
      return;
    }

    try {
      setIsPublishing(true);
      setFundingError(null);

      console.info(
        `[WebAgreementUI] Publish start agreement=${agreement.id} from=${fundingAccount.address} toContract=${ESCROW_CONTRACT_ADDRESS}`,
      );

      const ownerAddress = fundingAccount.address as `0x${string}`;
      const scaledAmount = scalePusdAmount(String(agreement.amount));
      const permitDeadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 60);
      const nonce = await getPermitNonce(thirdwebClient, ownerAddress);
      const clientRefId = agreementIdToClientRefId(agreement.id);

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

      const signatureRaw = await fundingAccount.signTypedData({
        domain: permitDomain,
        types: permitTypes,
        primaryType: "Permit",
        message: permitMessage,
      });

      const signature = to65ByteSignatureHex(signatureRaw);

      const signatureValid = await verifyTypedData({
        address: ownerAddress,
        domain: permitDomain,
        types: permitTypes,
        primaryType: "Permit",
        message: permitMessage,
        signature,
      });

      if (!signatureValid) {
        throw new Error("Permit signature verification failed");
      }

      const { v, r, s } = splitSignature(signature);

      const tx = prepareContractCall({
        contract: escrowContract,
        method:
          "function createAndFundAgreementWithClientRef(uint256 _clientRefId, address _freelancer, uint256 _amount, uint256 _deadline, uint8 v, bytes32 r, bytes32 s)",
        params: [
          clientRefId,
          agreement.receiverAddress as `0x${string}`,
          scaledAmount,
          permitDeadline,
          Number(v),
          r,
          s,
        ],
      });

      const result = await sendAndConfirmTransaction({
        account: fundingAccount,
        transaction: tx,
      });

      console.info(
        `[WebAgreementUI] Publish tx confirmed agreement=${agreement.id} tx=${result.transactionHash}`,
      );

      await new Promise((resolve) => setTimeout(resolve, 3500));
      const projectId = await getProjectIdByClientRef(thirdwebClient, ownerAddress, clientRefId);

      const publishRes = await fetch(`${API_BASE_URL}/agreements/${agreement.id}/publish`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId: session.user.id,
          projectId: Number(projectId),
          transactionHash: result.transactionHash,
          receiverAddress: agreement.receiverAddress,
          clientRefId: clientRefId.toString(),
        }),
      });

      const publishData = await publishRes.json().catch(() => ({}));
      if (!publishRes.ok) {
        throw new Error(publishData?.error || "Funding succeeded but publish sync failed");
      }

      toast.success("Agreement published on-chain and activated");
      await triggerWorkflowNotification("PUBLISHED", agreement);
      await fetchDetails();
    } catch (error: any) {
      const message = error?.message || "Funding failed";
      setFundingError(message);
      toast.error(message);

      if (agreement && session?.user?.id) {
        await fetch(`${API_BASE_URL}/agreements/${agreement.id}/funding-error`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creatorId: session.user.id,
            errorMessage: message,
          }),
        }).catch(() => null);
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const handleReleaseMilestone = async (milestone: Milestone) => {
    if (!agreement || !onchainData || !fundingAccount) return;
    if (session?.user?.id !== agreement.creator?.id) {
      toast.error("Only the hiring client can release milestone payouts");
      return;
    }
    if (fundingAccount.address.toLowerCase() !== onchainData.client.toLowerCase()) {
      toast.error("Connected wallet is not the agreement client wallet");
      return;
    }

    try {
      setIsReleasing(true);
      const payoutAmount = scalePusdAmount(String(milestone.amount));

      const tx = prepareContractCall({
        contract: escrowContract,
        method: "function releaseMilestone(uint256 _projectId, uint256 _amount)",
        params: [onchainData.projectId, payoutAmount],
      });

      const result = await sendAndConfirmTransaction({
        account: fundingAccount,
        transaction: tx,
      });

      await markMilestonePaidAction({
        agreementId: agreement.id,
        milestoneId: milestone.id,
        payoutTxHash: result.transactionHash,
      });

      toast.success(`Milestone \"${milestone.title}\" released and synced`);
      await fetchDetails();
    } catch (error: any) {
      toast.error(error?.message || "Failed to release milestone");
    } finally {
      setIsReleasing(false);
    }
  };

  const handleReleaseFull = async () => {
    if (!onchainData || !fundingAccount) return;
    if (!agreement || session?.user?.id !== agreement.creator?.id) {
      toast.error("Only the hiring client can authorize full payout");
      return;
    }
    if (fundingAccount.address.toLowerCase() !== onchainData.client.toLowerCase()) {
      toast.error("Connected wallet is not the agreement client wallet");
      return;
    }
    try {
      setIsReleasing(true);
      const remaining = onchainData.amount - onchainData.releasedAmount;

      const tx = prepareContractCall({
        contract: escrowContract,
        method: "function releaseMilestone(uint256 _projectId, uint256 _amount)",
        params: [onchainData.projectId, remaining],
      });

      await sendAndConfirmTransaction({
        account: fundingAccount,
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
  const linkedProjectId = agreement?.projectId ?? (onchainData ? Number(onchainData.projectId) : null);
  const creationTxHash = agreement?.transactionHash || null;
  const txExplorerUrl = creationTxHash ? `https://sepolia.etherscan.io/tx/${creationTxHash}` : null;
  const isPublished = Boolean(
    agreement?.projectId ||
    agreement?.transactionHash ||
    agreement?.status === "ACTIVE" ||
    agreement?.status === "FUNDED" ||
    agreement?.status === "COMPLETED" ||
    onchainData,
  );

  const bTotal = onchainData ? BigInt(onchainData.amount) : BigInt(0);
  const bPaid = onchainData ? BigInt(onchainData.releasedAmount) : BigInt(0);
  const remaining = bTotal - bPaid;
  const isCreatorUser = Boolean(session?.user?.id && agreement?.creator?.id && session.user.id === agreement.creator.id);
  const isFreelancerUser = Boolean(session?.user?.id && agreement?.receiver?.id && session.user.id === agreement.receiver.id);
  const walletMatchesOnchainClient = Boolean(
    fundingAccount?.address && onchainData?.client && fundingAccount.address.toLowerCase() === onchainData.client.toLowerCase(),
  );
  const canReleaseEscrow = Boolean(isCreatorUser && onchainData && walletMatchesOnchainClient);
  const progress = bTotal > BigInt(0) ? Number((bPaid * BigInt(100)) / bTotal) : 0;
  const agreementMilestonesTotal = agreement?.milestones?.reduce((sum, milestone) => sum + (Number(milestone.amount) || 0), 0) || 0;
  const milestonePublishValid = agreement ? Math.abs(agreementMilestonesTotal - Number(agreement.amount || 0)) < 0.000001 : false;

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

              {!isPublished && (
                <motion.section variants={maskedReveal} className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-white shadow-sm border border-[#1A2406]/5 flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 text-[#1A2406]/40" />
                    </div>
                    <h2 className="text-xl font-jakarta font-bold text-[#1A2406]">Draft to Escrow Workflow</h2>
                  </div>

                  <div className="p-6 rounded-[28px] bg-white border border-[#1A2406]/5 space-y-4">
                    <p className="text-xs text-[#1A2406]/50">
                      Current state: <span className="font-bold text-[#1A2406]">{agreement.status}</span>
                    </p>

                    {(agreement as any).changeRequests?.length > 0 && (
                      <div className="space-y-2 rounded-2xl bg-[#1A2406]/[0.02] border border-[#1A2406]/5 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A2406]/40">Change Request Log</p>
                        {(agreement as any).changeRequests.map((entry: any) => (
                          <div key={entry.id} className="text-xs text-[#1A2406]/70">
                            <span className="font-semibold">{entry.requestedBy?.name || entry.requestedBy?.email}</span>: {entry.note}
                          </div>
                        ))}
                      </div>
                    )}

                    {session?.user?.id === agreement.receiver?.id && !isPublished && (
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label>Need revisions?</Label>
                          <Input
                            type="text"
                            value={changeNote}
                            onChange={(e) => setChangeNote(e.target.value)}
                            placeholder="Ask client for specific changes"
                          />
                          <Button disabled={isSubmittingReview} onClick={handleRequestChanges} variant="outline">
                            {isSubmittingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : "Request Changes"}
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <Label>Wallet for escrow payout</Label>
                          <Input
                            type="text"
                            value={approveWallet}
                            onChange={(e) => setApproveWallet(e.target.value)}
                            placeholder="0x..."
                            disabled
                          />
                          {connectedWalletAddress && (
                            <p className="text-[11px] text-[#1A2406]/50">
                              Auto-filled from connected wallet: {connectedWalletAddress}
                            </p>
                          )}
                          <Button disabled={isSubmittingReview} onClick={handleApproveForFunding}>
                            {isSubmittingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : "Approve"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {session?.user?.id === agreement.creator?.id && !isPublished && (
                      <div className="grid gap-3">
                        <Button variant="outline" onClick={() => setIsEditingDraft((prev) => !prev)}>
                          {isEditingDraft ? "Close Editor" : "Edit Agreement"}
                        </Button>
                        <Button disabled={isSubmittingReview} onClick={handleSendAcceptanceEmail}>
                          {isSubmittingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Accept Email"}
                        </Button>
                      </div>
                    )}

                    {session?.user?.id === agreement.creator?.id && !isPublished && isEditingDraft && (
                      <div className="rounded-2xl border border-[#1A2406]/10 bg-[#1A2406]/[0.02] p-4 space-y-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A2406]/40">Edit Draft Inline</p>

                        <div className="space-y-2">
                          <Label>Title</Label>
                          <Input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Description</Label>
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            rows={3}
                            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Total Amount (PUSD)</Label>
                            <Input
                              type="number"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              min={0}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Target Completion Date</Label>
                            <Input
                              type="date"
                              value={editDueDate}
                              min={todayDateString}
                              onChange={(e) => {
                                const nextDate = e.target.value;
                                if (!nextDate) {
                                  setEditDueDate("");
                                  return;
                                }

                                const parsed = parseDateInput(nextDate);
                                if (!parsed) {
                                  toast.error("Invalid target completion date");
                                  return;
                                }

                                if (isBefore(parsed, todayDate)) {
                                  toast.error("Target completion date cannot be earlier than today");
                                  return;
                                }

                                const latestMilestoneDate = editMilestones
                                  .map((milestone) => parseDateInput(milestone.dueDate))
                                  .filter((date): date is Date => Boolean(date))
                                  .sort((a, b) => a.getTime() - b.getTime())
                                  .at(-1);

                                if (latestMilestoneDate && isBefore(parsed, latestMilestoneDate)) {
                                  toast.error("Target completion date cannot be earlier than a milestone due date");
                                  return;
                                }

                                setEditDueDate(nextDate);
                              }}
                            />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label>Milestones</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={addEditMilestone}
                              disabled={editUnallocatedFunds <= 0}
                            >
                              <Plus className="w-4 h-4 mr-2" /> Add
                            </Button>
                          </div>

                          {editMilestones.map((milestone, index) => (
                            <div key={milestone.id || index} className="border rounded-xl p-3 space-y-2 bg-white">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <Input
                                  type="text"
                                  placeholder="Milestone title"
                                  value={milestone.title}
                                  onChange={(e) => updateEditMilestone(index, "title", e.target.value)}
                                />
                                <Input
                                  type="number"
                                  placeholder="Amount"
                                  value={milestone.amount}
                                  min={0}
                                  max={maxAmountForEditMilestone(index)}
                                  onChange={(e) => updateEditMilestone(index, "amount", e.target.value)}
                                />
                              </div>
                              <Input
                                type="date"
                                value={milestone.dueDate}
                                min={todayDateString}
                                max={editDueDate || undefined}
                                onChange={(e) => updateEditMilestone(index, "dueDate", e.target.value)}
                              />
                              <Input
                                type="text"
                                placeholder="Description (optional)"
                                value={milestone.description || ""}
                                onChange={(e) => updateEditMilestone(index, "description", e.target.value)}
                              />
                              <Button type="button" variant="ghost" size="sm" onClick={() => removeEditMilestone(index)}>
                                <Trash2 className="w-4 h-4 mr-2" /> Remove
                              </Button>
                            </div>
                          ))}

                          <div className="rounded-xl bg-white border border-[#1A2406]/10 p-3 flex items-center justify-between">
                            <span className="text-[11px] text-[#1A2406]/60">Unallocated Funds</span>
                            <span className={`text-sm font-bold ${editMilestonesTotal > editTotalAmount ? "text-red-500" : "text-[#1A2406]"}`}>
                              {Math.max(0, editUnallocatedFunds)} PUSD
                            </span>
                          </div>

                          {!isEditMilestoneTotalExact && (
                            <p className="text-xs text-red-500">Milestone total must match agreement total.</p>
                          )}

                          {!isEditTimelineValid && (
                            <p className="text-xs text-red-500">Please align milestone dates between today and target completion date.</p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button
                            onClick={handleSaveDraftInline}
                            disabled={
                              isSavingDraft ||
                              !editTitle.trim() ||
                              !editAmount ||
                              !editDueDate ||
                              !editMilestones.length ||
                              editMilestones.some((milestone) => !milestone.title.trim()) ||
                              !isEditMilestoneTotalExact ||
                              !isEditTimelineValid
                            }
                          >
                            {isSavingDraft ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Save Draft Changes
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsEditingDraft(false);
                              if (agreement) {
                                setEditTitle(agreement.title || "");
                                setEditDescription(agreement.description || "");
                                setEditAmount(String(agreement.amount || ""));
                                setEditDueDate(toDateInput(agreement.dueDate));
                                setEditMilestones(
                                  (agreement.milestones || []).map((milestone) => ({
                                    id: milestone.id,
                                    title: milestone.title || "",
                                    description: milestone.description || "",
                                    amount: String(milestone.amount || ""),
                                    dueDate: toDateInput(milestone.dueDate),
                                  })),
                                );
                              }
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {session?.user?.id === agreement.creator?.id && (
                      <div className="space-y-3">
                        <div className="rounded-2xl border border-[#1A2406]/10 bg-[#1A2406]/[0.02] p-4 space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A2406]/40">Publish With MetaMask</p>
                          <p className="text-xs text-[#1A2406]/60">
                            On publish, funds move from your connected MetaMask account into escrow after signature confirmation.
                          </p>
                          <p className="text-[10px] font-mono text-[#1A2406]/50 break-all">
                            Contract: {ESCROW_CONTRACT_ADDRESS}
                          </p>
                        </div>

                        {!milestonePublishValid && (
                          <p className="text-xs text-red-500">Milestone total must match agreement total.</p>
                        )}
                        {fundingError && (
                          <p className="text-xs text-red-500">Last funding error: {fundingError}</p>
                        )}

                        {agreement.status === "READY_TO_FUND" ? (
                          <Button
                            onClick={handlePublishAndFund}
                            disabled={isPublishing || !milestonePublishValid || isEditingDraft}
                            className="w-full"
                          >
                            {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Publish & Fund With MetaMask"}
                          </Button>
                        ) : (
                          <Button disabled className="w-full">
                            Publish Agreement (waiting freelancer approval)
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.section>
              )}

              {/* Section: Milestone Registry */}
              <motion.section variants={maskedReveal} className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-white shadow-sm border border-[#1A2406]/5 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-[#1A2406]/40" />
                  </div>
                  <h2 className="text-xl font-jakarta font-bold text-[#1A2406]">Payment Roadmap</h2>
                </div>

                {!isPublished && (
                  <div className="p-4 rounded-2xl bg-[#1A2406]/[0.02] border border-[#1A2406]/10 flex items-center justify-between gap-3">
                    <p className="text-xs text-[#1A2406]/60">
                      Milestones are visible in draft and can be edited by the client. Any client update requires freelancer re-approval before publish.
                    </p>
                    {session?.user?.id === agreement.creator?.id ? (
                      <Button variant="outline" size="sm" onClick={() => setIsEditingDraft((prev) => !prev)}>
                        {isEditingDraft ? "Close Editor" : "Edit Milestones"}
                      </Button>
                    ) : null}
                  </div>
                )}

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
                        <div className="flex flex-col items-end gap-2">
                          <Badge variant="outline" className="rounded-full bg-[#FAFAF9] text-[8px] font-black uppercase tracking-widest text-[#1A2406]/30 border-none px-3 py-1">
                            {ms.status}
                          </Badge>
                          {agreement.status === "ACTIVE" && canReleaseEscrow && ms.status !== "PAID" && onchainData && (
                            <Button
                              size="sm"
                              onClick={() => handleReleaseMilestone(ms)}
                              disabled={isReleasing}
                              className="h-8 text-[10px] uppercase tracking-widest"
                            >
                              {isReleasing ? <Loader2 className="w-3 h-3 animate-spin" /> : "Release Milestone"}
                            </Button>
                          )}
                        </div>
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

                {onchainData && !onchainData.isCompleted && remaining > 0n && canReleaseEscrow && (
                  <Button
                    disabled={isReleasing || !fundingAccount}
                    onClick={handleReleaseFull}
                    className="w-full h-14 rounded-2xl bg-[#D9F24F] text-[#1A2406] hover:bg-[#c4db47] font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl shadow-[#D9F24F]/10"
                  >
                    {isReleasing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Zap className="w-4 h-4" /> Authorize Full Payout</>}
                  </Button>
                )}

                {onchainData && !onchainData.isCompleted && remaining > 0n && !canReleaseEscrow && isFreelancerUser && (
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                      Only client can authorize payouts
                    </p>
                  </div>
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
                Protected by PayCrow Secure Protocol.<br />
                On-chain protection: {shortAddress(ESCROW_CONTRACT_ADDRESS)}
              </p>
            </div>
            <div className="w-full pt-4 border-t border-[#1A2406]/5">
              <div className="mb-3 space-y-1 text-left">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A2406]/30">On-Chain Reference</p>
                <p className="text-[10px] font-mono text-[#1A2406]/40">
                  {linkedProjectId !== null ? `Project ID: ${linkedProjectId}` : "Project ID pending"}
                </p>
                {isPublished && creationTxHash ? (
                  <a
                    href={txExplorerUrl || undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-mono text-[#1A2406]/60 hover:text-[#1A2406] transition-colors"
                  >
                    Tx: {shortAddress(creationTxHash)}
                    <ArrowUpRight className="w-3 h-3" />
                  </a>
                ) : (
                  <p className="text-[10px] font-mono text-[#1A2406]/30">Agreement is not published on-chain yet</p>
                )}
              </div>
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
