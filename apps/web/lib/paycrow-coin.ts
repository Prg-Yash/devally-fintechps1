import { getContract, readContract } from "thirdweb";
import { sepolia } from "thirdweb/chains";
import type { ThirdwebClient } from "thirdweb";

import { PUSD_CONTRACT_ADDRESS } from "@/lib/escrow";

export const PCC_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_PCC_CONTRACT_ADDRESS ?? PUSD_CONTRACT_ADDRESS;

export const PCC_DECIMALS = 6;
export const INR_TO_PCC_RATE = Number(process.env.NEXT_PUBLIC_INR_TO_PCC_RATE ?? "1");

export function getPccContract(client: ThirdwebClient) {
  return getContract({
    client,
    chain: sepolia,
    address: PCC_CONTRACT_ADDRESS,
  });
}

export function getPccContractByAddress(client: ThirdwebClient, contractAddress: string) {
  return getContract({
    client,
    chain: sepolia,
    address: contractAddress,
  });
}

export function inrToPcc(inrAmount: number) {
  return inrAmount * INR_TO_PCC_RATE;
}

export function formatPcc(pccAmount: number) {
  return pccAmount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function toPccBaseUnits(pccAmount: number) {
  const scaled = Math.round(pccAmount * 10 ** PCC_DECIMALS);
  return BigInt(scaled);
}

export async function getPccBalance(
  client: ThirdwebClient,
  walletAddress: string,
  contractAddress?: string,
): Promise<bigint> {
  const contract = contractAddress
    ? getPccContractByAddress(client, contractAddress)
    : getPccContract(client);
  return readContract({
    contract,
    method: "function balanceOf(address owner) view returns (uint256)",
    params: [walletAddress],
  });
}

export function formatPccBaseUnits(balance: bigint) {
  const divisor = BigInt(10) ** BigInt(PCC_DECIMALS);
  const whole = balance / divisor;
  const fraction = (balance % divisor).toString().padStart(PCC_DECIMALS, "0").replace(/0+$/, "");
  return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
}
