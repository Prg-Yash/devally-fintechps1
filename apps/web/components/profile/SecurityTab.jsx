import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import React from 'react'
import ChangePasswordForm from './ChangePasswordForm'
import SetPasswordForm from './SetPasswordForm'
import { Badge } from '@/components/ui/badge'
import { TwoFactorAuth } from './TwoFactorAuth'
import { PasskeyManagement } from './PasskeyManagement'

const SecurityTab = async ({ email, isTwoFactorEnabled }) => {

  const [passkeys, accounts] = await Promise.all([
    auth.api.listPasskeys({ headers: await headers() }),
    auth.api.listUserAccounts({ headers: await headers() }),
  ])
  const hasPasswordAccounts = accounts.some(a => a.providerId === 'credential')

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Security Settings</h2>
      <p className="text-gray-600 mb-6">Change your security settings here.</p>

      <div className='space-y-4'>
        {
          hasPasswordAccounts ? (
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  You can change your account password associated with {email}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChangePasswordForm />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Set Password</CardTitle>
                <CardDescription>
                  You can set a password for your account associated with {email}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SetPasswordForm email={email} />
              </CardContent>
            </Card>
          )
        }

        {hasPasswordAccounts && (
          <Card>
            <CardHeader className="flex items-center justify-between gap-2">
              <CardTitle>Two-Factor Authentication</CardTitle>
              <Badge variant={isTwoFactorEnabled ? "default" : "secondary"}>
                {isTwoFactorEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </CardHeader>
            <CardContent>
              <TwoFactorAuth isEnabled={isTwoFactorEnabled} />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Passkeys</CardTitle>
          </CardHeader>
          <CardContent>
            <PasskeyManagement passkeys={passkeys} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default SecurityTab