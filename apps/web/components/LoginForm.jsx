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
import GoogleAuthButton from "./GoogleAuthButton"
import { useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import PasskeyButton from "./PasskeyButton"

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(6)
})

const LoginForm = () => {
  const [errorCode, setErrorCode] = useState(null)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const router = useRouter()
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  })

  const handleLogin = async (data) => {
    await authClient.signIn.email(
      { ...data, callbackURL: "/" },
      {
        onError: (error) => {
          toast.error(error.error.message || "Login failed")
          console.error("Login error:", error)
          setErrorCode(error.error.code)
        },
        onSuccess: () => {
          toast.success("Login successful! Welcome back.")
          // router.push("/")
        }
      }
    )
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <Link href="/" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Home
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
        <p className="text-gray-600">Sign in to your account to continue</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-4">
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="Enter your email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="password" render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Enter your password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <div className="flex justify-end">
            <Link href="/forget-password" className="text-sm text-blue-600 hover:text-blue-700">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={form.formState.isSubmitting}>
            {
              form.formState.isSubmitting ? "Logging in..." : "Login"
            }
          </Button>
        </form>
      </Form>

      {
        errorCode === "EMAIL_NOT_VERIFIED" && (
          <div className="mt-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                setIsSendingEmail(true)
                try {
                  await authClient.sendVerificationEmail({
                    email: form.getValues("email"),
                    callbackURL: "/"
                  })
                  toast.success("Verification email sent! Please check your inbox.")
                } catch (error) {
                  toast.error("Failed to send verification email. Please try again.")
                  console.error("Verification email error:", error)
                } finally {
                  setIsSendingEmail(false)
                  setErrorCode(null)
                }
              }}
              disabled={isSendingEmail}
            >
              {isSendingEmail ? "Sending verification email..." : "Resend Verification Email"}
            </Button>
          </div>
        )
      }

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-gray-500">Or continue with</span>
        </div>
      </div>

      <GoogleAuthButton />
      <PasskeyButton />

      <div className="mt-6 text-center text-sm text-gray-600">
        Don't have an account?{" "}
        <Link href="/register" className="text-blue-600 hover:text-blue-700 font-medium">
          Sign up
        </Link>
      </div>
    </div>
  )
}

export default LoginForm