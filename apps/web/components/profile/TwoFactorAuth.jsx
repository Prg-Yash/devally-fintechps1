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
import { Button } from "@/components/ui/button"
// import { LoadingSwap } from "@/components/ui/loading-swap"
import { authClient } from "@/lib/auth-client"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Input } from "@/components/ui/input"
import QRCode from "react-qr-code"

const twoFactorAuthSchema = z.object({
  password: z.string().min(1),
})

export const TwoFactorAuth = ({ isEnabled }) => {
  const [twoFactorData, setTwoFactorData] = useState(null)
  const router = useRouter()
  const form = useForm({
    resolver: zodResolver(twoFactorAuthSchema),
    defaultValues: { password: "" },
  })

  const { isSubmitting } = form.formState

  const handleDisableTwoFactorAuth = async (data) => {
    await authClient.twoFactor.disable(
      {
        password: data.password,
      },
      {
        onError: error => {
          toast.error(error.error.message || "Failed to disable 2FA")
        },
        onSuccess: () => {
          form.reset()
          router.refresh()
        },
      }
    )
  }

  const handleEnableTwoFactorAuth = async (data) => {
    const result = await authClient.twoFactor.enable({
      password: data.password,
    })

    if (result.error) {
      toast.error(result.error.message || "Failed to enable 2FA")
    }
    {
      setTwoFactorData(result.data)
      form.reset()
    }
  }

  if (twoFactorData != null) {
    return (
      <QRCodeVerify
        {...twoFactorData}
        onDone={() => {
          setTwoFactorData(null)
        }}
      />
    )
  }

  return (
    <Form {...form}>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit(
          isEnabled ? handleDisableTwoFactorAuth : handleEnableTwoFactorAuth
        )}
      >
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Enter your password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full"
          variant={isEnabled ? "destructive" : "default"}
        >
          {/* <LoadingSwap isLoading={isSubmitting}> */}
          {isEnabled ? "Disable 2FA" : "Enable 2FA"}
          {/* </LoadingSwap> */}
        </Button>
      </form>
    </Form>
  )
}

const qrSchema = z.object({
  token: z.string().length(6),
})

const QRCodeVerify = ({
  totpURI,
  backupCodes,
  onDone,
}) => {
  const [successfullyEnabled, setSuccessfullyEnabled] = useState(false)
  const router = useRouter()
  const form = useForm({
    resolver: zodResolver(qrSchema),
    defaultValues: { token: "" },
  })

  const { isSubmitting } = form.formState

  const handleQrCode = async (data) => {
    await authClient.twoFactor.verifyTotp(
      {
        code: data.token,
      },
      {
        onError: error => {
          toast.error(error.error.message || "Failed to verify code")
        },
        onSuccess: () => {
          setSuccessfullyEnabled(true)
          router.refresh()
        },
      }
    )
  }

  if (successfullyEnabled) {
    return (
      <>
        <p className="text-sm text-muted-foreground mb-2">
          Save these backup codes in a safe place. You can use them to access
          your account.
        </p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {backupCodes.map((code, index) => (
            <div key={index} className="font-mono text-sm">
              {code}
            </div>
          ))}
        </div>
        <Button variant="outline" onClick={onDone}>
          Done
        </Button>
      </>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">
        Scan this QR code with your authenticator app and enter the code below:
      </p>

      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleQrCode)}>
          <FormField
            control={form.control}
            name="token"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {/* <LoadingSwap isLoading={isSubmitting}>Submit Code</LoadingSwap> */}
            Submit Code
          </Button>
        </form>
      </Form>
      <div className="p-4 bg-white w-fit">
        <QRCode size={256} value={totpURI} />
      </div>
    </div>
  )
}