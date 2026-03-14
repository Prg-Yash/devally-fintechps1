import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import React, { Suspense } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ProfileUpdateTab from '@/components/profile/ProfileUpdateTab'
import SecurityTab from '@/components/profile/SecurityTab'
import SessionsTab from '@/components/profile/SessionsTab'
import AccountsTab from '@/components/profile/AccountsTab'
import DangerTab from '@/components/profile/DangerTab'
import { Loader2Icon } from 'lucide-react'

const ProfilePage = async () => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session === null) return redirect('/login')

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Profile Header */}
        <div className="bg-linear-to-r from-blue-500 to-purple-600 px-8 py-12">
          <div className="flex items-center gap-6">
            {
              session.user && session.user.image != null && session.user.image.trim() !== "" && (
                <Image
                  width={100}
                  height={100}
                  src={session?.user?.image?.trim() || "https://placehold.co/400"}
                  alt="User Profile Image"
                  className="rounded-full border-4 border-white shadow-lg"
                />
              )
            }
            <div className="text-white">
              <h1 className="text-3xl font-bold mb-2">{session.user.name}</h1>
              <p className="text-blue-100">{session.user.email}</p>
            </div>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="p-8">
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-8">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
              <TabsTrigger value="accounts">Accounts</TabsTrigger>
              <TabsTrigger value="danger">Danger</TabsTrigger>
            </TabsList>
            <TabsContent value="profile" className="space-y-4">
              <ProfileUpdateTab user={session.user} />
            </TabsContent>
            <TabsContent value="security" className="space-y-4">
              <LoadingSuspense>
                <SecurityTab email={session.user.email} isTwoFactorEnabled={session.user.twoFactorEnabled ?? false} />
              </LoadingSuspense>
            </TabsContent>
            <TabsContent value="sessions" className="space-y-4">
              <LoadingSuspense>
                <SessionsTab currentSessionToken={session.session.token} />
              </LoadingSuspense>
            </TabsContent>
            <TabsContent value="accounts" className="space-y-4">
              <LoadingSuspense>
                <AccountsTab />
              </LoadingSuspense>
            </TabsContent>
            <TabsContent value="danger" className="space-y-4">
              <LoadingSuspense>
                <DangerTab />
              </LoadingSuspense>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage

export const LoadingSuspense = ({ children }: { children: React.ReactNode }) => {
  return (
    <Suspense fallback={<Loader2Icon className='size-20 animate-spin' />}>
      {children}
    </Suspense>
  )
}
