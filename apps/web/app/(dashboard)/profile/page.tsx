import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import React from 'react'
import ProfileClientView from '@/components/profile/ProfileClientView'

const ProfilePage = async () => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session === null) return redirect('/login')

  const [passkeys, accounts, sessions] = await Promise.all([
    auth.api.listPasskeys({ headers: await headers() }),
    auth.api.listUserAccounts({ headers: await headers() }),
    auth.api.listSessions({ headers: await headers() }),
  ])

  return (
    <ProfileClientView 
      initialUser={session.user}
      passkeys={passkeys}
      accounts={accounts}
      sessions={sessions}
      currentSessionToken={session.session.token}
    />
  )
}

export default ProfilePage
