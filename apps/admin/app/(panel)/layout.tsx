"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAdmin } from "../actions";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  FileText,
  ShieldAlert,
  CreditCard,
  LogOut,
  Activity,
} from "lucide-react";

const navItems = [
  { href: "/analytics", label: "Analytics", icon: LayoutDashboard },
  { href: "/users", label: "Users", icon: Users },
  { href: "/agreements", label: "Agreements", icon: FileText },
  { href: "/tickets", label: "Tickets", icon: ShieldAlert },
  { href: "/purchases", label: "Purchases", icon: CreditCard },
];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-[#FAFAF9] font-sans selection:bg-[#D9F24F] selection:text-[#1A2406]">
      {/* Dynamic Glow Background */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(243,244,241,1)_0%,rgba(250,250,249,1)_100%)] pointer-events-none" />

      {/* Sidebar */}
      <div className="hidden md:block sticky top-6 h-[calc(100vh-3rem)] ml-6 shrink-0 z-50">
        <aside className="relative flex flex-col h-full w-[280px] bg-[#1A2406] text-white overflow-hidden rounded-[20px] shadow-[0_20px_50px_rgba(13,17,4,0.15)] border border-white/5">
          {/* Logo Section */}
          <div className="flex items-center gap-4 px-6 py-10 border-b border-white/5">
            <div className="w-10 h-10 rounded-xl bg-[#D9F24F] flex items-center justify-center shrink-0 shadow-[0_8px_20px_rgba(217,242,79,0.25)]">
               <Activity className="w-5 h-5 text-[#1A2406]" />
            </div>
            <span className="font-bold text-xl tracking-[-0.04em]">Nexus Admin</span>
          </div>

          <nav className="flex-1 py-10 px-2 space-y-3">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link key={href} href={href}>
                  <div
                    className={`relative flex items-center gap-4 px-4 py-4 rounded-xl transition-all duration-300 group cursor-pointer
                      ${active
                        ? "bg-white/5 text-white shadow-[0_0_20px_rgba(255,255,255,0.03)]"
                        : "text-white/40 hover:bg-white/5 hover:text-white"
                      }`}
                  >
                    {active && (
                      <motion.div 
                        layoutId="sidebar-active-pill"
                        className="absolute left-1 top-3 bottom-3 w-1 bg-[#D9F24F] rounded-full shadow-[0_0_15px_rgba(217,242,79,0.6)]"
                      />
                    )}
                    <div className="w-10 flex justify-center shrink-0">
                      <Icon className={`w-5 h-5 transition-colors duration-300 ${active ? "text-[#D9F24F]" : "text-white/40 group-hover:text-white"}`} />
                    </div>
                    <span className={`text-sm font-medium whitespace-nowrap tracking-[-0.02em] ${active ? "opacity-100" : "opacity-80"}`}>
                      {label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="px-4 py-8 border-t border-white/5 flex flex-col items-center">
            <form action={logoutAdmin} className="w-full">
              <button
                type="submit"
                className="flex items-center gap-4 px-4 py-4 w-full rounded-xl text-white/40 hover:bg-white/5 hover:text-white transition-all duration-300 group"
              >
                <div className="w-10 flex justify-center shrink-0">
                   <LogOut className="w-5 h-5 group-hover:text-red-400 transition-colors duration-300" />
                </div>
                <span className="text-sm font-medium whitespace-nowrap tracking-[-0.02em]">
                  Sign Out
                </span>
              </button>
            </form>
          </div>
        </aside>
      </div>

      {/* Main Content Area */}
      <div className="relative flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between px-6 py-4 bg-[#1A2406] text-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#D9F24F] flex items-center justify-center">
              <Activity className="w-4 h-4 text-[#1A2406]" />
            </div>
            <span className="font-bold text-lg tracking-[-0.04em]">Nexus Admin</span>
          </div>
        </div>

        <main className="flex-1 p-6 md:p-10 lg:p-12 overflow-y-auto scrollbar-none scroll-smooth">
          {children}
        </main>
      </div>
    </div>
  );
}
