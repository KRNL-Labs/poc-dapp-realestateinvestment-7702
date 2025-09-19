import { createConfig, chains } from '../../../sdk/src';

// Get contract address from environment
const contractAddress = import.meta.env.VITE_DELEGATED_ACCOUNT_ADDRESS as string;

if (!contractAddress) {
  throw new Error('VITE_DELEGATED_ACCOUNT_ADDRESS environment variable is required');
}

// Create KRNL config without signAuthorization
export const config = createConfig({
  chains: [
    chains.sepolia(contractAddress)
  ],
  defaultChainId: 11155111 // Sepolia
});