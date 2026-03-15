import { getContract, readContract } from "thirdweb";
import { sepolia } from "thirdweb/chains";
import type { ThirdwebClient } from "thirdweb";
import { parseSignature } from "viem";

// ── PayCrowEscrow & PayCrowUSD (PUSD) on Sepolia ──────────────────────────
export const ESCROW_CONTRACT_ADDRESS = "0xfAe88C3dEd51A1d34b819Aec973C28D8F17059eB";
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
  releasedAmount: bigint;
  clientRefId: bigint;
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

export function formatPusdAmount(amount: bigint | number) {
  const bAmount = BigInt(amount);
  const whole = bAmount / BigInt(1_000_000);
  const fraction = (bAmount % BigInt(1_000_000)).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
}

// ── Signature utilities ────────────────────────────────────────────────────
const bytesToHex = (value: Uint8Array): `0x${string}` => {
  const hex = Array.from(value)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex}`;
};

const padToBytes32 = (value: `0x${string}`): `0x${string}` => {
  const clean = value.slice(2);
  return `0x${clean.padStart(64, "0")}`;
};

const vToByte = (v: number) => {
  const normalized = v < 27 ? v + 27 : v;
  return (normalized - 27).toString(16).padStart(2, "0");
};

export function normalizeSignatureHex(signature: unknown): `0x${string}` {
  if (typeof signature === "string") {
    return (signature.startsWith("0x") ? signature : `0x${signature}`) as `0x${string}`;
  }

  if (signature instanceof Uint8Array) {
    return bytesToHex(signature);
  }

  throw new Error("Unsupported signature type returned by signer");
}

export function splitSignature(signature: unknown): { v: number; r: `0x${string}`; s: `0x${string}` } {
  const hexSignature = normalizeSignatureHex(signature);
  const compactHexLength = 2 + 64 * 2;
  const standardHexLength = 2 + 65 * 2;

  // Handle EIP-2098 compact signatures (64 bytes).
  if (hexSignature.length === compactHexLength) {
    const raw = hexSignature.slice(2);
    const r = `0x${raw.slice(0, 64)}` as `0x${string}`;
    const vs = BigInt(`0x${raw.slice(64)}`);
    const yParity = Number(vs >> BigInt(255));
    const sMask = (BigInt(1) << BigInt(255)) - BigInt(1);
    const s = padToBytes32(`0x${(vs & sMask).toString(16)}` as `0x${string}`);
    return {
      v: 27 + yParity,
      r,
      s,
    };
  }

  // Handle standard 65-byte signatures directly (r + s + v).
  if (hexSignature.length === standardHexLength) {
    const raw = hexSignature.slice(2);
    const r = `0x${raw.slice(0, 64)}` as `0x${string}`;
    const s = `0x${raw.slice(64, 128)}` as `0x${string}`;
    const vRaw = Number.parseInt(raw.slice(128, 130), 16);
    const v = vRaw < 27 ? vRaw + 27 : vRaw;

    if (v !== 27 && v !== 28) {
      throw new Error("Invalid signature v value");
    }

    return {
      v,
      r: padToBytes32(r),
      s: padToBytes32(s),
    };
  }

  try {
    const parsed = parseSignature(hexSignature);
    const resolvedV =
      parsed.v ?? (parsed.yParity === 0 ? 27 : parsed.yParity === 1 ? 28 : undefined);

    if (resolvedV === undefined) {
      throw new Error("Unable to resolve signature v");
    }

    const numericV = typeof resolvedV === "bigint" ? Number(resolvedV) : resolvedV;
    const v = numericV < 27 ? numericV + 27 : numericV;

    return {
      v,
      r: padToBytes32(parsed.r),
      s: padToBytes32(parsed.s),
    };
  } catch {
    throw new Error(
      "Invalid signature format for permit. Please sign with the connected MetaMask EOA and retry.",
    );
  }
}

export function to65ByteSignatureHex(signature: unknown): `0x${string}` {
  const parts = splitSignature(signature);
  const vByte = vToByte(parts.v);
  return `${parts.r}${parts.s.slice(2)}${vByte}` as `0x${string}`;
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

  // Support both contract variants used in this repo:
  // - nextAgreementId()/agreements(uint256) (PayCrow.sol)
  // - projectCount()/projects(uint256) (legacy)
  try {
    return await readContract({
      contract: escrowContract,
      method: "function nextAgreementId() view returns (uint256)",
    });
  } catch {
    return readContract({
      contract: escrowContract,
      method: "function projectCount() view returns (uint256)",
    });
  }
}

export async function getProjectById(client: ThirdwebClient, projectId: bigint): Promise<OnchainProject> {
  const escrowContract = getEscrowContract(client);
  try {
    const agreementResult = await readContract({
      contract: escrowContract,
      method:
        "function agreements(uint256) view returns (address client, address freelancer, uint256 totalAmount, uint256 releasedAmount, uint256 clientRefId, bool isFunded, bool isCompleted)",
      params: [projectId],
    });

    const [clientAddress, freelancerAddress, totalAmount, releasedAmount, clientRefId, isFunded, isCompleted] =
      agreementResult as [string, string, bigint, bigint, bigint, boolean, boolean];

    return {
      projectId,
      client: clientAddress,
      freelancer: freelancerAddress,
      amount: totalAmount,
      releasedAmount: releasedAmount,
      clientRefId,
      isFunded,
      isCompleted,
    };
  } catch {
    try {
      const agreementResultLegacy = await readContract({
        contract: escrowContract,
        method:
          "function agreements(uint256) view returns (address client, address freelancer, uint256 totalAmount, uint256 releasedAmount, bool isFunded, bool isCompleted)",
        params: [projectId],
      });

      const [clientAddress, freelancerAddress, totalAmount, releasedAmount, isFunded, isCompleted] =
        agreementResultLegacy as [string, string, bigint, bigint, boolean, boolean];

      return {
        projectId,
        client: clientAddress,
        freelancer: freelancerAddress,
        amount: totalAmount,
        releasedAmount: releasedAmount,
        clientRefId: BigInt(0),
        isFunded,
        isCompleted,
      };
    } catch {
      const projectResult = await readContract({
        contract: escrowContract,
        method:
          "function projects(uint256) view returns (address client, address freelancer, uint256 amount, bool isFunded, bool isCompleted)",
        params: [projectId],
      });

      const [clientAddress, freelancerAddress, amount, isFunded, isCompleted] = projectResult as [
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
        amount: amount,
        releasedAmount: BigInt(0),
        clientRefId: BigInt(0),
        isFunded,
        isCompleted,
      };
    }
  }
}

export async function getProjectIdByClientRef(
  client: ThirdwebClient,
  clientAddress: string,
  clientRefId: bigint,
): Promise<bigint> {
  const escrowContract = getEscrowContract(client);
  return readContract({
    contract: escrowContract,
    method: "function getAgreementIdByClientRef(address _client, uint256 _clientRefId) view returns (uint256)",
    params: [clientAddress, clientRefId],
  });
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

  // Iterate newest-first while being robust to both 0-based and 1-based IDs.
  for (let id = count; id > BigInt(0) && projects.length < maxItems; id--) {
    try {
      const project = await getProjectById(client, id);
      if (project.client.toLowerCase() === clientAddress.toLowerCase()) {
        projects.push(project);
      }
    } catch {
      // Ignore invalid IDs for the currently deployed contract shape.
    }
  }

  if (projects.length < maxItems) {
    try {
      const zeroProject = await getProjectById(client, BigInt(0));
      if (zeroProject.client.toLowerCase() === clientAddress.toLowerCase()) {
        projects.push(zeroProject);
      }
    } catch {
      // Contract might be 1-based or ID 0 may not exist.
    }
  }

  return projects;
}

// ── Address formatting ─────────────────────────────────────────────────────
export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
