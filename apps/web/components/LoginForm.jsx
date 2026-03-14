"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import z from "zod"
import { authClient } from "@/lib/auth-client"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useState } from "react"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import GoogleAuthButton from "./GoogleAuthButton"
import PasskeyButton from "./PasskeyButton"
import { motion } from "framer-motion"

const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required")
})

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } }
}

const LoginForm = () => {
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorCode, setErrorCode] = useState(null)
  const [isSendingEmail, setIsSendingEmail] = useState(false)

  const { register, handleSubmit, getValues, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" }
  })

  const onSubmit = async (data) => {
    setIsSubmitting(true)
    await authClient.signIn.email(
      { ...data, callbackURL: "/" },
      {
        onError: (error) => {
          toast.error(error.error.message || "Login failed")
          console.error("Login error:", error)
          setErrorCode(error.error.code)
          setIsSubmitting(false)
        },
        onSuccess: () => {
          toast.success("Login successful! Welcome back.")
          setIsSubmitting(false)
          // router.push("/")
        }
      }
    )
  }

  return (
    <motion.div
      className="w-full text-gray-900"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div className="mb-10" variants={itemVariants}>
        <h1 className="text-4xl sm:text-5xl font-jakarta font-semibold tracking-[-0.04em] text-gray-900 mb-3">
          Welcome
        </h1>
        <p className="font-inter text-sm text-gray-500">
          Access your account and continue your journey with us
        </p>
      </motion.div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Email */}
        <motion.div className="space-y-1.5" variants={itemVariants}>
          <label className="block text-xs font-inter font-medium text-gray-700">
            Email Address
          </label>
          <input
            type="email"
            {...register("email")}
            placeholder="Enter your email address"
            autoComplete="username webauthn"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm font-inter text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
          />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
        </motion.div>

        {/* Password */}
        <motion.div className="space-y-1.5" variants={itemVariants}>
          <label className="block text-xs font-inter font-medium text-gray-700">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              {...register("password")}
              placeholder="Enter your password"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm font-inter text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-violet-600 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
        </motion.div>

        {/* Remember / Reset row */}
        <motion.div className="flex items-center justify-between" variants={itemVariants}>
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className="relative flex items-center justify-center">
              <input
                type="checkbox"
                className="peer appearance-none w-4 h-4 border border-gray-300 rounded-sm bg-transparent checked:bg-violet-600 checked:border-violet-600 transition-all cursor-pointer"
              />
              <svg className="absolute w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 14 10" fill="none">
                <path d="M1 5L4.5 8.5L13 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-xs font-inter text-gray-600 group-hover:text-gray-900 transition-colors">Keep me signed in</span>
          </label>
          <Link href="/forget-password" className="text-xs font-inter text-violet-600 hover:text-violet-800 transition-colors">
            Reset password
          </Link>
        </motion.div>

        {/* Submit */}
        <motion.button
          type="submit"
          disabled={isSubmitting}
          variants={itemVariants}
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.98 }}
          className="w-full bg-gray-900 text-white font-inter font-medium py-3.5 rounded-xl transition-colors hover:bg-gray-700 disabled:opacity-60 flex justify-center items-center"
        >
          {isSubmitting ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
          ) : "Sign In"}
        </motion.button>
      </form>

      {/* Email not verified */}
      {errorCode === "EMAIL_NOT_VERIFIED" && (
        <motion.div className="mt-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <button
            type="button"
            className="w-full border border-gray-300 text-gray-700 font-inter text-sm py-3 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-60"
            onClick={async () => {
              setIsSendingEmail(true)
              try {
                await authClient.sendVerificationEmail({ email: getValues("email"), callbackURL: "/" })
                toast.success("Verification email sent! Please check your inbox.")
              } catch (err) {
                toast.error("Failed to send verification email. Please try again.")
                console.error("Verification email error:", err)
              } finally {
                setIsSendingEmail(false)
                setErrorCode(null)
              }
            }}
            disabled={isSendingEmail}
          >
            {isSendingEmail ? "Sending..." : "Resend Verification Email"}
          </button>
        </motion.div>
      )}

      {/* Divider */}
      <motion.div className="relative flex items-center justify-center my-7" variants={itemVariants}>
        <span className="w-full border-t border-gray-200" />
        <span className="absolute bg-white px-3 font-inter text-xs text-gray-400">Or continue with</span>
      </motion.div>

      {/* Google button — use existing GoogleAuthButton */}
      <motion.div variants={itemVariants}>
        <GoogleAuthButton />
      </motion.div>
      <motion.div variants={itemVariants} className="mt-3">
        <PasskeyButton />
      </motion.div>

      {/* Footer link */}
      <motion.div className="mt-8 text-left text-xs font-inter text-gray-500" variants={itemVariants}>
        New to our platform?{" "}
        <Link href="/register" className="text-gray-900 font-medium hover:text-violet-700 transition-colors underline underline-offset-4 decoration-gray-300">
          Create Account
        </Link>
      </motion.div>
    </motion.div>
  )
}

export default LoginForm
