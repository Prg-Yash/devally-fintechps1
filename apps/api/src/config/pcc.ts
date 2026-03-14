import { createPublicClient, createWalletClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

const rpcUrl = process.env.SEPOLIA_RPC_URL;
const privateKey = process.env.PCC_DISTRIBUTOR_PRIVATE_KEY as `0x${string}` | undefined;
const pccContractAddress = process.env.PCC_CONTRACT_ADDRESS as `0x${string}` | undefined;

const pccAbi = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

export function isPccDistributorConfigured() {
  return Boolean(rpcUrl && privateKey && pccContractAddress);
}

export function getPccDistributorContractAddress() {
  return pccContractAddress;
}

export async function distributePccToWallet(walletAddress: `0x${string}`, pccAmount: number) {
  if (!isPccDistributorConfigured()) {
    throw new Error('PCC distributor is not configured. Set PCC_CONTRACT_ADDRESS, PCC_DISTRIBUTOR_PRIVATE_KEY, and SEPOLIA_RPC_URL.');
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  });

  const amountInBaseUnits = parseUnits(pccAmount.toFixed(6), 6);

  const txHash = await walletClient.writeContract({
    address: pccContractAddress as `0x${string}`,
    abi: pccAbi,
    functionName: 'mint',
    args: [walletAddress, amountInBaseUnits],
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}
