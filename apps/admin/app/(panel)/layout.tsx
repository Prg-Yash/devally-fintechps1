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

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-[#FAFAF9] font-sans selection:bg-[#e9edd7] selection:text-[#1A2406]">
      {/* Dynamic Glow Background */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(243,244,241,1)_0%,rgba(250,250,249,1)_100%)] pointer-events-none" />

      {/* Sidebar */}
      <div className="hidden md:block sticky top-6 h-[calc(100vh-3rem)] ml-6 shrink-0 z-50">
        <aside className="relative flex h-full w-70 flex-col overflow-hidden rounded-[20px] border border-[#d9dfcf] bg-white text-[#1A2406] shadow-[0_18px_40px_-16px_rgba(26,36,6,0.28)]">
          {/* Logo Section */}
          <div className="flex items-center gap-4 border-b border-[#e6ecdf] px-6 py-10">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d9dfcf] bg-[#f4f7ea]">
              <Activity className="h-5 w-5 text-[#1A2406]" />
            </div>
            <span className="font-bold text-xl tracking-[-0.04em]">
              PayCrow Admin
            </span>
          </div>

          <nav className="flex-1 py-10 px-2 space-y-3">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href || pathname.startsWith(href + "/");
              return (
                <Link key={href} href={href}>
                  <div
                    className={`relative flex items-center gap-4 px-4 py-4 rounded-xl transition-all duration-300 group cursor-pointer
                      ${
                        active
                          ? "bg-[#f2f6e6] text-[#1A2406] shadow-[inset_0_0_0_1px_rgba(26,36,6,0.08)]"
                          : "text-[#1A2406]/55 hover:bg-[#f6f8ef] hover:text-[#1A2406]"
                      }`}
                  >
                    {active && (
                      <motion.div
                        layoutId="sidebar-active-pill"
                        className="absolute bottom-3 left-1 top-3 w-1 rounded-full bg-[#7e9156]"
                      />
                    )}
                    <div className="w-10 flex justify-center shrink-0">
                      <Icon
                        className={`h-5 w-5 transition-colors duration-300 ${active ? "text-[#1A2406]" : "text-[#1A2406]/45 group-hover:text-[#1A2406]"}`}
                      />
                    </div>
                    <span
                      className={`text-sm font-medium whitespace-nowrap tracking-[-0.02em] ${active ? "opacity-100" : "opacity-80"}`}
                    >
                      {label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="flex flex-col items-center border-t border-[#e6ecdf] px-4 py-8">
            <form action={logoutAdmin} className="w-full">
              <button
                type="submit"
                className="group flex w-full items-center gap-4 rounded-xl px-4 py-4 text-[#1A2406]/55 transition-all duration-300 hover:bg-[#f7efe9] hover:text-[#1A2406]"
              >
                <div className="w-10 flex justify-center shrink-0">
                  <LogOut className="h-5 w-5 transition-colors duration-300 group-hover:text-red-500" />
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
        <div className="md:hidden flex items-center justify-between border-b border-[#e6ecdf] bg-white px-6 py-4 text-[#1A2406]">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d9dfcf] bg-[#f4f7ea]">
              <Activity className="w-4 h-4 text-[#1A2406]" />
            </div>
            <span className="font-bold text-lg tracking-[-0.04em]">
              PayCrow Admin
            </span>
          </div>
        </div>

        <main className="flex-1 p-6 md:p-10 lg:p-12 overflow-y-auto scrollbar-none scroll-smooth">
          {children}
        </main>
      </div>
    </div>
  );
}
