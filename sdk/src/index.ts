/**
 * KRNL Delegated Account SDK with Privy Integration
 *
 * A TypeScript SDK for managing delegated accounts on the KRNL platform
 * using Privy wallets for authentication and EIP-7702 account abstraction.
 *
 * @packageDocumentation
 */

// Core SDK
export { KRNLDelegatedAccountSDK } from './KRNLDelegatedAccountSDK';
export { PrivyAuthorizationManager } from './auth/PrivyAuthorizationManager';
export { initializeWasm, wasmInitializer } from './wasm/WasmInitializer';
export type { WasmInstance, UseWasmInitResult } from './wasm/WasmInitializer';

// Configuration & Provider
export { createConfig, chains } from './config';
export type { KRNLConfig, CreateConfigOptions, ConfiguredKRNLConfig } from './config';
export { KRNLProvider, useKRNL } from './provider/KRNLProvider';

// Hooks
export { useKRNLAuth } from './hooks';

export type {
  // Core SDK Types
  SDKConfig,
  AuthorizationConfig,

  // Privy Wallet Types
  PrivyWalletProvider,
  PrivyEmbeddedWallet,
  PrivySignAuthorizationFunction,

  // Authorization Types
  AuthorizationData,
  PrivyAuthorizationResult,
  PrivyAuthorizationStatus,

  // Transaction Types
  TransactionParams,

  // Utility Types
  WasmUtilities
} from './types';

// Export utility functions
export { isPrivyEmbeddedWallet } from './types';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  SEPOLIA_CHAIN_ID: 11155111,
  DEFAULT_GAS: 50000,
  DEFAULT_GAS_FEE_CAP: "20000000000",
  DEFAULT_GAS_TIP_CAP: "5000000000",
  CONFIRMATION_BLOCKS: 1,
  TIMEOUT_MS: 300000 // 5 minutes
} as const;