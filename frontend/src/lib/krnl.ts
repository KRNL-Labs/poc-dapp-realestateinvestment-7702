import { createConfig } from '@krnl-dev/sdk-react';
import { sepolia } from 'viem/chains';

// Get environment variables with fallbacks for development
const contractAddress = import.meta.env.VITE_DELEGATED_ACCOUNT_ADDRESS as string || '0x0000000000000000000000000000000000000000';
const privyAppId = import.meta.env.VITE_PRIVY_APP_ID as string || 'development';
const krnlNodeUrl = import.meta.env.VITE_KRNL_NODE_URL as string || 'https://v0-1-0.node.lat/';

// Create KRNL config with viem chain
export const config = createConfig({
  chain: sepolia,
  contractAddress,
  privyAppId,
  krnlNodeUrl
  // rpcUrl is optional - if not provided, will use Privy RPC
});