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
import { Trash2, Key, Plus, ShieldCheck, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useState } from "react"

const passkeySchema = z.object({
  name: z.string().min(1, "Label is required for reference"),
})

export function PasskeyManagement({ passkeys }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const router = useRouter()
  const form = useForm({
    resolver: zodResolver(passkeySchema),
    defaultValues: {
      name: "",
    },
  })

  const { isSubmitting } = form.formState

  async function handleAddPasskey(data) {
    await authClient.passkey.addPasskey(data, {
      onError: error => {
        toast.error(error.error.message || "Failed to add passkey")
      },
      onSuccess: () => {
        router.refresh()
        setIsDialogOpen(false)
        toast.success(`Passkey '${data.name}' linked successfully`)
      },
    })
  }

  function handleDeletePasskey(passkeyId) {
    const confirm = window.confirm(
      "Are you sure you want to delete this passkey? This action cannot be undone."
    )
    if (!confirm) return
    return authClient.passkey.deletePasskey(
      { id: passkeyId },
      { 
        onSuccess: () => {
          router.refresh()
          toast.success("Passkey revoked from registry")
        } 
      }
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {passkeys.length === 0 ? (
          <div className="bg-[#1A2406]/[0.02] border border-[#1A2406]/[0.05] rounded-[24px] p-10 text-center border-dashed">
            <Key className="w-10 h-10 text-[#1A2406]/10 mx-auto mb-4" />
            <p className="text-xs font-bold text-[#1A2406]/30 uppercase tracking-widest">No active biometric nodes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {passkeys.map(passkey => (
              <div 
                key={passkey.id} 
                className="bg-white/60 border border-[#1A2406]/[0.05] p-6 rounded-[24px] flex items-center justify-between shadow-sm group hover:border-[#1A2406]/10 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#1A2406]/5 rounded-2xl flex items-center justify-center text-[#1A2406]/40 group-hover:bg-[#1A2406] group-hover:text-[#D9F24F] transition-all">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-jakarta font-bold text-[#1A2406] text-[15px] tracking-tight">{passkey.name}</h5>
                    <p className="text-[10px] font-bold tracking-widest uppercase text-[#1A2406]/20 mt-0.5">
                      Registry Link: {new Date(passkey.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeletePasskey(passkey.id)}
                  className="p-3 bg-red-500/5 hover:bg-red-500 hover:text-white text-red-500/40 rounded-xl transition-all active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={isDialogOpen}
        onOpenChange={o => {
          if (o) form.reset()
          setIsDialogOpen(o)
        }}
      >
        <DialogTrigger asChild>
          <Button className="w-full h-12 rounded-xl bg-[#1A2406] hover:bg-black text-[#D9F24F] text-[11px] font-bold uppercase tracking-[0.2em] shadow-lg shadow-[#1A2406]/10 flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Passkey Node
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md bg-white rounded-[40px] border-none p-0 overflow-hidden shadow-2xl">
          <div className="bg-[#D9F24F] p-8 text-[#1A2406] relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/40 blur-[60px] rounded-full" />
             <DialogHeader className="relative z-10 text-left">
              <div className="w-12 h-12 bg-[#1A2406] rounded-2xl flex items-center justify-center mb-4 shadow-xl">
                <ShieldCheck className="w-6 h-6 text-[#D9F24F]" />
              </div>
              <DialogTitle className="font-jakarta text-2xl font-bold tracking-tight">Provision Passkey</DialogTitle>
              <DialogDescription className="text-[#1A2406]/40 font-bold text-[10px] uppercase tracking-widest mt-1">
                Establish biometric protocol sync
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-8">
            <Form {...form}>
              <form
                className="space-y-6"
                onSubmit={form.handleSubmit(handleAddPasskey)}
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-[10px] font-bold text-[#1A2406]/30 uppercase tracking-[0.2em] ml-1">Terminal Alias</FormLabel>
                      <FormControl>
                        <input 
                          {...field} 
                          placeholder="e.g. Personal MacBook Pro"
                          className="w-full bg-[#1A2406]/[0.02] border border-[#1A2406]/[0.05] focus:border-[#1A2406] outline-none h-12 px-5 rounded-xl text-sm font-jakarta font-medium text-[#1A2406] transition-all"
                        />
                      </FormControl>
                      <FormMessage className="text-[10px] uppercase font-bold tracking-widest text-red-500" />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="w-full h-12 rounded-xl bg-[#1A2406] hover:bg-black text-white text-[11px] font-bold uppercase tracking-[0.2em] shadow-lg shadow-[#1A2406]/10 active:scale-[0.98]"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Link Biometrics"}
                </Button>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}