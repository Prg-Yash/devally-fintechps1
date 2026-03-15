"use client"

import { authClient } from '@/lib/auth-client'
import { useRouter, usePathname } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import Loading from '@/components/Loading'
import { AnimatePresence, motion } from 'framer-motion'


// Fintech / escrow themed free video from Pexels (CC0)
const FINTECH_VIDEO =
  '/ai.mp4'

const testimonials = [
  {
    name: 'Sarah Chen',
    handle: '@sarahdigital',
    img: 'https://i.pravatar.cc/150?img=1',
    quote:
      '"Amazing platform! The user experience is seamless and the features are exactly what I needed."',
    delay: 0.3,
  },
  {
    name: 'Marcus Johnson',
    handle: '@marcustech',
    img: 'https://i.pravatar.cc/150?img=14',
    quote:
      '"This service has transformed how I work. Clean design, powerful features, and excellent support."',
    delay: 0.45,
  },
  {
    name: 'David Martinez',
    handle: '@davidcreates',
    img: 'https://i.pravatar.cc/150?img=11',
    quote:
      '"I\'ve tried many platforms, but this one stands out. Intuitive, reliable, and genuinely helpful for productivity."',
    delay: 0.6,
  },
]

const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  const { data: session, isPending } = authClient.useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    if (!isPending) {
      if (session != null) {
        if (pathname === '/banned') {
          setIsChecking(false)
        } else {
          router.push('/')
        }
      } else {
        setIsChecking(false)
      }
    }
  }, [session, isPending, router, pathname])

  if (isPending || isChecking) {
    return <Loading />
  }

  return (
    <div className="min-h-screen flex bg-gray-100 text-gray-900">
      {/* ── Left Pane ── */}
      <motion.div
        className="w-full md:w-1/2 flex flex-col items-center justify-center p-8 lg:p-14 relative z-10 overflow-y-auto min-h-screen bg-white"
        initial={{ opacity: 0, x: -28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="w-full max-w-[420px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── Right Pane ── rounded corners, margin so it floats */}
      <motion.div
        className="hidden md:block md:w-1/2 relative overflow-hidden rounded-3xl m-4 shadow-2xl"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Looping fintech video background */}
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src={FINTECH_VIDEO}
          autoPlay
          muted
          loop
          playsInline
        />

        {/* Gradient overlay — darkens bottom for legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />

        {/* Optional purple-tinted colour wash for brand feel */}
        <div className="absolute inset-0 bg-violet-950/20 mix-blend-multiply" />

        {/* Brand badge — top left */}
        <motion.div
          className="absolute top-8 left-8 flex items-center gap-2"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="text-white font-semibold text-sm tracking-tight font-jakarta">Devally Escrow</span>
        </motion.div>

        {/* Hero copy — centre of pane */}
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center px-10 text-center pointer-events-none"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-white/50 text-xs uppercase tracking-[0.18em] font-inter mb-3">
            Trusted · Transparent · Instant
          </p>
          <h2 className="text-white text-3xl lg:text-4xl font-jakarta font-semibold tracking-[-0.03em] leading-tight max-w-xs">
            Secure escrow for the modern economy
          </h2>
        </motion.div>

        {/* ── Testimonials ── true glassmorphism */}
        <div className="absolute bottom-8 left-0 right-0 px-6 flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
          {testimonials.map((t) => (
            <motion.div
              key={t.handle}
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: t.delay, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -4, transition: { duration: 0.25 } }}
              className="snap-center flex-shrink-0 w-[260px]"
            >
              {/* Glass card */}
              <div
                className="rounded-2xl p-4 border border-white/20"
                style={{
                  background: 'rgba(255,255,255,0.10)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.2)',
                }}
              >
                {/* Stars */}
                <div className="flex gap-0.5 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-3 h-3 text-amber-400 fill-amber-400" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                    </svg>
                  ))}
                </div>

                <p className="text-white/90 text-xs leading-relaxed mb-4 font-inter">
                  {t.quote}
                </p>

                <div className="flex items-center gap-2.5">
                  <img
                    src={t.img}
                    alt={t.name}
                    className="w-8 h-8 rounded-full object-cover border border-white/30 flex-shrink-0"
                  />
                  <div>
                    <p className="text-white text-xs font-semibold leading-tight font-jakarta">{t.name}</p>
                    <p className="text-white/50 text-[10px] font-inter">{t.handle}</p>
                  </div>
                </div>
              </div>            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

export default AuthLayout
