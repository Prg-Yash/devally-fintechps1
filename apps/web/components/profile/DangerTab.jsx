"use client"

import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import React from 'react'
import { toast } from 'sonner'

const DangerTab = () => {

  const deleteUserHandler = async () => {
    const confirmed = window.confirm("Are you sure you want to delete your account? This action cannot be undone.")
    if (!confirmed) return

    await authClient.deleteUser({ callbackURL: "/" })
    toast.success("Please confirm the account deletion via the email sent to you!")
  }
  return (
    <div>
      <h2 className="text-xl font-semibold mb-2 text-red-600">Danger Zone</h2>
      <p className="text-gray-600 mb-6">Proceed with caution when making changes here.</p>

      <div>
        <Button onClick={deleteUserHandler} variant='destructive' className="w-full">Delete Your Account</Button>
      </div>
    </div >
  )
}

export default DangerTab