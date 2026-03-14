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
  Bell,
  CheckCheck,
} from 'lucide-react'
import { ConnectButton, useActiveAccount, useActiveWallet, useAdminWallet } from "thirdweb/react"
import { thirdwebClient } from "@/lib/thirdweb-client"
import { sepolia } from "thirdweb/chains"
import { AICoPilotPopup } from '@/components/AICoPilotPopup'
import { formatPccBaseUnits, getPccBalance } from '@/lib/paycrow-coin'

const API_BASE_URL = '/api'
const API_SERVER_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:5000'

type AppNotification = {
  id: string
  userId: string
  title: string
  message: string
  type: string
  entityType: string | null
  entityId: string | null
  isRead: boolean
  createdAt: string
  updatedAt: string
}

// ─── NAV ITEMS ───
const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/agreements', label: 'Agreements', icon: FileText },
  { href: '/buy-pcc', label: 'Buy PCC', icon: Coins },
  { href: '/tickets', label: 'Tickets', icon: ShieldAlert },
]

const NotificationCenter = ({ userId }: { userId: string }) => {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const loadNotifications = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `${API_SERVER_BASE_URL}/notifications?userId=${encodeURIComponent(userId)}&limit=25`,
        { cache: 'no-store' },
      )

      if (!response.ok) {
        return
      }

      const data = await response.json()
      setNotifications(Array.isArray(data.notifications) ? data.notifications : [])
      setUnreadCount(Number(data.unreadCount || 0))
    } catch (error) {
      console.error('Failed to load notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!userId) {
      return
    }

    loadNotifications()
    const interval = setInterval(loadNotifications, 30000)

    return () => clearInterval(interval)
  }, [userId])

  const markOneRead = async (notificationId: string) => {
    try {
      await fetch(`${API_SERVER_BASE_URL}/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      setNotifications((prev) =>
        prev.map((item) => (item.id === notificationId ? { ...item, isRead: true } : item)),
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  const markAllRead = async () => {
    try {
      await fetch(`${API_SERVER_BASE_URL}/notifications/read-all`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
    }
  }

  return (
    <div className="relative z-30">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-xl border border-[#d9d0bf] bg-white p-2.5 text-[#1A2406] shadow-sm"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#8f1f2f] px-1.5 py-0.5 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-85 rounded-2xl border border-[#d9d0bf] bg-white p-3 shadow-[0_20px_50px_rgba(13,17,4,0.15)]">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-sm font-bold text-[#122016]">Notifications</p>
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-1 rounded-md border border-[#d9d0bf] px-2 py-1 text-xs text-[#1f6a42]"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          </div>

          <div className="max-h-90 space-y-2 overflow-y-auto pr-1">
            {loading ? <p className="p-3 text-xs text-[#526157]">Loading notifications...</p> : null}

            {!loading && notifications.length === 0 ? (
              <p className="p-3 text-xs text-[#526157]">No notifications yet.</p>
            ) : null}

            {notifications.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => markOneRead(item.id)}
                className={`w-full rounded-xl border p-3 text-left ${
                  item.isRead ? 'border-[#ece6d9] bg-[#fcfbf8]' : 'border-[#d9d0bf] bg-[#f9fdf3]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-[#122016]">{item.title}</p>
                  {!item.isRead ? <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#1f6a42]" /> : null}
                </div>
                <p className="mt-1 text-xs text-[#526157]">{item.message}</p>
                <p className="mt-2 text-[10px] uppercase tracking-wide text-[#8b968f]">
                  {new Date(item.createdAt).toLocaleString('en-IN')}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

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
        {session?.user?.id ? (
          <div className="pointer-events-none absolute right-6 top-6 hidden md:block">
            <div className="pointer-events-auto">
              <NotificationCenter userId={session.user.id} />
            </div>
          </div>
        ) : null}

        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between px-6 py-4 bg-[#1A2406] text-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#D9F24F] flex items-center justify-center">
              <Activity className="w-4 h-4 text-[#1A2406]" />
            </div>
            <span className="font-jakarta font-bold text-lg tracking-[-0.04em]">Nexus</span>
          </div>
          <div className="flex items-center gap-2">
            {session?.user?.id ? <NotificationCenter userId={session.user.id} /> : null}
            <button className="p-2 bg-white/5 rounded-xl">
              <Menu className="w-6 h-6" />
            </button>
          </div>
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
