"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { FileText, Plus, Loader2 } from "lucide-react";

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

export default function AgreementsPage() {
  const { data: session } = authClient.useSession();
  const [incomingAgreements, setIncomingAgreements] = useState<Agreement[]>([]);
  const [outgoingAgreements, setOutgoingAgreements] = useState<Agreement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    amount: "",
    currency: "USDC",
    receiverEmail: "",
  });
  const [milestonesData, setMilestonesData] = useState([
    { title: "", description: "", amount: "", dueDate: "" },
  ]);

  // Fetch agreements
  const fetchAgreements = async () => {
    if (!session?.user?.id) {
      console.log('Session not ready, skipping fetch');
      return;
    }
    
    try {
      setIsLoading(true);
      console.log(`Fetching agreements for user: ${session.user.id}`);
      
      const [incomingRes, outgoingRes] = await Promise.all([
        fetch(`http://localhost:5000/agreements/incoming?userId=${session.user.id}`),
        fetch(`http://localhost:5000/agreements/outgoing?userId=${session.user.id}`),
      ]);

      console.log(`Incoming response status: ${incomingRes.status}`);
      console.log(`Outgoing response status: ${outgoingRes.status}`);

      if (incomingRes.ok) {
        const data = await incomingRes.json();
        setIncomingAgreements(data.agreements || []);
      } else {
        const error = await incomingRes.json();
        console.error('Error fetching incoming:', error);
      }

      if (outgoingRes.ok) {
        const data = await outgoingRes.json();
        setOutgoingAgreements(data.agreements || []);
      } else {
        const error = await outgoingRes.json();
        console.error('Error fetching outgoing:', error);
      }
    } catch (error) {
      console.error("Error fetching agreements:", error);
      toast.error("Failed to fetch agreements - make sure the API server is running on http://localhost:5000");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      fetchAgreements();
    }
  }, [session?.user?.id]);

  const handleCreateAgreement = async () => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to create an agreement");
      return;
    }

    if (!formData.receiverEmail) {
      toast.error("Receiver email is required");
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch("http://localhost:5000/agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          creatorId: session.user.id,
          amount: formData.amount ? parseFloat(formData.amount) : 0,
          milestones: milestonesData
            .filter((m) => m.title && m.amount)
            .map((m) => ({
              title: m.title,
              description: m.description,
              amount: parseFloat(m.amount),
              dueDate: m.dueDate ? new Date(m.dueDate) : null,
            })),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create agreement");
      }

      toast.success("Agreement created successfully!");
      setIsDialogOpen(false);
      setFormData({
        title: "",
        description: "",
        amount: "",
        currency: "USDC",
        receiverEmail: "",
      });
      setMilestonesData([{ title: "", description: "", amount: "", dueDate: "" }]);
      fetchAgreements();
    } catch (error: any) {
      console.error("Error creating agreement:", error);
      toast.error(error.message || "Failed to create agreement");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "ACTIVE":
        return "bg-blue-100 text-blue-800";
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const AgreementCard = ({ agreement, type }: { agreement: Agreement; type: "incoming" | "outgoing" }) => (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {agreement.title}
            </CardTitle>
            <CardDescription className="mt-2">
              {type === "incoming"
                ? `From: ${agreement.creator.name} (${agreement.creator.email})`
                : `To: ${agreement.receiver.name} (${agreement.receiver.email})`}
            </CardDescription>
          </div>
          <Badge className={getStatusColor(agreement.status)}>{agreement.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {agreement.description && <p className="text-sm text-gray-600">{agreement.description}</p>}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">Total Amount</p>
            <p className="text-lg font-semibold">
              {agreement.amount} {agreement.currency}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Milestones</p>
            <p className="text-lg font-semibold">{agreement.milestones.length}</p>
          </div>
        </div>
        {agreement.milestones.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-semibold mb-2">Milestones:</p>
            <div className="space-y-2">
              {agreement.milestones.map((milestone) => (
                <div key={milestone.id} className="bg-gray-50 p-2 rounded text-sm">
                  <div className="flex justify-between items-start">
                    <span className="font-medium">{milestone.title}</span>
                    <Badge variant="outline">{milestone.amount} {agreement.currency}</Badge>
                  </div>
                  {milestone.description && <p className="text-gray-600 text-xs mt-1">{milestone.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="text-xs text-gray-500 pt-2">
          Created {new Date(agreement.createdAt).toLocaleDateString()}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">Agreements</h1>
          <p className="text-gray-500 mt-2">Create and manage your escrow agreements and milestones.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0 bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 w-4 h-4" />
              Create Agreement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Agreement</DialogTitle>
              <DialogDescription>Create an escrow agreement with milestones</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Agreement Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Website Development Project"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Detailed description of the agreement"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Total Amount *</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="1000"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Input
                    id="currency"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    readOnly
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="receiverEmail">Receiver Email *</Label>
                <Input
                  id="receiverEmail"
                  type="email"
                  placeholder="receiver@example.com"
                  value={formData.receiverEmail}
                  onChange={(e) => setFormData({ ...formData, receiverEmail: e.target.value })}
                />
              </div>

              <div className="space-y-3 pt-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">Milestones</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setMilestonesData([...milestonesData, { title: "", description: "", amount: "", dueDate: "" }])
                    }
                  >
                    Add Milestone
                  </Button>
                </div>

                {milestonesData.map((milestone, index) => (
                  <Card key={index} className="p-4">
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Label htmlFor={`milestone-title-${index}`} className="text-sm">
                            Title
                          </Label>
                          <Input
                            id={`milestone-title-${index}`}
                            placeholder="e.g., Design Phase"
                            value={milestone.title}
                            onChange={(e) => {
                              const newMilestones = [...milestonesData];
                              newMilestones[index].title = e.target.value;
                              setMilestonesData(newMilestones);
                            }}
                          />
                        </div>
                        <div className="w-24">
                          <Label htmlFor={`milestone-amount-${index}`} className="text-sm">
                            Amount
                          </Label>
                          <Input
                            id={`milestone-amount-${index}`}
                            type="number"
                            placeholder="100"
                            value={milestone.amount}
                            onChange={(e) => {
                              const newMilestones = [...milestonesData];
                              newMilestones[index].amount = e.target.value;
                              setMilestonesData(newMilestones);
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor={`milestone-desc-${index}`} className="text-sm">
                          Description
                        </Label>
                        <Input
                          id={`milestone-desc-${index}`}
                          placeholder="Description"
                          value={milestone.description}
                          onChange={(e) => {
                            const newMilestones = [...milestonesData];
                            newMilestones[index].description = e.target.value;
                            setMilestonesData(newMilestones);
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`milestone-date-${index}`} className="text-sm">
                          Due Date
                        </Label>
                        <Input
                          id={`milestone-date-${index}`}
                          type="date"
                          value={milestone.dueDate}
                          onChange={(e) => {
                            const newMilestones = [...milestonesData];
                            newMilestones[index].dueDate = e.target.value;
                            setMilestonesData(newMilestones);
                          }}
                        />
                      </div>
                      {milestonesData.length > 1 && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            const newMilestones = milestonesData.filter((_, i) => i !== index);
                            setMilestonesData(newMilestones);
                          }}
                          className="w-full"
                        >
                          Delete Milestone
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>

              <Button
                onClick={handleCreateAgreement}
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : null}
                Create Agreement
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="incoming" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="incoming">
            Incoming ({incomingAgreements.length})
          </TabsTrigger>
          <TabsTrigger value="outgoing">
            Outgoing ({outgoingAgreements.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="incoming" className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : incomingAgreements.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">No incoming agreements yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {incomingAgreements.map((agreement) => (
                <AgreementCard key={agreement.id} agreement={agreement} type="incoming" />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="outgoing" className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : outgoingAgreements.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">No outgoing agreements yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
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
