"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X, Send, Sparkles, MessageSquare, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useActiveAccount,
  TransactionButton,
  ConnectButton,
} from "thirdweb/react";
import { prepareContractCall } from "thirdweb";
import { getEscrowContract } from "@/lib/escrow";
import { thirdwebClient } from "@/lib/thirdweb-client";
import { toast } from "sonner";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

type ToolState =
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error";

type NormalizedToolPart = {
  toolName: string;
  state: ToolState;
  input?: Record<string, any>;
  output?: any;
  errorText?: string;
};

const normalizeToolPart = (part: any): NormalizedToolPart | null => {
  if (!part || typeof part !== "object") {
    return null;
  }

  // AI SDK v6 typed tool parts: tool-my_tool_name
  if (typeof part.type === "string" && part.type.startsWith("tool-")) {
    return {
      toolName: part.type.slice(5),
      state: part.state,
      input: part.input,
      output: part.output,
      errorText: part.errorText,
    };
  }

  // AI SDK dynamic tool part
  if (part.type === "dynamic-tool") {
    return {
      toolName: part.toolName || "unknown",
      state: part.state,
      input: part.input,
      output: part.output,
      errorText: part.errorText,
    };
  }

  // Legacy tool invocation part
  if (part.type === "tool-invocation") {
    const toolInv = part.toolInvocation;
    if (!toolInv) {
      return null;
    }

    if (toolInv.state === "result") {
      return {
        toolName: toolInv.toolName || "unknown",
        state: "output-available",
        input: toolInv.args,
        output: toolInv.result,
      };
    }

    return {
      toolName: toolInv.toolName || "unknown",
      state: "input-available",
      input: toolInv.args,
    };
  }

  return null;
};

const loadingLabelForTool = (toolName: string, input?: Record<string, any>) => {
  if (toolName === "get_wallet_status") return "Checking wallet status...";
  if (toolName === "list_agreements")
    return "Fetching agreements from blockchain...";
  if (toolName === "prepare_release")
    return `Preparing release for Project #${input?.projectId ?? "..."}...`;
  if (toolName === "draft_agreement")
    return `Drafting: "${input?.project_idea ?? "your agreement"}"...`;
  return "Running tool...";
};

