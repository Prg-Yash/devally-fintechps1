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
import { Button } from "./ui/button"
import { authClient } from "@/lib/auth-client"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

const forgetPasswordSchema = z.object({
  email: z.email(),
})

const ForgetPasswordForm = () => {
  const router = useRouter()
  const form = useForm({
    resolver: zodResolver(forgetPasswordSchema),
    defaultValues: {
      email: "",
    }
  })

  const handleForgetPassword = async (data) => {
    await authClient.requestPasswordReset(
      { ...data, redirectTo: "/reset-password" },
      {
        onError: (error) => {
          toast.error(error.error.message || "Failed to send reset email")
          console.error("Reset password error:", error)
        },
        onSuccess: () => {
          toast.success("Password reset email sent! Please check your email.")
          router.push("/")
        }
      }
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <Link href="/" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Home
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Forgot Password</h1>
        <p className="text-gray-600">Enter your email address and we'll send you a link to reset your password</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleForgetPassword)} className="space-y-4">
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
              form.formState.isSubmitting ? "Sending reset email..." : "Send Reset Email"
            }
          </Button>
        </form>
      </Form>

      <div className="mt-6 text-center space-y-2">
        <div className="text-sm text-gray-600">
          Remember your password?{" "}
          <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
            Sign in
          </Link>
        </div>
        <div className="text-sm text-gray-600">
          Don't have an account?{" "}
          <Link href="/register" className="text-blue-600 hover:text-blue-700 font-medium">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  )
}

export default ForgetPasswordForm