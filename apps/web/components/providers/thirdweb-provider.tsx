"use client";

import type React from "react";
import { ThirdwebProvider } from "thirdweb/react";

export function AppThirdwebProvider({ children }: { children: React.ReactNode }) {
  return <ThirdwebProvider>{children}</ThirdwebProvider>;
}
