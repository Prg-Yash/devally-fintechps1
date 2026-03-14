import { getContract, readContract } from "thirdweb";
import { sepolia } from "thirdweb/chains";
import type { ThirdwebClient } from "thirdweb";
import { parseSignature } from "viem";

// ── PayCrowEscrow & PayCrowUSD (PUSD) on Sepolia ──────────────────────────
export const ESCROW_CONTRACT_ADDRESS = "0x9fA56Ec0eC3f22A52d9b8ac6Df8Ae7b7A253E41C";
export const PUSD_CONTRACT_ADDRESS = "0xA66983663d72ec5B521aA3082635EfbB52C764AA";

export const PUSD_DECIMALS = 6;

// ── Permit EIP-712 Domain (must match the on-chain token) ──────────────────
export const PERMIT_DOMAIN = {
  name: "USD Coin",
  version: "1",
  chainId: 11155111,
} as const;

// ── Types ──────────────────────────────────────────────────────────────────
export type OnchainProject = {
  projectId: bigint;
  client: string;
  freelancer: string;
  amount: bigint;
  isFunded: boolean;
  isCompleted: boolean;
};

// ── Contract getters ───────────────────────────────────────────────────────
export function getEscrowContract(client: ThirdwebClient) {
  return getContract({
    client,
    chain: sepolia,
    address: ESCROW_CONTRACT_ADDRESS,
  });
}

export function getPusdContract(client: ThirdwebClient) {
  return getContract({
    client,
    chain: sepolia,
    address: PUSD_CONTRACT_ADDRESS,
  });
}

// ── Amount helpers ─────────────────────────────────────────────────────────
export function scalePusdAmount(amount: string): bigint {
  const normalized = amount.trim();
  if (!normalized) {
    throw new Error("Amount is required");
  }

  const [wholePart, fracPart = ""] = normalized.split(".");
  const safeWhole = wholePart === "" ? "0" : wholePart;
  const paddedFrac = `${fracPart}000000`.slice(0, PUSD_DECIMALS);

  return BigInt(safeWhole) * BigInt(10) ** BigInt(PUSD_DECIMALS) + BigInt(paddedFrac);
}

export function formatPusdAmount(amount: bigint) {
  const whole = amount / BigInt(1_000_000);
  const fraction = (amount % BigInt(1_000_000)).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
}

// ── Signature utilities ────────────────────────────────────────────────────
export function splitSignature(signature: `0x${string}`): { v: number; r: `0x${string}`; s: `0x${string}` } {
  try {
    const parsed = parseSignature(signature);
    const resolvedV =
      parsed.v ?? (parsed.yParity === 0 ? 27 : parsed.yParity === 1 ? 28 : undefined);

    if (resolvedV === undefined) {
      throw new Error("Unable to resolve signature v");
    }

    const numericV = typeof resolvedV === "bigint" ? Number(resolvedV) : resolvedV;
    const v = numericV < 27 ? numericV + 27 : numericV;

    return {
      v,
      r: parsed.r,
      s: parsed.s,
    };
  } catch {
    throw new Error(
      "Invalid signature format for permit. Please sign with the admin wallet (EOA) instead of the smart-account wrapper.",
    );
  }
}

// ── On-chain reads ─────────────────────────────────────────────────────────
export async function getPermitNonce(client: ThirdwebClient, ownerAddress: string): Promise<bigint> {
  const pusdContract = getPusdContract(client);
  return readContract({
    contract: pusdContract,
    method: "function nonces(address owner) view returns (uint256)",
    params: [ownerAddress],
  });
}

export async function getProjectCount(client: ThirdwebClient) {
  const escrowContract = getEscrowContract(client);
  return readContract({
    contract: escrowContract,
    method: "function projectCount() view returns (uint256)",
  });
}

export async function getProjectById(client: ThirdwebClient, projectId: bigint): Promise<OnchainProject> {
  const escrowContract = getEscrowContract(client);
  const result = await readContract({
    contract: escrowContract,
    method:
      "function projects(uint256) view returns (address client, address freelancer, uint256 amount, bool isFunded, bool isCompleted)",
    params: [projectId],
  });

  const [clientAddress, freelancerAddress, amount, isFunded, isCompleted] = result as [
    string,
    string,
    bigint,
    boolean,
    boolean,
  ];

  return {
    projectId,
    client: clientAddress,
    freelancer: freelancerAddress,
    amount,
    isFunded,
    isCompleted,
  };
}

export async function getProjectsForClient(
  client: ThirdwebClient,
  clientAddress: string,
  maxItems = 10,
): Promise<OnchainProject[]> {
  const count = await getProjectCount(client);
  if (count === BigInt(0)) {
    return [];
  }

  const projects: OnchainProject[] = [];
  for (let id = count; id > BigInt(0) && projects.length < maxItems; id--) {
    const project = await getProjectById(client, id);
    if (project.client.toLowerCase() === clientAddress.toLowerCase()) {
      projects.push(project);
    }
  }

  return projects;
}

// ── Address formatting ─────────────────────────────────────────────────────
export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
