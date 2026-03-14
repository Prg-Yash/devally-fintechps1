"use client"

import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import Loading from '@/components/Loading'

const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    if (!isPending) {
      if (session != null) {
        router.push('/')
      } else {
        setIsChecking(false)
      }
    }
  }, [session, isPending, router])

  if (isPending || isChecking) {
    return <Loading />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  )
}

export default AuthLayout
