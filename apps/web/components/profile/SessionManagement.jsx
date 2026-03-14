"use client"

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { Monitor, Smartphone, Trash2, Shield, Globe, Clock, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React from 'react'
import { UAParser } from 'ua-parser-js'

const SessionManagement = ({ sessions, currentSessionToken }) => {
  const router = useRouter()
  const otherSessions = sessions.filter(s => s.token !== currentSessionToken)
  const currentSession = sessions.find(s => s.token === currentSessionToken)

  function revokeOtherSessions() {
    const confirm = window.confirm(
      "Are you sure you want to revoke all other sessions? This action cannot be undone."
    )
    if (!confirm) return
    return authClient.revokeOtherSessions(undefined, {
      onSuccess: () => {
        router.refresh()
      },
    })
  }

  return (
    <div className="space-y-10">
      {/* Current Session */}
      <div className="space-y-4">
        <h4 className="text-[10px] font-bold text-[#1A2406]/30 uppercase tracking-[0.2em] ml-1">Current Active Link</h4>
        {currentSessionToken && (
          <SessionCard session={currentSession} isCurrentSession />
        )}
      </div>

      {/* Other Sessions */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-[10px] font-bold text-[#1A2406]/30 uppercase tracking-[0.2em]">Other Authenticated Terminals</h4>
          {otherSessions.length > 0 && (
            <button
              onClick={revokeOtherSessions}
              className="text-[10px] font-bold text-red-500 uppercase tracking-widest hover:underline transition-all"
            >
              Terminate All Others
            </button>
          )}
        </div>

        {otherSessions.length === 0 ? (
          <div className="bg-[#1A2406]/[0.02] border border-[#1A2406]/[0.05] rounded-[32px] p-12 text-center border-dashed">
            <Shield className="w-10 h-10 text-[#1A2406]/10 mx-auto mb-4" />
            <p className="text-xs font-bold text-[#1A2406]/30 uppercase tracking-widest">No secondary nodes detected</p>
          </div>
        ) : (
          <div className="space-y-3">
            {otherSessions.map(session => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default SessionManagement

function SessionCard({
  session,
  isCurrentSession = false,
}) {
  const router = useRouter()
  const userAgentInfo = session.userAgent ? UAParser(session.userAgent) : null

  function getBrowserInformation() {
    if (userAgentInfo == null) return "Unknown Terminal"
    if (!userAgentInfo.browser.name && !userAgentInfo.os.name) return "Generic Node"
    return `${userAgentInfo.browser.name || 'Unknown Browser'}, ${userAgentInfo.os.name || 'Unknown OS'}`
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(date))
  }

  function revokeSession() {
    const confirm = window.confirm("Terminate this authenticated session?");
    if (!confirm) return
    return authClient.revokeSession(
      { token: session.token },
      { onSuccess: () => router.refresh() }
    )
  }

  return (
    <div className={`bg-white/80 border ${isCurrentSession ? 'border-[#1A2406]' : 'border-[#1A2406]/[0.05]'} p-6 rounded-[28px] flex items-center justify-between shadow-sm group transition-all`}>
      <div className="flex items-center gap-5">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isCurrentSession ? 'bg-[#1A2406] text-[#D9F24F]' : 'bg-[#1A2406]/[0.03] text-[#1A2406]/30 group-hover:bg-[#1A2406] group-hover:text-white'}`}>
          {userAgentInfo?.device.type === "mobile" ? (
            <Smartphone className="w-6 h-6" />
          ) : (
            <Monitor className="w-6 h-6" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h5 className="font-jakarta font-bold text-[#1A2406] text-lg tracking-tight">{getBrowserInformation()}</h5>
            {isCurrentSession && (
               <span className="bg-[#D9F24F] text-[#1A2406] text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-widest border border-[#1A2406]/10">Active Now</span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1.5 opacity-40">
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase">
              <Clock className="w-3 h-3" /> Created: {formatDate(session.createdAt)}
            </div>
            <div className="w-1 h-1 rounded-full bg-[#1A2406]" />
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase">
              <Globe className="w-3 h-3" /> ID: {session.token?.slice(-8) || '####'}
            </div>
          </div>
        </div>
      </div>

      {!isCurrentSession && (
        <button
          onClick={revokeSession}
          className="p-3 bg-red-500/5 hover:bg-red-500 hover:text-white text-red-500/40 rounded-xl transition-all active:scale-95"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}