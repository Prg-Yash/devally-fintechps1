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
import { Checkbox } from "@/components/ui/checkbox"

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6),
  revokeOtherSessions: z.boolean(),
})
const ChangePasswordForm = () => {
  const router = useRouter()
  const form = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      revokeOtherSessions: true
    }
  })

  const handleChangePassword = async (data) => {
    await authClient.changePassword(data, {
      onError: (error) => {
        toast.error(error.message || "Failed to change password")
      },
      onSuccess: async () => {
        if (data.revokeOtherSessions) {
          await authClient.revokeOtherSessions()
          router.refresh()
        }
        toast.success("Password changed successfully!")
        form.reset()
      }
    })
  }

  return (
    <div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleChangePassword)} className="space-y-4">
          <FormField control={form.control} name="currentPassword" render={({ field }) => (
            <FormItem>
              <FormLabel>Current Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Enter your current password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="newPassword" render={({ field }) => (
            <FormItem>
              <FormLabel>New Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Enter your new password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />


          <FormField control={form.control} name="revokeOtherSessions" render={({ field }) => (
            <FormItem className="flex items-center space-x-3 space-y-0">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="font-normal">Logout from other sessions</FormLabel>
              <FormMessage />
            </FormItem>
          )} />

          <Button type="submit" className="w-full" size="lg" disabled={form.formState.isSubmitting}>
            {
              form.formState.isSubmitting ? "Changing..." : "Change Password"
            }
          </Button>
        </form>
      </Form>
    </div>
  )
}

export default ChangePasswordForm