"use client";

import React, { useEffect, useState } from "react";
import { 
  AlertTriangle, 
  Loader2, 
  PlusCircle, 
  ShieldAlert, 
  LifeBuoy, 
  Gavel, 
  Search, 
  Filter, 
  ArrowUpRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  Plus
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

type TicketDirection = "incoming" | "outgoing";

interface Ticket {
  id: string;
  title: string;
  description: string;
  reason: string;
  status: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  evidenceUrl?: string | null;
  createdAt: string;
  raisedBy: { id: string; name: string; email: string };
  againstUser: { id: string; name: string; email: string };
  agreement?: { id: string; title: string; status: string } | null;
}

interface AgreementOption {
  id: string;
  title: string;
  status: string;
  direction: TicketDirection;
  counterpartyName: string;
  counterpartyEmail: string;
}

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

export default function TicketsPage() {
  const { data: session } = authClient.useSession();

  const [raisedTickets, setRaisedTickets] = useState<Ticket[]>([]);
  const [receivedTickets, setReceivedTickets] = useState<Ticket[]>([]);
  const [agreements, setAgreements] = useState<AgreementOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [ticketDirection, setTicketDirection] = useState<TicketDirection | "">("");
  const [activeTab, setActiveTab] = useState<"raised" | "received">("raised");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isAuditOpen, setIsAuditOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    reason: "NON_PAYMENT",
    severity: "LOW" as const,
    againstUserEmail: "",
    agreementId: "",
    evidenceUrl: "",
  });

  const fetchTickets = async () => {
    if (!session?.user?.id) return;

    try {
      setIsLoading(true);
      const userId = encodeURIComponent(session.user.id);
      const [raisedRes, receivedRes] = await Promise.all([
        fetch(`${API_BASE_URL}/tickets/raised?userId=${userId}`),
        fetch(`${API_BASE_URL}/tickets/received?userId=${userId}`),
      ]);

      if (raisedRes.ok) {
        const data = await raisedRes.json();
        setRaisedTickets(Array.isArray(data.tickets) ? data.tickets : []);
      }
      if (receivedRes.ok) {
        const data = await receivedRes.json();
        setReceivedTickets(Array.isArray(data.tickets) ? data.tickets : []);
      }
    } catch (error) {
      console.error("Error fetching tickets:", error);
      toast.error("Failed to fetch tickets. Ensure API server is running on port 5000.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserAgreements = async () => {
    if (!session?.user?.id) return;

    try {
      const userId = encodeURIComponent(session.user.id);
      const [incomingRes, outgoingRes] = await Promise.all([
        fetch(`${API_BASE_URL}/agreements/incoming?userId=${userId}`),
        fetch(`${API_BASE_URL}/agreements/outgoing?userId=${userId}`),
      ]);

      const incomingData = incomingRes.ok ? await incomingRes.json() : { agreements: [] };
      const outgoingData = outgoingRes.ok ? await outgoingRes.json() : { agreements: [] };

      const incomingOptions: AgreementOption[] = (incomingData.agreements || []).map((agreement: any) => ({
        id: agreement.id,
        title: agreement.title,
        status: agreement.status,
        direction: "incoming",
        counterpartyName: agreement.creator?.name || "Unknown",
        counterpartyEmail: agreement.creator?.email || "",
      }));

      const outgoingOptions: AgreementOption[] = (outgoingData.agreements || []).map((agreement: any) => ({
        id: agreement.id,
        title: agreement.title,
        status: agreement.status,
        direction: "outgoing",
        counterpartyName: agreement.receiver?.name || "Unknown",
        counterpartyEmail: agreement.receiver?.email || "",
      }));

      setAgreements([...incomingOptions, ...outgoingOptions]);
    } catch (error) {
      console.error("Error fetching agreements for ticket form:", error);
      toast.error("Could not load agreements for ticket form");
    }
  };

  const handleAgreementChange = (agreementId: string) => {
    if (!agreementId) {
      setTicketDirection("");
      setFormData((prev) => ({ ...prev, agreementId: "", againstUserEmail: "" }));
      return;
    }

    const selectedAgreement = agreements.find((agreement) => agreement.id === agreementId);
    if (!selectedAgreement) return;

    setTicketDirection(selectedAgreement.direction);
    setFormData((prev) => ({
      ...prev,
      agreementId: selectedAgreement.id,
      againstUserEmail: selectedAgreement.counterpartyEmail,
    }));
  };

  useEffect(() => {
    if (session?.user?.id) {
      fetchTickets();
      fetchUserAgreements();
    }
  }, [session?.user?.id]);

  const handleCreateTicket = async () => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to raise a ticket");
      return;
    }

    if (!formData.title || !formData.description || !formData.againstUserEmail) {
      toast.error("Title, description, and accused user email are required");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(`${API_BASE_URL}/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          reason: formData.reason,
          severity: formData.severity,
          raisedById: session.user.id,
          againstUserEmail: formData.againstUserEmail,
          agreementId: formData.agreementId || undefined,
          evidenceUrl: formData.evidenceUrl || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create ticket");

      toast.success("Ticket raised successfully");
      setIsDialogOpen(false);
      setTicketDirection("");
      setFormData({
        title: "",
        description: "",
        reason: "NON_PAYMENT",
        severity: "LOW",
        againstUserEmail: "",
        agreementId: "",
        evidenceUrl: "",
      });
      fetchTickets();
    } catch (error: any) {
      console.error("Error creating ticket:", error);
      toast.error(error.message || "Failed to create ticket");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status.toUpperCase()) {
      case "OPEN":
        return "bg-yellow-100 text-yellow-800 border-yellow-200/50";
      case "IN_REVIEW":
        return "bg-blue-100 text-blue-800 border-blue-200/50";
      case "RESOLVED":
        return "bg-[#D9F24F]/20 text-[#1A2406] border-[#D9F24F]/30";
      case "CLOSED":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "REJECTED":
        return "bg-red-100 text-red-800 border-red-200/50";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toUpperCase()) {
      case "OPEN": return <AlertCircle className="w-3.5 h-3.5" />;
      case "IN_REVIEW": return <Clock className="w-3.5 h-3.5" />;
      case "RESOLVED": return <CheckCircle2 className="w-3.5 h-3.5" />;
      case "REJECTED": return <AlertTriangle className="w-3.5 h-3.5" />;
      default: return <Clock className="w-3.5 h-3.5" />;
    }
  };

  const getSeverityStyle = (severity: string) => {
    switch (severity.toUpperCase()) {
      case "LOW":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "MEDIUM":
        return "bg-amber-50 text-amber-700 border-amber-100";
      case "HIGH":
        return "bg-orange-50 text-orange-700 border-orange-100";
      case "CRITICAL":
        return "bg-rose-50 text-rose-700 border-rose-100 font-black animate-pulse";
      default:
        return "bg-gray-50 text-gray-600";
    }
  };

  const TicketCard = ({ ticket, mode }: { ticket: Ticket; mode: "raised" | "received" }) => (
    <motion.div variants={itemVariants} whileHover={HOVER_SCALE}>
      <Card className="group relative bg-white/40 backdrop-blur-xl border border-white/60 rounded-[28px] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:border-[#1A2406]/10 transition-all duration-500">
        <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent pointer-events-none" />
        
        <CardHeader className="pb-3 relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5 ${getStatusStyle(ticket.status)}`}>
                  {getStatusIcon(ticket.status)}
                  {ticket.status}
                </Badge>
                <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${getSeverityStyle(ticket.severity)}`}>
                  {ticket.severity}
                </Badge>
                <span className="text-[10px] font-mono text-[#1A2406]/20 font-bold uppercase tracking-widest">#{ticket.id.slice(-6)}</span>
              </div>
              <CardTitle className="text-xl font-jakarta font-bold text-[#1A2406] tracking-tight mt-2 flex items-center gap-2">
                {ticket.title}
                <ChevronRight className="w-4 h-4 text-[#1A2406]/10 group-hover:translate-x-1 transition-transform" />
              </CardTitle>
            </div>
            <div className="p-2.5 bg-white/80 rounded-xl border border-white shadow-sm shrink-0">
              <Gavel className="w-5 h-5 text-[#1A2406]" />
            </div>
          </div>
          <CardDescription className="text-xs font-medium text-[#1A2406]/40 flex items-center gap-2 mt-1">
            {mode === "raised" ? (
              <>Against: <span className="text-[#1A2406]">{ticket.againstUser.name}</span></>
            ) : (
              <>Raised by: <span className="text-[#1A2406]">{ticket.raisedBy.name}</span></>
            )}
            <span className="opacity-20">•</span>
            <span>{new Date(ticket.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 relative z-10">
          <p className="text-sm text-[#1A2406]/70 leading-relaxed line-clamp-2 italic font-serif">
            "{ticket.description}"
          </p>
          
          <div className="grid grid-cols-2 gap-4 pb-2">
            <div className="space-y-1">
              <p className="text-[9px] font-bold text-[#1A2406]/20 uppercase tracking-widest leading-none">Category</p>
              <p className="text-[11px] font-bold text-[#1A2406]">{ticket.reason.replace('_', ' ')}</p>
            </div>
            {ticket.agreement && (
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-[#1A2406]/20 uppercase tracking-widest leading-none">Linked Agreement</p>
                <p className="text-[11px] font-bold text-[#1A2406] truncate max-w-[120px]">{ticket.agreement.title}</p>
              </div>
            )}
          </div>
          
          <div className="pt-3 border-t border-white/40 flex items-center justify-between">
            <div className="flex -space-x-2">
              <div className="w-7 h-7 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold">JD</div>
              <div className="w-7 h-7 rounded-full bg-[#D9F24F] border-2 border-white flex items-center justify-center text-[10px] font-bold">NX</div>
            </div>
            <button 
              onClick={() => {
                setSelectedTicket(ticket);
                setIsAuditOpen(true);
              }}
              className="text-[10px] font-bold tracking-[0.1em] uppercase text-[#1A2406]/40 hover:text-[#1A2406] transition-colors flex items-center gap-1"
            >
              Detailed Audit <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  const tabs = [
    { id: "raised", label: "Raised by Me", count: raisedTickets.length },
    { id: "received", label: "Against Me", count: receivedTickets.length },
  ];

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="visible"
      className="mx-auto max-w-6xl space-y-8 pt-2 pb-10"
    >
      {/* ── Greeting Section (Dashboard Style) ── */}
      <motion.div variants={maskedReveal} className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-[#1A2406] text-[#D9F24F] text-[10px] font-bold tracking-[0.2em] px-3 py-1.5 rounded-full border border-[#D9F24F]/20 flex items-center gap-1.5 uppercase leading-none shadow-lg shadow-[#1A2406]/10">
              <ShieldAlert className="w-3.5 h-3.5" />
              Nexus Justice Protocol: Active
            </span>
          </div>
          <h1 className="font-jakarta text-4xl tracking-[-0.04em] text-[#1A2406]">
            Dispute <span className="font-light text-[#1A2406]/40">Resolution</span>
          </h1>
          <p className="font-sans text-[#1A2406]/30 text-sm font-medium">
            Manage conflicts, audit agreements, and secure your transactions.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <motion.div whileHover={HOVER_SCALE} whileTap={BUTTON_PRESS}>
                <button className="rounded-xl bg-[#1A2406] text-white px-6 py-3 text-xs font-bold tracking-tight flex items-center gap-2 shadow-2xl shadow-[#1A2406]/20 active:scale-95 transition-all">
                  <PlusCircle className="w-4 h-4 text-[#D9F24F]" />
                  Raise New Dispute
                </button>
              </motion.div>
            </DialogTrigger>
            
            <DialogContent className="max-w-2xl bg-white border border-black/5 rounded-2xl shadow-xl overflow-hidden p-0">
              <div className="bg-[#1A2406] p-6 text-white relative">
                <DialogTitle className="text-xl font-jakarta font-bold tracking-tight">Raise Dispute</DialogTitle>
                <DialogDescription className="text-white/40 text-[11px] font-medium uppercase tracking-[0.05em] mt-0.5">
                  Nexus Arbitration Protocol - Investigation 0x{Math.random().toString(16).slice(2, 8).toUpperCase()}
                </DialogDescription>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="title" className="text-[10px] font-bold uppercase tracking-widest text-[#1A2406]/40">Title *</Label>
                    <Input id="title" type="text" className="rounded-lg border-black/[0.1] bg-white h-11 text-sm focus-visible:ring-[#1A2406]/5" value={formData.title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, title: e.target.value })} placeholder="Brief non-compliance summary" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="againstUserEmail" className="text-[10px] font-bold uppercase tracking-widest text-[#1A2406]/40">Accused User Email *</Label>
                    <Input id="againstUserEmail" type="email" className="rounded-lg border-black/[0.1] bg-white h-11 text-sm focus-visible:ring-[#1A2406]/5" value={formData.againstUserEmail} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, againstUserEmail: e.target.value })} readOnly={Boolean(formData.agreementId)} placeholder="user@example.com" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reason" className="text-[10px] font-bold uppercase tracking-widest text-[#1A2406]/40">Breach Reason *</Label>
                    <Input id="reason" type="text" className="rounded-lg border-black/[0.1] bg-white h-11 text-sm focus-visible:ring-[#1A2406]/5" value={formData.reason} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, reason: e.target.value.toUpperCase() })} placeholder="e.g. NON_PAYMENT" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="severity" className="text-[10px] font-bold uppercase tracking-widest text-[#1A2406]/40">Severity Level *</Label>
                    <div className="relative">
                      <select 
                        id="severity" 
                        className="w-full h-11 rounded-lg border border-black/[0.1] bg-white px-3 text-sm appearance-none outline-none focus:ring-1 focus:ring-[#1A2406]/10 font-bold" 
                        value={formData.severity} 
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, severity: e.target.value as any })}
                      >
                        <option value="LOW">LOW</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="HIGH">HIGH</option>
                        <option value="CRITICAL">CRITICAL</option>
                      </select>
                      <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A2406]/20 rotate-90 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description" className="text-[10px] font-bold uppercase tracking-widest text-[#1A2406]/40">Evidence Narration *</Label>
                  <textarea 
                    id="description" 
                    className="w-full rounded-lg border border-black/[0.1] bg-white p-3 text-sm min-h-[80px] outline-none focus:ring-1 focus:ring-[#1A2406]/10" 
                    value={formData.description} 
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                    placeholder="Describe facts and non-compliance details..."
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="agreementSelect" className="text-[10px] font-bold uppercase tracking-widest text-[#1A2406]/40">Linked Agreement (Optional)</Label>
                    <div className="relative">
                      <select id="agreementSelect" className="w-full h-11 rounded-lg border border-black/[0.1] bg-white px-3 text-sm appearance-none outline-none focus:ring-1 focus:ring-[#1A2406]/10" value={formData.agreementId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleAgreementChange(e.target.value)}>
                        <option value="">Independent Dispute</option>
                        {agreements.map((agreement) => (
                          <option key={agreement.id} value={agreement.id}>{agreement.title}</option>
                        ))}
                      </select>
                      <Plus className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#1A2406]/20 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="evidenceUrl" className="text-[10px] font-bold uppercase tracking-widest text-[#1A2406]/40">Evidence Link</Label>
                  <Input id="evidenceUrl" type="url" className="rounded-lg border-black/[0.1] bg-white h-11 text-sm focus-visible:ring-[#1A2406]/5" value={formData.evidenceUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, evidenceUrl: e.target.value })} placeholder="https://..." />
                </div>

                <motion.div whileTap={BUTTON_PRESS}>
                  <Button className="w-full h-12 rounded-xl bg-[#1A2406] text-[#D9F24F] font-bold text-sm tracking-tight" disabled={isSubmitting} onClick={handleCreateTicket}>
                    {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Filing...</>) : ("Execute Dispute Request")}
                  </Button>
                </motion.div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* ── Tabs (Profile Style) ── */}
      <motion.div variants={maskedReveal} className="relative border-b border-black/[0.05] mb-8">
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
                  layoutId="active-ticket-tab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D9F24F] shadow-[0_0_10px_rgba(217,242,79,0.8)]"
                />
              )}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── Content ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-[#1A2406]/10" />
              <p className="text-[10px] font-bold tracking-[0.2em] text-[#1A2406]/20 uppercase">Synchronizing Ledgers</p>
            </div>
          ) : (activeTab === "raised" ? raisedTickets : receivedTickets).length === 0 ? (
            <motion.div 
              variants={itemVariants} 
              className="bg-white/40 backdrop-blur-md border border-dashed border-[#1A2406]/5 rounded-[32px] p-24 text-center"
            >
              <div className="w-16 h-16 bg-white rounded-2xl p-5 shadow-sm mx-auto mb-6 flex items-center justify-center border border-white">
                <ShieldAlert className="w-7 h-7 text-[#1A2406]/10" />
              </div>
              <h3 className="font-jakarta text-2xl font-bold text-[#1A2406] mb-3 tracking-[-0.04em]">Pure Ledger State</h3>
              <p className="text-[#1A2406]/30 max-w-xs mx-auto text-sm leading-relaxed mb-8 font-medium italic">
                No active disputes detected in this sector.
              </p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(activeTab === "raised" ? raisedTickets : receivedTickets).map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} mode={activeTab} />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Detailed Audit Modal ── */}
      <Dialog open={isAuditOpen} onOpenChange={setIsAuditOpen}>
        <DialogContent className="max-w-xl bg-white border border-black/5 rounded-2xl shadow-2xl p-0 overflow-hidden">
          {selectedTicket && (
            <div className="flex flex-col">
              <div className="bg-[#1A2406] p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase border-none ${getStatusStyle(selectedTicket.status)}`}>
                      {selectedTicket.status}
                    </Badge>
                    <Badge variant="outline" className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase border-none ${getSeverityStyle(selectedTicket.severity)}`}>
                      {selectedTicket.severity}
                    </Badge>
                    <span className="text-[10px] font-mono text-white/30 uppercase tracking-[0.2em] ml-auto">Audit Report</span>
                  </div>
                </div>
                <DialogTitle className="text-xl font-jakarta font-bold tracking-tight">{selectedTicket.title}</DialogTitle>
                <DialogDescription className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">
                  Reference #{selectedTicket.id.slice(-12).toUpperCase()}
                </DialogDescription>
              </div>

              <div className="p-8 space-y-8">
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#1A2406]/40">Case Narration</h4>
                  <p className="text-sm text-[#1A2406]/80 leading-relaxed font-serif italic border-l-2 border-[#D9F24F] pl-4 py-1">
                    "{selectedTicket.description}"
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-8 py-6 border-y border-black/[0.03]">
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-[#1A2406]/30 uppercase tracking-[0.15em]">Petitioner</p>
                    <p className="text-xs font-bold text-[#1A2406]">{selectedTicket.raisedBy.name}</p>
                    <p className="text-[10px] text-[#1A2406]/40">{selectedTicket.raisedBy.email}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[9px] font-bold text-[#1A2406]/30 uppercase tracking-[0.15em]">Defendant</p>
                    <p className="text-xs font-bold text-[#1A2406]">{selectedTicket.againstUser.name}</p>
                    <p className="text-[10px] text-[#1A2406]/40">{selectedTicket.againstUser.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-[#1A2406]/30 uppercase tracking-[0.15em]">Breach Type</p>
                    <p className="text-xs font-bold text-[#1A2406]">{selectedTicket.reason.replace('_', ' ')}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[9px] font-bold text-[#1A2406]/30 uppercase tracking-[0.15em]">Filing Date</p>
                    <p className="text-xs font-bold text-[#1A2406]">{new Date(selectedTicket.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
                  </div>
                </div>

                {selectedTicket.agreement && (
                  <div className="bg-[#1A2406]/[0.02] border border-black/[0.03] rounded-xl p-4 flex items-center justify-between group cursor-pointer hover:bg-black/[0.04] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white border border-black/[0.05] flex items-center justify-center text-[#1A2406]">
                        <Gavel className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-[#1A2406]/30 uppercase tracking-widest leading-none mb-1">Agreement Link</p>
                        <p className="text-xs font-bold text-[#1A2406]">{selectedTicket.agreement.title}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#1A2406]/20 group-hover:text-[#1A2406] transition-colors" />
                  </div>
                )}

                {selectedTicket.evidenceUrl && (
                  <div className="space-y-2 pt-2">
                    <p className="text-[9px] font-bold text-[#1A2406]/30 uppercase tracking-widest">Digital Evidence</p>
                    <a 
                      href={selectedTicket.evidenceUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1.5"
                    >
                      Audit Proof.pdf <ArrowUpRight className="w-3 h-3" />
                    </a>
                  </div>
                )}

                <div className="pt-4">
                  <Button 
                    variant="outline" 
                    className="w-full h-11 rounded-xl text-[10px] font-bold uppercase tracking-widest border-black/[0.08]" 
                    onClick={() => setIsAuditOpen(false)}
                  >
                    Close Report
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
