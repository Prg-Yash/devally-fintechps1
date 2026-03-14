"use client"

import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import React from 'react'
import { toast } from 'sonner'

const SetPasswordForm = ({ email }) => {
  const sendPasswordResetEmailHandler = () => {
    authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password"
    })
    toast.success("Password reset email sent! Please check your inbox.")
  }
  return (
    <div>
      <Button variant='outline' onClick={sendPasswordResetEmailHandler}>Send Password Reset Email</Button>
    </div>
  )
}

export default SetPasswordForm