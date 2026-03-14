"use client"

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { authClient } from '@/lib/auth-client'
import { Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React from 'react'

const AccountLinking = ({ currentAccounts }) => {
  return (
    <div>
      {currentAccounts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-secondary-muted">
            No linked accounts found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {currentAccounts.map(account => (
            <AccountCard
              key={account.id}
              provider={account.providerId}
              account={account}
            />
          ))}
        </div>
      )}
      {
        !currentAccounts.find(acc => acc.providerId === "google") && (
          <div className="space-y-2 mt-4">
            <h3 className="text-lg font-medium">Link Other Accounts</h3>
            <div className="grid gap-3">
              <AccountCard key="google" provider="google" account={null} />
            </div>
          </div>
        )
      }
    </div>
  )
}

export default AccountLinking

const AccountCard = ({ provider, account }) => {
  const router = useRouter();

  function linkAccount() {
    return authClient.linkSocial({
      provider,
      callbackURL: "/profile",
    })
  }

  function unlinkAccount() {
    if (account == null) {
      return Promise.resolve({ error: { message: "Account not found" } })
    }
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
    <Card>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* {<providerDetails.Icon className="size-5" />} */}
            <div>
              <p className="font-medium">Google</p>
              {account == null ? (
                <p className="text-sm text-muted-foreground">
                  Connect your Google account for easier sign-in
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Linked on {new Date(account.createdAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          {account == null ? (
            <Button
              variant="outline"
              size="sm"
              onClick={linkAccount}
            >
              <Plus />
              Link
            </Button>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              onClick={unlinkAccount}
            >
              <Trash2 />
              Unlink
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}