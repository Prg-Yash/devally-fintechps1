"use client"

import { authClient } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { Button } from "./ui/button"

const PasskeyButton = () => {
  const router = useRouter()
  const { refetch } = authClient.useSession()

  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={() =>
        authClient.signIn.passkey(undefined, {
          onSuccess() {
            refetch()
            router.push("/")
          },
        })
      }
    >
      Use Passkey
    </Button>
  )
}

export default PasskeyButton