"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Shield,
  Activity,
  Wallet,
  CheckCircle2,
  Lock,
  Key,
  FileText,
  Loader2,
  Camera,
  Globe,
  Plus,
  ShieldCheck,
  CreditCard,
  Zap,
  Users,
  Monitor,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
] as const;

const LANGUAGE_STORAGE_KEY = "devally_lang_pref";

const setGoogTransCookie = (languageCode: string) => {
  const cookieValue = `/auto/${languageCode}`;
  document.cookie = `googtrans=${cookieValue};path=/`;
};

const applyLanguage = (languageCode: string) => {
  setGoogTransCookie(languageCode);

  const combo = document.querySelector(".goog-te-combo") as HTMLSelectElement | null;
  if (!combo) return;

  combo.value = languageCode;
  combo.dispatchEvent(new Event("change"));
};

// Functional Tab Components
import ProfileUpdateTab from './ProfileUpdateTab';
import { TwoFactorAuth } from './TwoFactorAuth';
import { PasskeyManagement } from './PasskeyManagement';
import SessionManagement from './SessionManagement';
import AccountLinking from './AccountLinking';

// ─── Animation Variants (Solv. Style) ───────────────────────────────────────
const SPRING = { type: "spring" as const, stiffness: 300, damping: 30 };
const HOVER_SCALE = { scale: 1.01, transition: SPRING };
const BUTTON_PRESS = { scale: 0.98 };

const maskedReveal = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { ...SPRING, delay: 0.1 } },
};
const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

// ─── Compact Rolling Counter ───
const RollingCounter = ({ value, prefix = "", suffix = "", decimals = 0 }: { value: number, prefix?: string, suffix?: string, decimals?: number }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    let start = displayValue;
    const end = value;
    if (start === end) return;
    const duration = 1500;
    const startTime = performance.now();
    const update = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 5); 
      const current = start + (end - start) * ease;
      setDisplayValue(current);
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }, [value]);

  const format = (num: number) => {
    return num.toLocaleString('en-IN', { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    });
  };

  return (
    <span className="tabular-nums font-medium tracking-tight">
      {prefix}{isMounted ? format(displayValue) : format(value)}{suffix}
    </span>
  );
};

