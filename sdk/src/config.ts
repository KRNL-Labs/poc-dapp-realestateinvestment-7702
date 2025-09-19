import type { AuthorizationConfig, SDKConfig } from './types';

export interface KRNLConfig {
  /** Chain ID for the network */
  chainId: number;
  /** RPC URL for the network */
  rpcUrl?: string;
  /** Contract address for delegated accounts */
  contractAddress: string;
  /** WASM file path (optional, will use default if not provided) */
  wasmPath?: string;
  /** WASM exec file path (optional, will use default if not provided) */
  wasmExecPath?: string;
}

export interface CreateConfigOptions {
  /** Network configuration */
  chains: KRNLConfig[];
  /** Default chain ID to use */
  defaultChainId?: number;
}

export interface ConfiguredKRNLConfig {
  config: KRNLConfig;
  authConfig: AuthorizationConfig;
  sdkConfig: SDKConfig;
}

/**
 * Create configuration for KRNL Delegated Account SDK
 * Similar to wagmi's createConfig pattern
 */
export function createConfig(options: CreateConfigOptions): ConfiguredKRNLConfig {
  const { chains, defaultChainId } = options;

  if (chains.length === 0) {
    throw new Error('At least one chain configuration is required');
  }

  const targetChainId = defaultChainId || chains[0].chainId;
  const config = chains.find(chain => chain.chainId === targetChainId) || chains[0];

  const authConfig: AuthorizationConfig = {
    contractAddress: config.contractAddress,
    chainId: config.chainId,
    rpcUrl: config.rpcUrl
  };

  const sdkConfig: SDKConfig = {
    chainId: config.chainId,
    rpcUrl: config.rpcUrl
  };

  return {
    config,
    authConfig,
    sdkConfig
  };
}

/**
 * Pre-configured chain configurations
 */
export const chains = {
  sepolia: (contractAddress: string): KRNLConfig => ({
    chainId: 11155111,
    contractAddress,
    rpcUrl: 'https://sepolia.infura.io/v3/YOUR_API_KEY'
  }),

  localhost: (contractAddress: string): KRNLConfig => ({
    chainId: 31337,
    contractAddress,
    rpcUrl: 'http://127.0.0.1:8545'
  })
} as const;