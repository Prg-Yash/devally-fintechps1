import "server-only";

import { createPublicClient, createWalletClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const pccAbi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export const INR_TO_PCC_RATE = Number(
  process.env.INR_TO_PCC_RATE ?? process.env.NEXT_PUBLIC_INR_TO_PCC_RATE ?? "1",
);

function getDistributorConfig() {
  const contractAddress =
    (process.env.PCC_CONTRACT_ADDRESS ?? process.env.NEXT_PUBLIC_PCC_CONTRACT_ADDRESS) as
    | `0x${string}`
    | undefined;
  const privateKeyRaw = process.env.PCC_DISTRIBUTOR_PRIVATE_KEY;
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  const rpcUrls = (process.env.SEPOLIA_RPC_URLS ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  const privateKey = privateKeyRaw
    ? ((privateKeyRaw.startsWith("0x") ? privateKeyRaw : `0x${privateKeyRaw}`) as `0x${string}`)
    : undefined;

  return { contractAddress, privateKey, rpcUrl, rpcUrls };
}

export function isPccDistributorConfigured() {
  const { contractAddress, privateKey, rpcUrl, rpcUrls } = getDistributorConfig();
  return Boolean(contractAddress && privateKey && (rpcUrl || rpcUrls.length > 0));
}

export function getPccContractAddress() {
  const { contractAddress } = getDistributorConfig();
  return contractAddress;
}

export async function mintPccToWallet(walletAddress: `0x${string}`, pccAmount: number) {
  const { contractAddress, privateKey, rpcUrl, rpcUrls } = getDistributorConfig();
  if (!contractAddress || !privateKey || (!rpcUrl && rpcUrls.length === 0)) {
    throw new Error(
      "PCC distributor is not configured. Set PCC_CONTRACT_ADDRESS (or NEXT_PUBLIC_PCC_CONTRACT_ADDRESS), PCC_DISTRIBUTOR_PRIVATE_KEY, and SEPOLIA_RPC_URL (or SEPOLIA_RPC_URLS).",
    );
  }

  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error(
      "Invalid PCC_DISTRIBUTOR_PRIVATE_KEY format. Use a 32-byte hex private key (64 hex chars), with or without 0x prefix.",
    );
  }

  const account = privateKeyToAccount(privateKey);

  const endpoints = Array.from(new Set([...(rpcUrls.length > 0 ? rpcUrls : []), ...(rpcUrl ? [rpcUrl] : [])]));
  const amount = parseUnits(pccAmount.toFixed(6), 6);
  let lastError: unknown;

  for (const endpoint of endpoints) {
    try {
      const transport = http(endpoint, {
        timeout: 20_000,
        retryCount: 2,
        retryDelay: 500,
      });

      const walletClient = createWalletClient({
        account,
        chain: sepolia,
        transport,
      });

      const publicClient = createPublicClient({
        chain: sepolia,
        transport,
      });

      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi: pccAbi,
        functionName: "mint",
        args: [walletAddress, amount],
      });

      await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 90_000,
      });
      return txHash;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Mint failed across all configured Sepolia RPC endpoints. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}
