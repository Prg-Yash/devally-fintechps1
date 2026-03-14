import { Card, CardContent } from '@/components/ui/card'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import React from 'react'
import SessionManagement from './SessionManagement'

const SessionsTab = async ({ currentSessionToken }) => {
  const sessions = await auth.api.listSessions({ headers: await headers() })

  return (
    <div><h2 className="text-xl font-semibold mb-2">Active Sessions</h2>
      <p className="text-gray-600 mb-6">Manage your active sessions here.</p>

      <SessionManagement sessions={sessions} currentSessionToken={currentSessionToken} />
    </div>
  )
}

export default SessionsTab