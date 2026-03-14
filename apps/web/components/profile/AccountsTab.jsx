import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import React from 'react'
import AccountLinking from './AccountLinking'

const AccountsTab = async () => {

  const accounts = await auth.api.listUserAccounts({ headers: await headers() })
  const nonCredentialAccounts = accounts.filter(
    a => a.providerId !== "credential"
  )

  return (
    <div><h2 className="text-xl font-semibold mb-2">Connected Accounts</h2>
      <p className="text-gray-600 mb-6">Manage your connected accounts here.</p>
      <AccountLinking currentAccounts={nonCredentialAccounts} />
    </div>
  )
}

export default AccountsTab