export const AICoPilotPopup = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const account = useActiveAccount();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Keep transport stable across renders to avoid dropped streams.
  const transport = React.useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
      }),
    [],
  );

  const { messages, sendMessage, status, error, regenerate, stop } = useChat({
    transport,
    experimental_throttle: 50,
  });

  useEffect(() => {
    if (error) console.error("useChat Error:", error);
  }, [error]);

  const isLoading = status === "submitted" || status === "streaming";

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return;
    const text = inputValue.trim();
    setInputValue("");
    void sendMessage(
      { text },
      {
        body: {
          walletAddress: account?.address || null,
        },
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (text: string) => {
    if (isLoading) return;
    void sendMessage(
      { text },
      {
        body: {
          walletAddress: account?.address || null,
        },
      },
    );
  };

  return (
    <div className="fixed bottom-8 right-8 z-[100] flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.9, y: 20, filter: "blur(10px)" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="mb-6"
          >
            <Card className="w-[400px] h-[600px] border-0 bg-white shadow-[0_32px_64px_-16px_rgba(26,36,6,0.2)] rounded-[40px] flex flex-col overflow-hidden">
              {/* Header */}
              <CardHeader className="p-6 bg-[#1A2406] text-white flex-row items-center gap-3 space-y-0 shrink-0">
                <div className="w-10 h-10 rounded-2xl bg-[#D9F24F] flex items-center justify-center shadow-lg shadow-[#D9F24F]/10">
                  <Bot className="w-5 h-5 text-[#1A2406]" />
                </div>
                <div>
                  <h3 className="text-sm font-jakarta font-bold leading-none">
                    Nexus Intelligence
                  </h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mt-1">
                    {account
                      ? `Connected: ${account.address.slice(0, 6)}...`
                      : "Wallet Not Connected"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="ml-auto text-white/40 hover:text-white hover:bg-white/10 rounded-xl"
                >
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>

              {/* Chat Messages */}
              <CardContent className="flex-1 p-4 overflow-y-auto scrollbar-none flex flex-col gap-4 bg-[#FAFAF9]/50 min-h-0">
                {error && (
                  <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs flex items-center justify-between gap-3">
                    <span>
                      Something went wrong while streaming. Please retry.
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-red-700 hover:text-red-800 hover:bg-red-100"
                      onClick={() =>
                        void regenerate({
                          body: { walletAddress: account?.address || null },
                        })
                      }
                    >
                      Retry
                    </Button>
                  </div>
                )}

                {messages.length === 0 && (
                  <div className="text-center space-y-4 mt-10">
                    <Sparkles className="w-8 h-8 text-[#D9F24F] mx-auto opacity-50" />
                    <p className="text-sm text-[#1A2406]/50">
                      How can I help manage your escrows today?
                    </p>
                  </div>
                )}

                {messages.map((m: any) => {
                  const parts: any[] = m.parts || [];

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col gap-2 ${m.role === "user" ? "items-start max-w-[85%]" : "items-start max-w-[90%] self-end"}`}
                    >
                      <div
                        className={`flex items-center gap-2 ${m.role === "user" ? "pl-2" : "pr-2 ml-auto"}`}
                      >
                        {m.role !== "user" && (
                          <Sparkles className="w-2.5 h-2.5 text-[#D9F24F]" />
                        )}
                        <span className="text-[8px] font-black uppercase tracking-widest text-[#1A2406]/20 leading-none">
                          {m.role === "user" ? "You" : "Nexus Intelligence"}
                        </span>
                      </div>

                      {parts.map((part: any, idx: number) => {
                        // --- Text Part ---
                        if (part.type === "text") {
                          return (
                            <div
                              key={idx}
                              className={`p-4 rounded-[24px] shadow-sm text-sm font-medium leading-relaxed
                                ${
                                  m.role === "user"
                                    ? "bg-white border border-[#1A2406]/5 text-[#1A2406]/80"
                                    : "bg-[#1A2406] text-white border-white/5 rounded-tr-none"
                                }`}
                            >
                              {part.text}
                            </div>
                          );
                        }

                        // --- Tool Part (AI SDK v6 typed tool parts + legacy fallback) ---
                        const toolPart = normalizeToolPart(part);
                        if (toolPart) {
                          const toolName = toolPart.toolName;
                          const hasResult =
                            toolPart.state === "output-available";
                          const hasError = toolPart.state === "output-error";
                          const isToolLoading =
                            toolPart.state === "input-streaming" ||
                            toolPart.state === "input-available";
                          const result = toolPart.output;
                          const input = toolPart.input;

                          return (
                            <div key={idx} className="w-full mt-1">
                              <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl text-xs text-blue-800">
                                {/* Loading state */}
                                {isToolLoading && (
                                  <div className="flex items-center gap-2">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    {loadingLabelForTool(toolName, input)}
                                  </div>
                                )}

                                {hasError && (
                                  <div className="text-red-700 font-medium">
                                    Tool failed:{" "}
                                    {toolPart.errorText || "Unknown tool error"}
                                  </div>
                                )}

                                {/* Generic success */}
                                {hasResult &&
                                  ![
                                    "prepare_release",
                                    "draft_agreement",
                                    "get_wallet_status",
                                    "list_agreements",
                                  ].includes(toolName) && (
                                    <div className="text-green-700 font-bold flex items-center gap-1.5">
                                      <span>✓</span> Task Completed
                                    </div>
                                  )}

                                {/* Agreements List UI Block */}
                                {hasResult &&
                                  toolName === "list_agreements" && (
                                    <div className="mt-1 space-y-2">
                                      {result?.success === false && (
                                        <div className="text-red-700 font-medium">
                                          {result?.error ||
                                            "Could not fetch agreements."}
                                        </div>
                                      )}

                                      {result?.success &&
                                        Array.isArray(result?.agreements) &&
                                        result.agreements.length === 0 && (
                                          <div className="text-blue-700 font-medium">
                                            No active agreements found for this
                                            wallet.
                                          </div>
                                        )}

                                      {result?.success &&
                                        Array.isArray(result?.agreements) &&
                                        result.agreements.length > 0 && (
                                          <div className="space-y-2">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700/70">
                                              Found {result.agreements.length}{" "}
                                              agreement
                                              {result.agreements.length > 1
                                                ? "s"
                                                : ""}
                                            </p>
                                            {result.agreements
                                              .slice(0, 5)
                                              .map((agreement: any) => (
                                                <div
                                                  key={agreement.id}
                                                  className="p-2 rounded-xl border border-blue-200 bg-white text-[11px] text-[#1A2406]"
                                                >
                                                  <div className="font-bold">
                                                    Project #{agreement.id}
                                                  </div>
                                                  <div className="opacity-80">
                                                    Status: {agreement.status}
                                                  </div>
                                                  <div className="opacity-80">
                                                    Total:{" "}
                                                    {agreement.totalAmount_PUSD}{" "}
                                                    PUSD
                                                  </div>
                                                  <div className="opacity-80">
                                                    Released:{" "}
                                                    {
                                                      agreement.releasedAmount_PUSD
                                                    }{" "}
                                                    PUSD
                                                  </div>
                                                </div>
                                              ))}
                                          </div>
                                        )}
                                    </div>
                                  )}

                                {/* Wallet Status UI Block */}
                                {hasResult &&
                                  toolName === "get_wallet_status" &&
                                  result?.status === "connected" && (
                                    <div className="text-green-700 font-bold flex items-center gap-1.5">
                                      <span>✓</span> Wallet Connected
                                    </div>
                                  )}

                                {hasResult &&
                                  toolName === "get_wallet_status" &&
                                  result?.action === "RENDER_UI_BUTTON" && (
                                    <div className="mt-3 p-4 bg-white border border-[#1A2406]/10 rounded-xl shadow-sm flex flex-col items-center text-center">
                                      <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A2406]/40 mb-2">
                                        Action Required
                                      </p>
                                      <p className="text-xs font-medium text-[#1A2406]/80 mb-4">
                                        Please connect your wallet to use
                                        blockchain features.
                                      </p>
                                      <div className="w-full relative nexus-wallet-connect-wrapper">
                                        <ConnectButton
                                          client={thirdwebClient}
                                          connectButton={{
                                            label: "Connect Wallet Now",
                                            className:
                                              "!w-full !bg-[#1A2406] !text-[#D9F24F] !h-10 !rounded-xl !text-xs !font-bold uppercase tracking-widest hover:!scale-[1.02] active:!scale-95 transition-all shadow-lg",
                                          }}
                                        />
                                      </div>
                                    </div>
                                  )}

                                {/* Release Funds Button */}
                                {hasResult &&
                                  toolName === "prepare_release" &&
                                  result?.action === "RENDER_UI_BUTTON" && (
                                    <div className="mt-3 p-3 bg-white border border-[#1A2406]/10 rounded-xl shadow-sm">
                                      <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A2406]/40 mb-2">
                                        Action Required
                                      </p>
                                      <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs font-medium text-[#1A2406]/80">
                                          Project #{result.props.projectId}
                                        </span>
                                        <span className="text-xs font-bold text-[#1A2406]">
                                          {result.props.amount_PUSD} PUSD
                                        </span>
                                      </div>
                                      <TransactionButton
                                        transaction={() => {
                                          const amountWei = BigInt(
                                            Math.floor(
                                              result.props.amount_PUSD *
                                                1_000_000,
                                            ),
                                          );
                                          return prepareContractCall({
                                            contract:
                                              getEscrowContract(thirdwebClient),
                                            method:
                                              "function releaseMilestone(uint256 _id, uint256 _amount)",
                                            params: [
                                              BigInt(result.props.projectId),
                                              amountWei,
                                            ],
                                          });
                                        }}
                                        onTransactionConfirmed={() => {
                                          toast.success(
                                            `Released ${result.props.amount_PUSD} PUSD successfully!`,
                                          );
                                          void sendMessage(
                                            {
                                              text: "The transaction was confirmed on-chain. The funds have been released successfully.",
                                            },
                                            {
                                              body: {
                                                walletAddress:
                                                  account?.address || null,
                                              },
                                            },
                                          );
                                        }}
                                        onError={(err) =>
                                          toast.error(
                                            "Transaction failed: " +
                                              err.message,
                                          )
                                        }
                                        className="nexus-tx-btn !w-full !bg-[#D9F24F] !text-[#1A2406] !h-10 !rounded-xl !text-xs !font-bold uppercase tracking-widest hover:!scale-[1.02] active:!scale-95 transition-all shadow-lg shadow-[#D9F24F]/20"
                                      >
                                        Sign & Release Funds
                                      </TransactionButton>
                                    </div>
                                  )}

                                {/* Draft Agreement Button */}
                                {hasResult &&
                                  toolName === "draft_agreement" &&
                                  result?.action === "RENDER_UI_BUTTON" && (
                                    <div className="mt-3 p-3 bg-white border border-[#1A2406]/10 rounded-xl shadow-sm">
                                      <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A2406]/40 mb-2">
                                        Action Required
                                      </p>
                                      <p className="text-xs font-medium text-[#1A2406]/80 mb-3">
                                        I've prepared your agreement draft.
                                        Click below to open the AI Agreement
                                        Generator.
                                      </p>
                                      <Button
                                        onClick={() => {
                                          setIsOpen(false);
                                          router.push(
                                            `/agreements/new-agreement?idea=${encodeURIComponent(result.props.project_idea)}`,
                                          );
                                        }}
                                        className="w-full h-10 rounded-xl bg-[#D9F24F] text-[#1A2406] font-jakarta font-bold text-xs hover:bg-[#c4db47]"
                                      >
                                        Open Agreement Generator
                                      </Button>
                                    </div>
                                  )}
                              </div>
                            </div>
                          );
                        }

                        return null;
                      })}
                    </div>
                  );
                })}

                {isLoading && (
                  <div className="flex items-center gap-3 text-xs text-[#1A2406]/40 self-end">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" /> Thinking...
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={stop}
                    >
                      Stop
                    </Button>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </CardContent>

              {/* Input Footer */}
              <div className="p-4 bg-white border-t border-[#1A2406]/5 space-y-3 shrink-0">
                {/* Quick Actions */}
                {messages.length === 0 && (
                  <div className="flex flex-wrap gap-2">
                    {[
                      "Am I connected?",
                      "Show my agreements",
                      "Release milestone",
                      "Draft new agreement",
                    ].map((hint) => (
                      <button
                        key={hint}
                        onClick={() => handleQuickAction(hint)}
                        className="px-3 py-1.5 rounded-full bg-white border border-[#1A2406]/5 text-[9px] font-bold text-[#1A2406]/40 hover:bg-[#D9F24F]/10 hover:text-[#1A2406] transition-all shadow-sm"
                      >
                        {hint}
                      </button>
                    ))}
                  </div>
                )}

                <div className="relative">
                  <Input
                    type="text"
                    value={inputValue}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setInputValue(e.target.value)
                    }
                    onKeyDown={handleKeyDown}
                    placeholder="Ask PayCrow Copilot..."
                    className="rounded-2xl border-[#1A2406]/10 h-12 pr-12 text-xs font-medium focus:ring-[#D9F24F]/20"
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={handleSend}
                    disabled={isLoading || !inputValue?.trim()}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl hover:bg-[#D9F24F] hover:text-[#1A2406] transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500
          ${
            isOpen
              ? "bg-[#1A2406] text-[#D9F24F] rotate-90 shadow-[#1A2406]/20"
              : "bg-[#D9F24F] text-[#1A2406] shadow-[#D9F24F]/20"
          }`}
      >
        {isOpen ? (
          <X className="w-7 h-7" />
        ) : (
          <MessageSquare className="w-7 h-7" />
        )}
      </motion.button>
    </div>
  );
};
