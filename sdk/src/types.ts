// SDK Types for KRNL Delegated Account Platform with Privy Integration

export interface AuthorizationConfig {
  contractAddress: string;
  chainId: number;
  rpcUrl?: string;
}

export interface PrivyWalletProvider {
  request: (params: { method: string; params?: any[] }) => Promise<any>;
  getEthereumProvider?: () => Promise<any>;
  address?: string;
}

export interface PrivyEmbeddedWallet {
  address: string;
  connectorType: string;
  walletClientType: string;
  chainId?: string;
  getEthereumProvider: () => Promise<PrivyWalletProvider>;
  switchChain?: (chainId: number) => Promise<void>;
}

export interface AuthorizationData {
  chainId: number;
  address: string; // Contract address in auth list
  nonce: number;
  r: string;
  s: string;
  v: number;
}

export interface TransactionParams {
  chainId: number;
  nonce: number;
  to: string;
  gas: number;
  gasFeeCap: string;
  gasTipCap: string;
  authList: AuthorizationData[];
}

export interface PrivyAuthorizationResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

export interface PrivyAuthorizationStatus {
  isAuthorized: boolean;
  smartAccountEnabled: boolean;
  contractAddress?: string;
}

export interface WasmUtilities {
  makeUnsignTx: (params: string) => { error?: string; signHash?: string; unsignedTx?: string };
  compileUnsignTxWithSignature: (params: string) => { error?: string; signedTx?: string };
}

export interface SDKConfig {
  chainId?: number;
  rpcUrl?: string;
  wasmUtilities?: WasmUtilities;
}

export interface PrivySignAuthorizationFunction {
  (params: { contractAddress: `0x${string}`; chainId: number; nonce: number }, wallet: { address: string }): Promise<any>;
}

/**
 * Type guard to check if a wallet is a Privy embedded wallet
 * @param wallet - The wallet to check
 * @returns True if the wallet is a Privy embedded wallet
 */
export const isPrivyEmbeddedWallet = (wallet: unknown): wallet is PrivyEmbeddedWallet => {
  const w = wallet as Record<string, unknown>;
  return w?.connectorType === 'embedded' &&
         w?.walletClientType === 'privy' &&
         typeof w?.address === 'string' &&
         typeof w?.getEthereumProvider === 'function';
};