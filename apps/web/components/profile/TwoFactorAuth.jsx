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
import { authClient } from "@/lib/auth-client"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Input } from "@/components/ui/input"
import QRCode from "react-qr-code"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CheckCircle2, ShieldCheck, Copy, Loader2 } from "lucide-react"

const twoFactorAuthSchema = z.object({
  password: z.string().min(1, "Password is required"),
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
          toast.success("Two-factor authentication disabled")
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
    } else {
      setTwoFactorData(result.data)
      form.reset()
    }
  }

  return (
    <>
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
              <FormItem className="space-y-2">
                <FormLabel className="text-[10px] font-bold text-[#1A2406]/30 uppercase tracking-[0.2em] ml-1">Confirm Password</FormLabel>
                <FormControl>
                  <Input 
                    type="password" 
                    placeholder="Enter password to proceed" 
                    className="bg-white/50 border border-black/[0.06] focus:border-[#1A2406] h-12 rounded-xl text-sm font-jakarta"
                    {...field} 
                  />
                </FormControl>
                <FormMessage className="text-[10px] uppercase font-bold tracking-widest text-red-500" />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={isSubmitting}
            className={`w-full h-12 rounded-xl text-[11px] font-bold uppercase tracking-[0.2em] transition-all shadow-lg active:scale-[0.98] ${
              isEnabled 
                ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/10" 
                : "bg-[#1A2406] hover:bg-black text-white shadow-[#1A2406]/10"
            }`}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              isEnabled ? "Disable 2FA Security" : "Enable 2FA Protection"
            )}
          </Button>
        </form>
      </Form>

      {/* QR Code Verification Modal */}
      <Dialog open={!!twoFactorData} onOpenChange={(open) => !open && setTwoFactorData(null)}>
        <DialogContent className="sm:max-w-md bg-white rounded-[40px] border-none p-0 overflow-hidden shadow-2xl">
          <div className="bg-[#1A2406] p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#D9F24F]/10 blur-[60px] rounded-full" />
            <DialogHeader className="relative z-10 text-left">
              <div className="w-12 h-12 bg-[#D9F24F] rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(217,242,79,0.4)]">
                <ShieldCheck className="w-6 h-6 text-[#1A2406]" />
              </div>
              <DialogTitle className="font-jakarta text-2xl font-bold tracking-tight">Finalize Encryption</DialogTitle>
              <DialogDescription className="text-white/40 font-medium text-xs uppercase tracking-widest mt-1">
                Scan QR to establish protocol link
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="p-8">
            {twoFactorData && (
              <QRCodeVerify
                {...twoFactorData}
                onDone={() => setTwoFactorData(null)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

const qrSchema = z.object({
  token: z.string().length(6, "Token must be 6 digits"),
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
          toast.success("2FA link established successfully")
        },
      }
    )
  }

  if (successfullyEnabled) {
    return (
      <div className="space-y-6 text-center py-4">
        <div className="w-16 h-16 bg-[#16A34A]/10 text-[#16A34A] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#16A34A]/20">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h3 className="font-jakarta text-xl font-bold text-[#1A2406]">Security Link Active</h3>
          <p className="text-sm text-[#1A2406]/40 font-medium px-4">
            Save these backup codes in an offline vault. They are required if you lose access to your authenticator node.
          </p>
        </div>
        
        <div className="grid grid-cols-2 gap-3 mt-8">
          {backupCodes.map((code, index) => (
            <div key={index} className="bg-[#1A2406]/[0.02] border border-[#1A2406]/[0.05] py-3 rounded-xl font-mono text-xs font-bold text-[#1A2406]/60 flex items-center justify-center gap-2 group cursor-pointer hover:bg-white hover:border-[#1A2406]/10 transition-all shadow-sm">
              {code}
              <Copy className="w-3 h-3 text-[#1A2406]/10 group-hover:text-[#1A2406]/30" />
            </div>
          ))}
        </div>

        <Button 
          className="w-full h-12 rounded-xl bg-[#1A2406] text-white text-[11px] font-bold uppercase tracking-[0.2em] mt-8 shadow-lg shadow-[#1A2406]/10" 
          onClick={onDone}
        >
          Close Registry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-center">
        <div className="p-4 bg-white border-2 border-[#1A2406]/[0.05] rounded-3xl shadow-2xl relative">
          <div className="absolute inset-0 bg-gradient-to-br from-[#D9F24F]/5 to-transparent pointer-events-none" />
          <QRCode size={180} value={totpURI} />
        </div>
      </div>

      <Form {...form}>
        <form className="space-y-6" onSubmit={form.handleSubmit(handleQrCode)}>
          <FormField
            control={form.control}
            name="token"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel className="text-[10px] font-bold text-[#1A2406]/30 uppercase tracking-[0.2em] ml-1">Authentication Token</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Enter 6-digit sync code" 
                    className="bg-[#1A2406]/[0.02] border border-[#1A2406]/[0.05] focus:border-[#1A2406] h-12 rounded-xl text-center text-lg font-mono tracking-[0.4em] font-bold"
                    {...field} 
                  />
                </FormControl>
                <FormMessage className="text-center text-[10px] uppercase font-bold tracking-widest text-red-500" />
              </FormItem>
            )}
          />

          <Button 
            type="submit" 
            disabled={isSubmitting} 
            className="w-full h-12 rounded-xl bg-[#1A2406] text-white text-[11px] font-bold uppercase tracking-[0.2em] shadow-lg shadow-[#1A2406]/10 active:scale-[0.98]"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Authorize Sync"}
          </Button>
        </form>
      </Form>
    </div>
  )
}