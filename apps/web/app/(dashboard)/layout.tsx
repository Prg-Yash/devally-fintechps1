"use client"

import { authClient } from '@/lib/auth-client'
import { useRouter, usePathname } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import Loading from '@/components/Loading'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  User,
  FileText,
  ShieldAlert,
  Coins,
  LogOut,
  Activity,
  ChevronLeft,
  Menu,
} from 'lucide-react'
import { ConnectButton, useActiveAccount, useActiveWallet, useAdminWallet } from "thirdweb/react"
import { thirdwebClient } from "@/lib/thirdweb-client"
import { sepolia } from "thirdweb/chains"
import { AICoPilotPopup } from '@/components/AICoPilotPopup'
import { formatPccBaseUnits, getPccBalance } from '@/lib/paycrow-coin'

const API_BASE_URL = '/api'

// ─── NAV ITEMS ───
const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/agreements', label: 'Agreements', icon: FileText },
  { href: '/buy-pcc', label: 'Buy PCC', icon: Coins },
  { href: '/tickets', label: 'Tickets', icon: ShieldAlert },
]

// ─── SIDEBAR COMPONENT (ARCHITECTURALLY ISOLATED) ───
const Sidebar = ({ collapsed, setCollapsed }: { collapsed: boolean; setCollapsed: (v: boolean) => void }) => {
  const pathname = usePathname()
  const activeAccount = useActiveAccount()
  const activeWallet = useActiveWallet()
  const adminWallet = useAdminWallet()
  const [pccBalance, setPccBalance] = useState<string>('0')
  const [isBalanceLoading, setIsBalanceLoading] = useState(false)
  const [pccContractAddress, setPccContractAddress] = useState<string | undefined>(undefined)

  const adminAccount = activeWallet?.getAdminAccount?.() || adminWallet?.getAccount?.()
  const walletAddressForBalance = adminAccount?.address || activeAccount?.address

  useEffect(() => {
    const fetchPccConfig = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/razorpay/pcc-config`)
        if (!response.ok) return
        const data = await response.json()
        if (data?.contractAddress) {
          setPccContractAddress(data.contractAddress)
        }
      } catch (error) {
        console.error('Failed to fetch PCC config:', error)
      }
    }

    fetchPccConfig()
  }, [])

  useEffect(() => {
    const walletAddress = walletAddressForBalance
    if (!walletAddress) {
      setPccBalance('0')
      return
    }

    const fetchBalance = async () => {
      try {
        setIsBalanceLoading(true)
        const balance = await getPccBalance(thirdwebClient, walletAddress, pccContractAddress)
        setPccBalance(formatPccBaseUnits(balance))
      } catch (error) {
        console.error('Failed to fetch PCC balance:', error)
      } finally {
        setIsBalanceLoading(false)
      }
    }

    fetchBalance()

    const interval = setInterval(fetchBalance, 15000)

    const onPurchaseCompleted = () => {
      fetchBalance()
    }

    window.addEventListener('pcc:purchase-completed', onPurchaseCompleted)
    return () => {
      clearInterval(interval)
      window.removeEventListener('pcc:purchase-completed', onPurchaseCompleted)
    }
  }, [walletAddressForBalance, pccContractAddress])

  const handleSignOut = async () => {
    await authClient.signOut()
    toast.success('Signed out successfully')
    window.location.href = '/'
  }

  return (
    <div className="hidden md:block sticky top-6 h-[calc(100vh-3rem)] ml-6 shrink-0 z-50">
      <motion.aside
        animate={{ width: collapsed ? 80 : 280 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex flex-col h-full bg-[#1A2406] text-white overflow-hidden rounded-[20px] shadow-[0_20px_50px_rgba(13,17,4,0.15)] border border-white/5"
      >
        {/* Logo Section */}
        <div className="flex items-center gap-4 px-6 py-10 border-b border-white/5 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-[#D9F24F] flex items-center justify-center shrink-0 shadow-[0_8px_20px_rgba(217,242,79,0.25)]">
            <Activity className="w-5 h-5 text-[#1A2406]" />
          </div>
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.span
                key="logo-text"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.3 }}
                className="font-jakarta font-bold text-xl tracking-[-0.04em] whitespace-nowrap"
              >
                Nexus Escrow
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 py-10 px-2 space-y-3">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link key={href} href={href}>
                <div
                  className={`relative flex items-center gap-4 px-4 py-4 rounded-xl transition-all duration-300 group cursor-pointer
                    ${active
                      ? 'bg-white/5 text-white shadow-[0_0_20px_rgba(255,255,255,0.03)]'
                      : 'text-white/40 hover:bg-white/5 hover:text-white'
                    }`}
                >
                  {/* Solv Style Active Indicator */}
                  {active && (
                    <motion.div
                      layoutId="sidebar-active-pill"
                      className="absolute left-1 top-3 bottom-3 w-1 bg-[#D9F24F] rounded-full shadow-[0_0_15px_rgba(217,242,79,0.6)]"
                    />
                  )}

                  <div className="w-10 flex justify-center shrink-0">
                    <Icon className={`w-5 h-5 transition-colors duration-300 ${active ? 'text-[#D9F24F]' : 'text-white/40 group-hover:text-white'}`} />
                  </div>

                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        key={`label-${href}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.2 }}
                        className={`text-sm font-medium whitespace-nowrap font-jakarta tracking-[-0.02em] ${active ? 'opacity-100' : 'opacity-80'}`}
                      >
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </Link>
            )
          })}
        </nav>

        <div className="px-4 py-8 border-t border-white/5 flex flex-col items-center">
          <div className="w-full mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>PCC Balance</span>
              <Coins className="w-3.5 h-3.5 text-[#D9F24F]" />
            </div>
            <p className="mt-1.5 text-lg font-bold text-white">
              {isBalanceLoading ? 'Loading…' : `${pccBalance} PCC`}
            </p>
            {!walletAddressForBalance && (
              <p className="text-[11px] text-white/40 mt-1">Connect wallet to fetch balance</p>
            )}
          </div>

          <div className="w-full transition-all duration-500 ease-[0.22,1,0.36,1]">
            <ConnectButton
              client={thirdwebClient}
              chain={sepolia}
              accountAbstraction={{ chain: sepolia, sponsorGas: true }}
              connectButton={{
                label: collapsed ? "..." : "Connect Node",
                className: "nexus-connect-sidebar !bg-[#D9F24F] !text-[#1A2406] !font-bold !rounded-2xl !w-full !h-14 !text-sm !shadow-xl !shadow-[#D9F24F]/10 !transition-all hover:!scale-[1.02] active:!scale-95"
              }}
              detailsButton={{
                className: "nexus-details-sidebar !bg-white/5 !text-white !font-bold !rounded-2xl !w-full !h-14 !border !border-white/10 !transition-all hover:!bg-white/10 hover:!border-white/20 active:!scale-95"
              }}
            />
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-4 px-4 py-4 w-full rounded-xl text-white/30 hover:bg-white/5 hover:text-white transition-all duration-300 group"
          >
            <div className="w-10 flex justify-center shrink-0">
              <LogOut className="w-5 h-5 group-hover:text-red-400 transition-colors duration-300" />
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  key="signout-label"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm font-medium whitespace-nowrap font-jakarta tracking-[-0.02em]"
                >
                  Sign Out
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-24 w-7 h-7 rounded-full bg-[#1A2406] text-[#D9F24F] border border-white/10 flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all z-10"
        >
          <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.4, ease: "backOut" }}>
            <ChevronLeft className="w-4 h-4" />
          </motion.div>
        </button>
      </motion.aside>
    </div>
  )
}

