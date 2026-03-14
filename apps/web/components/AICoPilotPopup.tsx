"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X, Send, Sparkles, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── AI Response Typewriter Component ───
const TypewriterText = ({ text, delay = 30 }: { text: string; delay?: number }) => {
  const [displayedText, setDisplayedText] = useState("");
  const words = text.split(" ");
  
  useEffect(() => {
    let currentWordIndex = 0;
    const interval = setInterval(() => {
      if (currentWordIndex < words.length) {
        setDisplayedText((prev) => prev + (currentWordIndex === 0 ? "" : " ") + words[currentWordIndex]);
        currentWordIndex++;
      } else {
        clearInterval(interval);
      }
    }, delay);
    return () => clearInterval(interval);
  }, [text, delay]);

  return <span>{displayedText}</span>;
};

export const AICoPilotPopup = () => {
  const [isOpen, setIsOpen] = useState(false);

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
            <Card className="w-[400px] h-[600px] border-0 bg-white shadow-[0_32px_64px_-16px_rgba(26,36,6,0.2)] rounded-[40px] flex flex-col overflow-hidden border border-[#1A2406]/5">
              <CardHeader className="p-6 bg-[#1A2406] text-white flex flex-row items-center gap-3 space-y-0">
                <div className="w-10 h-10 rounded-2xl bg-[#D9F24F] flex items-center justify-center shadow-lg shadow-[#D9F24F]/10">
                    <Bot className="w-5 h-5 text-[#1A2406]" />
                </div>
                <div>
                    <h3 className="text-sm font-jakarta font-bold leading-none">Nexus Intelligence</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mt-1">Global Co-Pilot</p>
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
              
              <CardContent className="flex-1 p-6 overflow-y-auto scrollbar-none flex flex-col gap-6 bg-[#FAFAF9]/50">
                {/* User Message Demo */}
                <div className="flex flex-col items-start gap-2 max-w-[85%]">
                    <div className="flex items-center gap-2 pl-2">
                        <span className="text-[8px] font-black uppercase tracking-widest text-[#1A2406]/20 leading-none">Client Requester</span>
                    </div>
                    <div className="p-4 rounded-[24px] bg-white border border-[#1A2406]/5 text-sm font-medium text-[#1A2406]/80 leading-relaxed shadow-sm">
                        How can I optimize my current escrow strategy?
                    </div>
                </div>

                {/* AI Reply Demo with Typewriter */}
                <div className="flex flex-col items-start gap-2 max-w-[90%] self-end">
                    <div className="flex items-center gap-2 pr-2 ml-auto">
                        <Sparkles className="w-2.5 h-2.5 text-[#D9F24F]" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-[#1A2406]/20 leading-none">Nexus Intelligence</span>
                    </div>
                    <div className="p-5 rounded-[28px] rounded-tr-none bg-[#1A2406] text-white text-xs font-medium leading-relaxed shadow-xl shadow-[#1A2406]/10 border border-white/5">
                        <TypewriterText text="I recommend implementing multi-stage cryptographic verification. By segmenting your project into modular nodes with 48-hour challenge periods, you reduce settlement friction while maintaining EIP-2612 compliance." />
                    </div>
                </div>

                <div className="mt-auto pt-4 flex flex-wrap gap-2">
                    {["Audit My Protocol", "Market Rates", "Risk Policy"].map((hint) => (
                        <button key={hint} className="px-3 py-1.5 rounded-full bg-white border border-[#1A2406]/5 text-[9px] font-bold text-[#1A2406]/40 hover:bg-[#D9F24F]/10 hover:text-[#1A2406] transition-all shadow-sm">
                            {hint}
                        </button>
                    ))}
                </div>
              </CardContent>

              <div className="p-4 bg-white border-t border-[#1A2406]/5">
                <div className="relative">
                    <Input 
                        placeholder="Interrogate co-pilot..." 
                        className="rounded-2xl border-[#1A2406]/10 h-12 pr-12 text-xs font-medium focus:ring-[#D9F24F]/20" 
                    />
                    <Button 
                        size="icon" 
                        variant="ghost" 
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
          ${isOpen 
            ? 'bg-[#1A2406] text-[#D9F24F] rotate-90 shadow-[#1A2406]/20' 
            : 'bg-[#D9F24F] text-[#1A2406] shadow-[#D9F24F]/20'
          }`}
      >
        {isOpen ? <X className="w-7 h-7" /> : <MessageSquare className="w-7 h-7" />}
        
        {!isOpen && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#1A2406] text-[#D9F24F] rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-[#D9F24F]">
                1
            </div>
        )}
      </motion.button>
    </div>
  );
};
