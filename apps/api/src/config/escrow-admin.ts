import { createPublicClient, createWalletClient, Hex, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

const rpcUrl = process.env.SEPOLIA_RPC_URL;
const adminPrivateKey = process.env.ESCROW_ADMIN_PRIVATE_KEY as Hex | undefined;
const defaultEscrowAddress = '0xfAe88C3dEd51A1d34b819Aec973C28D8F17059eB';
const escrowContractAddress =
  (process.env.ESCROW_CONTRACT_ADDRESS || defaultEscrowAddress) as `0x${string}`;

const escrowAbi = [
  {
    type: 'function',
    name: 'agreements',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'client', type: 'address' },
      { name: 'freelancer', type: 'address' },
      { name: 'totalAmount', type: 'uint256' },
      { name: 'releasedAmount', type: 'uint256' },
      { name: 'clientRefId', type: 'uint256' },
      { name: 'isFunded', type: 'bool' },
      { name: 'isCompleted', type: 'bool' },
    ],
  },
  {
    type: 'function',
    name: 'adminResolveRelease',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_id', type: 'uint256' },
      { name: '_amount', type: 'uint256' },
      { name: '_recipient', type: 'address' },
    ],
    outputs: [],
  },
] as const;

const isHexAddress = (value: string | undefined): value is `0x${string}` =>
  Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value));

const isHexPrivateKey = (value: string | undefined): value is Hex =>
  Boolean(value && /^0x[a-fA-F0-9]{64}$/.test(value));

export type OnchainEscrowAgreement = {
  client: `0x${string}`;
  freelancer: `0x${string}`;
  totalAmount: bigint;
  releasedAmount: bigint;
  clientRefId: bigint;
  isFunded: boolean;
  isCompleted: boolean;
};

const getEscrowClients = () => {
  if (!rpcUrl) {
    throw new Error('SEPOLIA_RPC_URL is not configured');
  }

  if (!isHexPrivateKey(adminPrivateKey)) {
    throw new Error('ESCROW_ADMIN_PRIVATE_KEY is missing or invalid');
  }

  if (!isHexAddress(escrowContractAddress)) {
    throw new Error('ESCROW_CONTRACT_ADDRESS is missing or invalid');
  }

  const account = privateKeyToAccount(adminPrivateKey);
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  });

  return {
    publicClient,
    walletClient,
    escrowAddress: escrowContractAddress,
  };
};

export function isEscrowAdminConfigured() {
  return Boolean(rpcUrl && isHexPrivateKey(adminPrivateKey) && isHexAddress(escrowContractAddress));
}

export async function getEscrowAgreementOnchain(agreementId: bigint): Promise<OnchainEscrowAgreement> {
  const { publicClient, escrowAddress } = getEscrowClients();

  try {
    const result = await publicClient.readContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: 'agreements',
      args: [agreementId],
    });

    const [client, freelancer, totalAmount, releasedAmount, clientRefId, isFunded, isCompleted] = result as [
      `0x${string}`,
      `0x${string}`,
      bigint,
      bigint,
      bigint,
      boolean,
      boolean,
    ];

    return {
      client,
      freelancer,
      totalAmount,
      releasedAmount,
      clientRefId,
      isFunded,
      isCompleted,
    };
  } catch {
    const legacyResult = await publicClient.readContract({
      address: escrowAddress,
      abi: [
        {
          type: 'function',
          name: 'agreements',
          stateMutability: 'view',
          inputs: [{ name: '', type: 'uint256' }],
          outputs: [
            { name: 'client', type: 'address' },
            { name: 'freelancer', type: 'address' },
            { name: 'totalAmount', type: 'uint256' },
            { name: 'releasedAmount', type: 'uint256' },
            { name: 'isFunded', type: 'bool' },
            { name: 'isCompleted', type: 'bool' },
          ],
        },
      ] as const,
      functionName: 'agreements',
      args: [agreementId],
    });

    const [client, freelancer, totalAmount, releasedAmount, isFunded, isCompleted] = legacyResult as [
      `0x${string}`,
      `0x${string}`,
      bigint,
      bigint,
      boolean,
      boolean,
    ];

    return {
      client,
      freelancer,
      totalAmount,
      releasedAmount,
      clientRefId: BigInt(0),
      isFunded,
      isCompleted,
    };
  }
}

export async function releaseEscrowFundsAsAdmin(params: {
  agreementId: bigint;
  amountBaseUnits: bigint;
  recipientAddress: `0x${string}`;
}) {
  const { agreementId, amountBaseUnits, recipientAddress } = params;
  const { publicClient, walletClient, escrowAddress } = getEscrowClients();

  const txHash = await walletClient.writeContract({
    address: escrowAddress,
    abi: escrowAbi,
    functionName: 'adminResolveRelease',
    args: [agreementId, amountBaseUnits, recipientAddress],
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}
