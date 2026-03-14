"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Loader2, PlusCircle } from "lucide-react";
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

export default function TicketsPage() {
  const { data: session } = authClient.useSession();

  const [raisedTickets, setRaisedTickets] = useState<Ticket[]>([]);
  const [receivedTickets, setReceivedTickets] = useState<Ticket[]>([]);
  const [agreements, setAgreements] = useState<AgreementOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [ticketDirection, setTicketDirection] = useState<TicketDirection | "">("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    reason: "NON_PAYMENT",
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
        return "bg-yellow-100 text-yellow-800";
      case "IN_REVIEW":
        return "bg-blue-100 text-blue-800";
      case "RESOLVED":
        return "bg-green-100 text-green-800";
      case "CLOSED":
        return "bg-gray-200 text-gray-800";
      case "REJECTED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const TicketCard = ({ ticket, mode }: { ticket: Ticket; mode: "raised" | "received" }) => (
    <Card className="border-gray-200">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{ticket.title}</CardTitle>
            <CardDescription className="mt-1">
              {mode === "raised"
                ? `Against: ${ticket.againstUser.name} (${ticket.againstUser.email})`
                : `Raised by: ${ticket.raisedBy.name} (${ticket.raisedBy.email})`}
            </CardDescription>
          </div>
          <Badge variant="outline" className={getStatusStyle(ticket.status)}>{ticket.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-gray-700">{ticket.description}</p>
        <div className="grid grid-cols-1 gap-2 text-sm text-gray-600 md:grid-cols-2">
          <p><span className="font-medium">Reason:</span> {ticket.reason}</p>
          <p><span className="font-medium">Created:</span> {new Date(ticket.createdAt).toLocaleString()}</p>
          {ticket.agreement ? (
            <p className="md:col-span-2"><span className="font-medium">Agreement:</span> {ticket.agreement.title} ({ticket.agreement.id})</p>
          ) : null}
          {ticket.evidenceUrl ? (
            <p className="md:col-span-2 break-all"><span className="font-medium">Evidence:</span> {ticket.evidenceUrl}</p>
          ) : null}
        </div>
  
      </CardContent>
    </Card>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">Dispute Tickets</h1>
          <p className="mt-2 text-gray-500">Raise tickets when work is not completed or payment is not released on time.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-red-600 hover:bg-red-700">
              <PlusCircle className="mr-2 h-4 w-4" />Raise Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Raise a Dispute Ticket</DialogTitle>
              <DialogDescription>Select an agreement to auto-detect incoming/outgoing and accused user.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input id="title" type="text" value={formData.title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, title: e.target.value })} placeholder="Payment not released after milestone completion" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Input id="description" type="text" value={formData.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, description: e.target.value })} placeholder="Explain what happened and when" />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason *</Label>
                  <Input id="reason" type="text" value={formData.reason} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, reason: e.target.value.toUpperCase() })} placeholder="NON_PAYMENT" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agreementSelect">Agreement</Label>
                  <select id="agreementSelect" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formData.agreementId} onChange={(e) => handleAgreementChange(e.target.value)}>
                    <option value="">No linked agreement</option>
                    {agreements.map((agreement) => (
                      <option key={agreement.id} value={agreement.id}>{agreement.title} ({agreement.direction}) - {agreement.counterpartyName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ticketDirection">Direction (auto)</Label>
                  <Input id="ticketDirection" type="text" value={ticketDirection ? ticketDirection.toUpperCase() : "NOT_SELECTED"} readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="againstUserEmail">Accused User Email *</Label>
                  <Input id="againstUserEmail" type="email" value={formData.againstUserEmail} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, againstUserEmail: e.target.value })} readOnly={Boolean(formData.agreementId)} placeholder="user@example.com" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="agreementId">Agreement ID</Label>
                  <Input id="agreementId" type="text" value={formData.agreementId} readOnly placeholder="Auto-filled from dropdown" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="evidenceUrl">Evidence URL (optional)</Label>
                  <Input id="evidenceUrl" type="text" value={formData.evidenceUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, evidenceUrl: e.target.value })} placeholder="https://..." />
                </div>
              </div>

              <Button className="w-full" disabled={isSubmitting} onClick={handleCreateTicket}>
                {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Raising Ticket...</>) : ("Submit Ticket")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="raised" className="space-y-6">
        <TabsList>
          <TabsTrigger value="raised">Raised by Me ({raisedTickets.length})</TabsTrigger>
          <TabsTrigger value="received">Against Me ({receivedTickets.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="raised" className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Loading raised tickets...</div>
          ) : raisedTickets.length === 0 ? (
            <Card><CardContent className="flex items-center justify-center gap-2 py-10 text-gray-500"><AlertTriangle className="h-4 w-4" />No raised tickets yet.</CardContent></Card>
          ) : (
            raisedTickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} mode="raised" />)
          )}
        </TabsContent>

        <TabsContent value="received" className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Loading received tickets...</div>
          ) : receivedTickets.length === 0 ? (
            <Card><CardContent className="flex items-center justify-center gap-2 py-10 text-gray-500"><AlertTriangle className="h-4 w-4" />No tickets against you.</CardContent></Card>
          ) : (
            receivedTickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} mode="received" />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