export default function ProfileClientView({ 
  initialUser, 
  passkeys, 
  accounts, 
  sessions, 
  currentSessionToken 
}) {
  const [activeTab, setActiveTab] = useState("security");
  const [isMounted, setIsMounted] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) || "en";
    setSelectedLanguage(saved);

    // Google widget loads asynchronously; retry a few times to apply saved language.
    const attempts = [250, 600, 1100, 1800];
    attempts.forEach((delay) => {
      window.setTimeout(() => applyLanguage(saved), delay);
    });
  }, [isMounted]);

  const handleLanguageChange = (languageCode: string) => {
    setSelectedLanguage(languageCode);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, languageCode);
    applyLanguage(languageCode);
  };

  if (!isMounted) return null;

  const user = initialUser;
  const initials = user?.name?.split(' ').map(n => n[0]).join('') || "U";
  const isTwoFactorEnabled = user?.twoFactorEnabled ?? false;

  // Removed API Keys tab
  const TABS = [
    { id: "security", label: "Security", icon: Shield },
    { id: "profile", label: "Profile Info", icon: CreditCard },
    { id: "sessions", label: "Active Sessions", icon: Monitor },
    { id: "accounts", label: "Connected accounts", icon: Users },
    { id: "activity", label: "Activity Log", icon: Activity },
  ];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={stagger}
      className="max-w-6xl mx-auto space-y-8 pt-2 pb-20 px-4"
    >
      {/* ── Banner & Profile Identity ── */}
      <motion.div variants={maskedReveal} className="relative">
        <div className="mb-4 flex justify-end">
          <label className="inline-flex items-center gap-2 rounded-xl border border-[#1A2406]/10 bg-white/80 px-3 py-2 text-xs font-semibold text-[#1A2406]">
            <Globe className="h-4 w-4" />
            Language
            <select
              value={selectedLanguage}
              onChange={(event) => handleLanguageChange(event.target.value)}
              className="rounded-md border border-[#1A2406]/15 bg-white px-2 py-1 text-xs text-[#1A2406] outline-none"
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="aspect-[4/1] w-full bg-[#1A2406]/[0.02] rounded-[40px] overflow-hidden border border-[#1A2406]/[0.05] relative shadow-inner">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(217,242,79,0.05)_0%,transparent_100%)]" />
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <Globe className="w-24 h-24 text-[#1A2406]" />
          </div>
        </div>
        
        <div className="absolute left-10 bottom-0 translate-y-1/2 flex items-center gap-8">
          <div className="relative group">
            <div className="w-28 h-28 rounded-full border-[8px] border-[#FAFAF9] bg-white shadow-2xl overflow-hidden flex items-center justify-center transition-transform duration-500 hover:scale-105">
              {user?.image ? (
                <Image src={user.image} alt={user.name} width={112} height={112} className="object-cover w-full h-full" />
              ) : (
                <span className="text-3xl font-bold text-[#1A2406]/30 font-jakarta">{initials}</span>
              )}
              <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="absolute bottom-2 right-2 w-7 h-7 bg-[#16A34A] border-[5px] border-[#FAFAF9] rounded-full shadow-lg" />
          </div>

          <div className="mb-2 space-y-1 pb-2">
            <h1 className="font-jakarta text-3xl font-bold tracking-[-0.05em] text-[#1A2406]">
              {user?.name || "Member Node"}
            </h1>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-[#1A2406]/40 uppercase tracking-[0.2em]">Verified Operator</span>
              <div className="w-1 h-1 rounded-full bg-[#1A2406]/20" />
              <span className="text-[10px] font-bold text-[#1A2406]/40 uppercase tracking-[0.2em]">{user?.email}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Summary Stats (Smoother Cards) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-16">
        <motion.div 
          variants={maskedReveal}
          className="relative bg-white/60 backdrop-blur-2xl rounded-[32px] p-8 flex flex-col justify-between shadow-[0_8px_40px_rgba(0,0,0,0.02)] border border-white group"
        >
          <div className="flex items-center justify-between">
            <span className="font-jakarta text-[11px] font-bold text-[#1A2406]/40 uppercase tracking-[0.2em] leading-none">Identity Status</span>
            <div className="p-2.5 bg-[#1A2406]/[0.03] rounded-2xl border border-[#1A2406]/[0.05] text-[#1A2406]">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-6 flex items-end justify-between">
            <div>
              <p className="font-jakarta text-2xl font-bold tracking-[-0.04em] text-[#1A2406]">Full Clearance</p>
              <p className="text-[10px] font-sans text-[#16A34A] font-bold uppercase tracking-tight mt-1 flex items-center gap-1.5 leading-none">
                <CheckCircle2 className="w-3 h-3" /> System Verified
              </p>
            </div>
            <Zap className="w-5 h-5 text-[#D9F24F]/40" />
          </div>
        </motion.div>

        <motion.div 
          variants={maskedReveal}
          className="relative bg-[#1A2406] text-white rounded-[32px] p-8 flex flex-col justify-between shadow-[0_24px_48px_rgba(26,36,6,0.12)] overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-[#D9F24F]/5 via-transparent to-transparent opacity-40 pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <span className="font-jakarta text-[11px] font-bold uppercase tracking-[0.2em] text-white/40 leading-none">Security Integrity</span>
            <div className="p-2.5 bg-[#D9F24F] rounded-2xl shadow-[0_0_25px_rgba(217,242,79,0.35)]">
              <Lock className="w-4 h-4 text-[#1A2406]" />
            </div>
          </div>
          <div className="mt-6 flex items-end justify-between relative z-10">
            <div>
              <p className="font-jakarta text-22l font-bold tracking-[-0.04em] text-[#D9F24F]">
                {isTwoFactorEnabled ? "Encrypted State" : "Standard Security"}
              </p>
              <p className="text-[10px] font-sans text-white/30 font-bold uppercase tracking-tight mt-1 leading-none">
                {isTwoFactorEnabled ? "MFA Node active" : "Activation recommended"}
              </p>
            </div>
            <Shield className="w-5 h-5 text-white/10" />
          </div>
        </motion.div>
      </div>

      {/* ── Minimalist Tab Navigation (No blocky bg, smooth active state) ── */}
      <motion.div variants={maskedReveal} className="bg-white/40 backdrop-blur-sm border-b border-[#1A2406]/[0.05] flex items-center justify-center sticky top-0 z-40 px-1 pt-2">
        <div className="flex items-center gap-8 px-4">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative py-6 transition-all duration-300 group whitespace-nowrap`}
              >
                <div className="flex items-center gap-3">
                  <tab.icon className={`w-4 h-4 transition-colors ${isActive ? "text-[#1A2406]" : "text-[#1A2406]/20 group-hover:text-[#1A2406]/40"}`} />
                  <span className={`text-[12px] font-bold uppercase tracking-[0.18em] transition-colors font-jakarta ${isActive ? "text-[#1A2406]" : "text-[#1A2406]/30 group-hover:text-[#1A2406]/50"}`}>
                    {tab.label}
                  </span>
                </div>
                
                {isActive && (
                  <motion.div
                    layoutId="active-tab-underline"
                    className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#D9F24F] rounded-t-full shadow-[0_-4px_10px_rgba(217,242,79,0.4)]"
                  />
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ── Smooth Content Transition ── */}
      <div className="mt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, scale: 0.995, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.995, y: -10 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {activeTab === "security" && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                   {/* 2FA Card */}
                   <div className="bg-white/80 rounded-[40px] p-8 shadow-[0_10px_40px_rgba(0,0,0,0.02)] border border-white/60 flex flex-col justify-between">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="w-14 h-14 rounded-2xl bg-[#1A2406] text-[#D9F24F] flex items-center justify-center shadow-2xl shadow-[#1A2406]/10">
                          <ShieldCheck className="w-6 h-6" />
                        </div>
                        <span className={`text-[10px] font-bold px-4 py-2 rounded-full border ${isTwoFactorEnabled ? 'text-[#16A34A] bg-[#16A34A]/5 border-[#16A34A]/10' : 'text-[#CA8A04] bg-[#CA8A04]/5 border-[#CA8A04]/10'} tracking-widest uppercase`}>
                          {isTwoFactorEnabled ? 'PROTECTION ACTIVE' : 'PROTECTION PENDING'}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-jakarta text-2xl font-bold text-[#1A2406] tracking-[-0.04em]">Two-Factor Authenticator</h4>
                        <p className="text-sm text-[#1A2406]/50 leading-relaxed font-medium">Add an additional security layer to your escrow release cycle using TOTP methods.</p>
                      </div>
                    </div>
                    <div className="mt-8 pt-8 border-t border-[#1A2406]/[0.05]">
                       <TwoFactorAuth isEnabled={isTwoFactorEnabled} />
                    </div>
                  </div>

                  {/* Passkeys Card */}
                  <div className="bg-white/80 rounded-[40px] p-8 shadow-[0_10px_40px_rgba(0,0,0,0.02)] border border-white/60 flex flex-col justify-between">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="w-14 h-14 rounded-2xl bg-[#D9F24F] text-[#1A2406] flex items-center justify-center shadow-lg shadow-[#D9F24F]/10">
                          <Key className="w-6 h-6" />
                        </div>
                        <div className="flex items-center gap-1.5 bg-[#1A2406]/[0.03] px-3 py-1.5 rounded-full border border-[#1A2406]/[0.08]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1A2406]" />
                          <span className="text-[10px] font-bold text-[#1A2406] tracking-widest uppercase">{passkeys.length} Registered</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-jakarta text-2xl font-bold text-[#1A2406] tracking-[-0.04em]">Biometric Passkeys</h4>
                        <p className="text-sm text-[#1A2406]/50 leading-relaxed font-medium">The most advanced way to protect your account. Faster and safer than passwords.</p>
                      </div>
                    </div>
                    <div className="mt-8 pt-8 border-t border-[#1A2406]/[0.05]">
                      <PasskeyManagement passkeys={passkeys} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "profile" && (
              <div className="max-w-3xl mx-auto space-y-8">
                <div className="bg-white/60 backdrop-blur-xl rounded-[40px] p-10 shadow-[0_10px_40px_rgba(0,0,0,0.02)] border border-white/60">
                  <div className="flex items-center gap-4 mb-10">
                    <div className="p-3 bg-[#1A2406]/[0.04] rounded-2xl">
                       <User className="w-5 h-5 text-[#1A2406]" />
                    </div>
                    <h3 className="font-jakarta text-2xl font-bold tracking-tight text-[#1A2406]">Identity Node Settings</h3>
                  </div>
                  <ProfileUpdateTab user={user} />
                </div>
              </div>
            )}

            {activeTab === "sessions" && (
              <div className="max-w-4xl mx-auto">
                <div className="bg-white/60 backdrop-blur-xl rounded-[40px] p-10 shadow-[0_10px_40px_rgba(0,0,0,0.02)] border border-white/60">
                 <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-[#1A2406]/[0.04] rounded-2xl">
                         <Monitor className="w-5 h-5 text-[#1A2406]" />
                      </div>
                      <h3 className="font-jakarta text-2xl font-bold tracking-tight text-[#1A2406]">Verified Terminal Logs</h3>
                    </div>
                 </div>
                 <SessionManagement sessions={sessions} currentSessionToken={currentSessionToken} />
                </div>
              </div>
            )}

            {activeTab === "accounts" && (
              <div className="max-w-3xl mx-auto">
                <div className="bg-white/60 backdrop-blur-xl rounded-[40px] p-10 shadow-[0_10px_40px_rgba(0,0,0,0.02)] border border-white/60">
                 <div className="flex items-center gap-4 mb-10">
                    <div className="p-3 bg-[#1A2406]/[0.04] rounded-2xl">
                       <Users className="w-5 h-5 text-[#1A2406]" />
                    </div>
                    <h3 className="font-jakarta text-2xl font-bold tracking-tight text-[#1A2406]">Linked Asset Providers</h3>
                 </div>
                 <AccountLinking 
                   currentAccounts={accounts.filter(a => a.providerId !== 'credential')} 
                 />
                </div>
              </div>
            )}

            {activeTab === "activity" && <ActivityLogView />}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function ActivityLogView() {
  const activities = [
    { title: "Protocol Session Authenticated", detail: "Terminal MB-M3-01 in Bangalore, IN", time: "18:24 PM", icon: Lock },
    { title: "Escrow Contract Initialized", detail: "ID_ESC_991823 for Node Protocol", time: "12:05 PM", icon: FileText },
    { title: "Security Key Rotated", detail: "Passkey added to Private Cloud", time: "09:44 AM", icon: Key },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white/80 rounded-[40px] p-10 shadow-[0_10px_40px_rgba(0,0,0,0.02)] border border-white/60">
        <div className="space-y-2">
          {activities.map((act, i) => (
            <div key={i} className="group flex items-center justify-between py-6 border-b border-[#1A2406]/[0.03] last:border-0 hover:bg-[#1A2406]/[0.01] px-6 -mx-6 rounded-3xl transition-all cursor-default">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 rounded-2xl bg-white border border-[#1A2406]/[0.05] shadow-sm flex items-center justify-center text-[#1A2406]/20 group-hover:text-[#1A2406] group-hover:bg-[#D9F24F]/10 transition-all">
                  <act.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[17px] font-bold text-[#1A2406] font-jakarta tracking-tight">{act.title}</p>
                  <p className="text-[11px] font-bold text-[#1A2406]/30 uppercase tracking-widest mt-0.5">{act.detail}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-[11px] font-bold text-[#1A2406]/20">{act.time}</span>
                <ChevronRight className="w-4 h-4 text-[#1A2406]/10 opacity-0 group-hover:opacity-100 transition-all" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
