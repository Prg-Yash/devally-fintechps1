CREATE TABLE IF NOT EXISTS "withdrawal" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "walletAddress" TEXT NOT NULL,
  "amountPcc" DOUBLE PRECISION NOT NULL,
  "amountBaseUnits" TEXT NOT NULL,
  "txHash" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "withdrawal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "withdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "withdrawal_txHash_key" ON "withdrawal"("txHash");
CREATE INDEX IF NOT EXISTS "withdrawal_userId_createdAt_idx" ON "withdrawal"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "withdrawal_userId_status_idx" ON "withdrawal"("userId", "status");
CREATE INDEX IF NOT EXISTS "withdrawal_walletAddress_idx" ON "withdrawal"("walletAddress");
