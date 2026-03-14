import { createOpenAI } from '@ai-sdk/openai';
import { convertToModelMessages, streamText, UIMessage } from 'ai';
import { z } from 'zod';
import { getProjectsForClient } from '@/lib/escrow';
import { thirdwebClient } from '@/lib/thirdweb-client';

export const maxDuration = 30;

const errorToMessage = (error: unknown) => {
  if (error == null) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return JSON.stringify(error);
};

// @ts-ignore - 'compatibility' option is valid in runtime but missing in type defs for this version
const featherless = createOpenAI({
  baseURL: 'https://api.featherless.ai/v1',
  apiKey: process.env.FEATHERLESS_API_KEY || '',
  // CRITICAL: Featherless only supports /v1/chat/completions, NOT /v1/responses
  // 'strict' overrides ai-sdk's default routing behavior to newer endpoints
  compatibility: 'strict',
} as any);

export async function POST(req: Request) {
  try {
    if (!process.env.FEATHERLESS_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Missing FEATHERLESS_API_KEY on server' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json() as { messages: UIMessage[]; walletAddress?: string };
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const walletAddress = typeof body.walletAddress === 'string' && body.walletAddress.length > 0
      ? body.walletAddress
      : undefined;

    const result = streamText({
      model: featherless.chat('Qwen/Qwen2.5-72B-Instruct'),
      messages: await convertToModelMessages(messages),
      system: `
        You are the PayCrow Web3 Escrow Copilot called "Nexus Intelligence".
        Your job is to help the user manage their smart contract escrow agreements on the Sepolia testnet.
        The user's current wallet address is: ${walletAddress || 'NOT CONNECTED'}.
        Always pass this address into tools that require an address parameter.
        Be concise, helpful, and format financial amounts beautifully (e.g. "500 PUSD").
        If the user asks if they are connected, or asks to connect their wallet, VERY IMPORTANT: use the get_wallet_status tool.
        If the user asks to release funds or pay a milestone, use the prepare_release tool.
        If the user asks to create or draft a new agreement, use the draft_agreement tool.
      `,
      tools: {
        get_wallet_status: {
          description: "Get the connection status and address of the user's Web3 wallet",
          inputSchema: z.object({}),
          execute: async () => {
            if (!walletAddress) {
              return { 
                status: 'disconnected', 
                message: 'User is not connected.',
                action: 'RENDER_UI_BUTTON',
                component: 'ConnectWalletButton',
                props: {}
              };
            }
            return { status: 'connected', network: 'Sepolia Testnet', address: walletAddress };
          },
        },

        list_agreements: {
          description: 'Fetch active on-chain escrow agreements for the connected user',
          inputSchema: z.object({}),
          execute: async () => {
            if(!walletAddress) {
               return { success: false, error: "No wallet connected. Please run `get_wallet_status` first to prompt the user to connect." };
            }
            try {
              console.log('[Copilot] Fetching agreements for:', walletAddress);
              const projects = await getProjectsForClient(thirdwebClient, walletAddress, 10);
              const formatted = projects.map((p) => ({
                id: p.projectId.toString(),
                freelancer: p.freelancer,
                totalAmount_PUSD: (Number(p.amount) / 1_000_000).toFixed(2),
                releasedAmount_PUSD: (Number(p.releasedAmount) / 1_000_000).toFixed(2),
                status: p.isCompleted ? 'COMPLETED' : p.isFunded ? 'FUNDED' : 'PENDING',
              }));
              return { success: true, count: formatted.length, agreements: formatted };
            } catch (err: unknown) {
              return { success: false, error: (err as Error).message };
            }
          },
        },

        prepare_release: {
          description: 'Prepare a smart contract transaction to release milestone funds. Use when the user wants to pay/release funds.',
          inputSchema: z.object({
            projectId: z.number(),
            amount_PUSD: z.number(),
          }),
          execute: async (args: { projectId: number; amount_PUSD: number }) => {
            return {
              action: 'RENDER_UI_BUTTON',
              component: 'ReleaseMilestoneButton',
              props: { projectId: args.projectId, amount_PUSD: args.amount_PUSD },
            };
          },
        },

        draft_agreement: {
          description: "Draft a new escrow agreement from the user's idea. Use when the user wants to create a new agreement.",
          inputSchema: z.object({
            project_idea: z.string(),
          }),
          execute: async (args: { project_idea: string }) => {
            return {
              action: 'RENDER_UI_BUTTON',
              component: 'DraftAgreementButton',
              props: { project_idea: args.project_idea },
            };
          },
        },
      },
    });

    // v6: toUIMessageStreamResponse() is required for useChat compatibility
    return result.toUIMessageStreamResponse({
      onError: errorToMessage,
    });
  } catch (error: unknown) {
    console.error('[Copilot API Error]', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
