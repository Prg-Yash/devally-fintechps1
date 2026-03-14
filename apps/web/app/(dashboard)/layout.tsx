"use client"

import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import Loading from '@/components/Loading'

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    if (!isPending) {
      if (session == null) {
        toast.error('You must be logged in to access the dashboard.')
        router.push('/login')
      } else {
        setIsChecking(false)
      }
    }
  }, [session, isPending, router])

  if (isPending || isChecking) {
    return <Loading />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-8">
        {children}
      </div>
    </div>
  )
}

export default DashboardLayout
