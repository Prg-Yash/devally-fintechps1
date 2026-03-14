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

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
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

const RegisterForm = () => {
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" }
  })

  const onSubmit = async (data) => {
    setIsSubmitting(true)
    await authClient.signUp.email(
      { ...data, callbackURL: "/" },
      {
        onError: (ctx) => {
          console.error("Registration failed:", ctx)
          if (ctx.error) {
            console.error("Reg error details:", { code: ctx.error.code, message: ctx.error.message })
          }
          toast.error(ctx.error?.message || "Registration failed")
          setIsSubmitting(false)
        },
        onSuccess: () => {
          toast.success("Registration successful! Please check your email to verify your account.")
          setIsSubmitting(false)
          router.push("/dashboard")
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
          Create Account
        </h1>
        <p className="font-inter text-sm text-gray-500">
          Sign up to get started with our platform
        </p>
      </motion.div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Full Name */}
        <motion.div className="space-y-1.5" variants={itemVariants}>
          <label className="block text-xs font-inter font-medium text-gray-700">
            Full Name
          </label>
          <input
            type="text"
            {...register("name")}
            placeholder="Enter your full name"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm font-inter text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
          />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
        </motion.div>

        {/* Email */}
        <motion.div className="space-y-1.5" variants={itemVariants}>
          <label className="block text-xs font-inter font-medium text-gray-700">
            Email Address
          </label>
          <input
            type="email"
            {...register("email")}
            placeholder="Enter your email address"
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
              placeholder="Create a password (min. 6 chars)"
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

        {/* Submit */}
        <motion.button
          type="submit"
          disabled={isSubmitting}
          variants={itemVariants}
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.98 }}
          className="w-full bg-gray-900 text-white font-inter font-medium py-3.5 rounded-xl transition-colors hover:bg-gray-700 disabled:opacity-60 flex justify-center items-center mt-2"
        >
          {isSubmitting ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
          ) : "Create Account"}
        </motion.button>
      </form>

      {/* Divider */}
      <motion.div className="relative flex items-center justify-center my-7" variants={itemVariants}>
        <span className="w-full border-t border-gray-200" />
        <span className="absolute bg-white px-3 font-inter text-xs text-gray-400">Or continue with</span>
      </motion.div>

      {/* Social buttons */}
      <motion.div variants={itemVariants}>
        <GoogleAuthButton />
      </motion.div>
      <motion.div variants={itemVariants} className="mt-3">
        <PasskeyButton />
      </motion.div>

      {/* Footer link */}
      <motion.div className="mt-8 text-left text-xs font-inter text-gray-500" variants={itemVariants}>
        Already have an account?{" "}
        <Link href="/login" className="text-gray-900 font-medium hover:text-violet-700 transition-colors underline underline-offset-4 decoration-gray-300">
          Sign in
        </Link>
      </motion.div>
    </motion.div>
  )
}

export default RegisterForm