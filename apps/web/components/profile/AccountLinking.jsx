"use client"

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { authClient } from '@/lib/auth-client'
import { Plus, Trash2, Globe, Monitor, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React from 'react'

const AccountLinking = ({ currentAccounts }) => {
  const providers = [
    { id: "google", name: "Google", icon: Globe, description: "Professional identity link" },
  ];

  return (
    <div className="space-y-6">
      {currentAccounts.length === 0 ? (
        <div className="bg-[#1A2406]/[0.02] border border-[#1A2406]/[0.05] rounded-[32px] p-12 text-center border-dashed">
          <Globe className="w-10 h-10 text-[#1A2406]/10 mx-auto mb-4" />
          <p className="text-xs font-bold text-[#1A2406]/30 uppercase tracking-widest">No cross-chain providers linked</p>
        </div>
      ) : (
        <div className="space-y-4">
          {currentAccounts.map(account => (
            <AccountCard
              key={account.id}
              provider={account.providerId}
              account={account}
              providerInfo={providers.find(p => p.id === account.providerId) || { name: account.providerId, icon: Globe, description: "Identity sync active" }}
            />
          ))}
        </div>
      )}
      
      {/* Available to Link */}
      {!currentAccounts.find(acc => acc.providerId === "google") && (
        <div className="pt-6 border-t border-[#1A2406]/[0.05]">
          <h4 className="text-[10px] font-bold text-[#1A2406]/30 uppercase tracking-[0.2em] mb-4 ml-1">Available Gateways</h4>
          <AccountCard key="google" provider="google" account={null} providerInfo={providers[0]} />
        </div>
      )}
    </div>
  )
}

export default AccountLinking

const AccountCard = ({ provider, account, providerInfo }) => {
  const router = useRouter();
  const Icon = providerInfo.icon;

  function linkAccount() {
    return authClient.linkSocial({
      provider,
      callbackURL: "/profile",
    })
  }

  function unlinkAccount() {
    if (account == null) return;
    const confirm = window.confirm("Severing this identity link may affect authentication nodes. Proceed?");
    if (!confirm) return;
    
    return authClient.unlinkAccount(
      {
        accountId: account.accountId,
        providerId: provider,
      },
      {
        onSuccess: () => {
          router.refresh()
        },
      }
    )
  }

  return (
    <div className="bg-white/80 border border-[#1A2406]/[0.05] p-6 rounded-[28px] flex items-center justify-between shadow-sm group transition-all hover:border-[#1A2406]/10">
      <div className="flex items-center gap-5">
        <div className="w-12 h-12 bg-[#1A2406]/[0.03] rounded-2xl flex items-center justify-center text-[#1A2406]/30 group-hover:bg-[#1A2406] group-hover:text-[#D9F24F] transition-all">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h5 className="font-jakarta font-bold text-[#1A2406] text-[15px] tracking-tight">{providerInfo.name} Interface</h5>
          {account == null ? (
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#1A2406]/20 mt-0.5">
              Ready for protocol sync
            </p>
          ) : (
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#16A34A] mt-0.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3" /> Linked on {new Date(account.createdAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
      
      {account == null ? (
        <button
          onClick={linkAccount}
          className="px-6 h-10 rounded-xl bg-[#1A2406] text-white text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-black transition-all shadow-lg shadow-[#1A2406]/10 active:scale-95 flex items-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" /> Sync Node
        </button>
      ) : (
        <button
          onClick={unlinkAccount}
          className="p-3 bg-red-500/5 hover:bg-red-500 hover:text-white text-red-500/40 rounded-xl transition-all active:scale-95"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}