"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import z from "zod"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

const profileUpdateSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.email(),
})
const ProfileUpdateTab = ({ user }) => {
  const router = useRouter()
  const form = useForm({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: user
  })

  const handleProfileUpdate = async (data) => {
    const promises = [
      authClient.updateUser({
        name: data.name,
      })
    ]

    if (data.email !== user.email) {
      promises.push(
        authClient.changeEmail({
          newEmail: data.email,
          callbackURL: "/profile"
        })
      )
    }

    const res = await Promise.all(promises);
    const updateUserResult = res[0];
    const updateEmailResult = res[1];

    if (updateUserResult.error) {
      toast.error(updateUserResult.error.message || "Failed to update profile")
    } else if (updateEmailResult && updateEmailResult.error) {
      toast.error(updateEmailResult.error.message || "Failed to change email")
    } else {
      if (data.email !== user.email) {
        toast.success("Profile updated! Please verify your new email address.")
      } else {
        toast.success("Profile updated successfully!")
      }
      router.refresh()
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Profile Settings</h2>
      <p className="text-gray-600 mb-6">Make changes to your profile here.</p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleProfileUpdate)} className="space-y-4">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter your full name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="Enter your email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <Button type="submit" className="w-full" size="lg" disabled={form.formState.isSubmitting}>
            {
              form.formState.isSubmitting ? "Updating profile..." : "Update Profile"
            }
          </Button>
        </form>
      </Form>
    </div>
  )
}

export default ProfileUpdateTab