// ─── DASHBOARD LAYOUT WRAPPER ───
const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { data: session, isPending } = authClient.useSession()
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [banRedirecting, setBanRedirecting] = useState(false)

  useEffect(() => {
    let cancelled = false

    const validateAccess = async () => {
      if (isPending) {
        return
      }

      if (session == null) {
        if (!banRedirecting) {
          toast.error('You must be logged in to access the dashboard.')
          router.push('/login')
        }
        if (!cancelled) {
          setIsChecking(false)
        }
        return
      }

      try {
        const response = await fetch('/api/user/access-status', { cache: 'no-store' })
        const data = await response.json()

        if (response.ok && data?.isBanned) {
          setBanRedirecting(true)
          toast.error('Your account has been banned. Please contact admin support.')
          await authClient.signOut()
          window.location.href = '/banned'
          return
        }
      } catch (error) {
        console.error('Failed to validate account status:', error)
      }

      if (!cancelled) {
        setIsChecking(false)
      }
    }

    validateAccess()

    return () => {
      cancelled = true
    }
  }, [session, isPending, router, banRedirecting])

  if (isPending || isChecking) return <Loading />

  return (
    <div className="flex min-h-screen bg-[#FAFAF9] font-sans selection:bg-[#D9F24F] selection:text-[#1A2406]">
      {/* Dynamic Glow Background */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(243,244,241,1)_0%,rgba(250,250,249,1)_100%)] pointer-events-none" />

      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      <div className="relative flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between px-6 py-4 bg-[#1A2406] text-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#D9F24F] flex items-center justify-center">
              <Activity className="w-4 h-4 text-[#1A2406]" />
            </div>
            <span className="font-jakarta font-bold text-lg tracking-[-0.04em]">Nexus</span>
          </div>
          <button className="p-2 bg-white/5 rounded-xl">
            <Menu className="w-6 h-6" />
          </button>
        </div>

        <main className="flex-1 p-6 md:p-10 lg:p-12 overflow-y-auto scrollbar-none scroll-smooth">
          {children}
        </main>

        <AICoPilotPopup />
      </div>
    </div>
  )
}

export default DashboardLayout
