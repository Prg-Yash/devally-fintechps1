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
  LogOut,
  Activity,
  ChevronLeft,
  Menu,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/profile',   label: 'Profile',   icon: User },
  { href: '/agreements',label: 'Agreements',icon: FileText },
  { href: '/tickets',   label: 'Tickets',   icon: ShieldAlert },
]

const Sidebar = ({ collapsed, setCollapsed }: { collapsed: boolean; setCollapsed: (v: boolean) => void }) => {
  const pathname = usePathname()

  const handleSignOut = async () => {
    await authClient.signOut()
    toast.success('Signed out successfully')
    window.location.href = '/'
  }

  return (
    <div className="hidden md:flex flex-col p-4 shrink-0">
      <motion.aside
        animate={{ width: collapsed ? 72 : 256 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex flex-col h-full bg-[#1A2406] text-white overflow-hidden rounded-[32px] shadow-2xl"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-8 border-b border-white/10 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-[#D9F24F] flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-[#1A2406]" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                key="logo-text"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                className="font-jakarta font-bold text-lg tracking-tight whitespace-nowrap"
              >
                Nexus Escrow
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-8 px-3 space-y-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link key={href} href={href}>
                <div
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group cursor-pointer
                    ${active
                      ? 'bg-[#D9F24F] text-[#1A2406]'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-[#1A2406]' : 'text-white/70 group-hover:text-white'}`} />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        key={`label-${href}`}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        transition={{ duration: 0.18 }}
                        className="text-sm font-inter font-medium whitespace-nowrap"
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

        {/* Sign out */}
        <div className="px-3 py-6 border-t border-white/10">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-2xl text-white/60 hover:bg-white/10 hover:text-white transition-all duration-200 group"
          >
            <LogOut className="w-5 h-5 shrink-0 group-hover:text-red-400 transition-colors" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  key="signout-label"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.18 }}
                  className="text-sm font-inter font-medium whitespace-nowrap"
                >
                  Sign Out
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-[#D9F24F] text-[#1A2406] flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-10"
        >
          <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.3 }}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </motion.div>
        </button>
      </motion.aside>
    </div>
  )
}

const MobileNav = () => {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const handleSignOut = async () => {
    await authClient.signOut()
    toast.success('Signed out successfully')
    window.location.href = '/'
  }

  return (
    <>
      {/* Top bar for mobile */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#1A2406] text-white">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#D9F24F] flex items-center justify-center">
            <Activity className="w-4 h-4 text-[#1A2406]" />
          </div>
          <span className="font-jakarta font-bold text-base">Nexus Escrow</span>
        </div>
        <button onClick={() => setOpen(true)} className="p-1">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 z-40 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="fixed left-0 top-0 bottom-0 w-64 bg-[#1A2406] z-50 flex flex-col md:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center gap-3 px-4 py-6 border-b border-white/10">
                <div className="w-9 h-9 rounded-xl bg-[#D9F24F] flex items-center justify-center">
                  <Activity className="w-5 h-5 text-[#1A2406]" />
                </div>
                <span className="font-jakarta font-bold text-lg">Nexus Escrow</span>
              </div>
              <nav className="flex-1 py-6 px-2 space-y-1">
                {navItems.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href || pathname.startsWith(href + '/')
                  return (
                    <Link key={href} href={href} onClick={() => setOpen(false)}>
                      <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${active ? 'bg-[#D9F24F] text-[#1A2406]' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
                        <Icon className="w-5 h-5" />
                        <span className="text-sm font-inter font-medium">{label}</span>
                      </div>
                    </Link>
                  )
                })}
              </nav>
              <div className="px-2 py-4 border-t border-white/10">
                <button onClick={handleSignOut} className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-white/60 hover:bg-white/10 hover:text-white">
                  <LogOut className="w-5 h-5" />
                  <span className="text-sm font-inter font-medium">Sign Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

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
    <div className="flex min-h-screen bg-[#F5F5F0] font-inter">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <MobileNav />
        <main className="flex-1 p-6 md:p-8 lg:p-10 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout
