import { PrivyAuthorizationManager } from './auth/PrivyAuthorizationManager';
import { initializeWasm, WasmInstance } from './wasm/WasmInitializer';
import {
  SDKConfig,
  AuthorizationConfig,
  PrivyEmbeddedWallet,
  PrivyAuthorizationResult,
  PrivyAuthorizationStatus,
  PrivySignAuthorizationFunction,
  isPrivyEmbeddedWallet
} from './types';

/**
 * KRNL Delegated Account SDK with Privy Integration
 *
 * This SDK provides a clean interface for managing delegated accounts on the KRNL platform
 * using Privy wallets for authentication and EIP-7702 authorization.
 */
export class KRNLDelegatedAccountSDK {
  private authManager: PrivyAuthorizationManager | null = null;
  private config: SDKConfig;
  private authConfig: AuthorizationConfig;
  private signAuthorization: PrivySignAuthorizationFunction;
  private wasmInstance: WasmInstance | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(
    authConfig: AuthorizationConfig,
    signAuthorization: PrivySignAuthorizationFunction,
    config: SDKConfig = {}
  ) {
    this.authConfig = authConfig;
    this.signAuthorization = signAuthorization;
    this.config = {
      chainId: 11155111, // Sepolia default
      ...config
    };
  }

  /**
   * Initialize the SDK with WASM support
   * Must be called before using any SDK methods
   */
  async initialize(wasmPath?: string, execPath?: string): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.initializeInternal(wasmPath, execPath);
    await this.initPromise;
  }

  private async initializeInternal(wasmPath?: string, execPath?: string): Promise<void> {
    this.wasmInstance = await initializeWasm(wasmPath, execPath);
    this.authManager = new PrivyAuthorizationManager(
      this.authConfig,
      this.wasmInstance,
      this.signAuthorization
    );
  }

  private ensureInitialized(): void {
    if (!this.authManager || !this.wasmInstance) {
      throw new Error('SDK not initialized. Call initialize() first.');
    }
  }

  /**
   * Check if a Privy wallet is authorized for EIP-7702 smart account functionality
   *
   * @param privyWallet - The Privy embedded wallet to check
   * @returns Promise<PrivyAuthorizationStatus> - Authorization status
   *
   * @example
   * ```typescript
   * const status = await sdk.checkPrivyWalletAuthorization(privyWallet);
   * if (status.isAuthorized) {
   *   console.log('Privy wallet is authorized for smart account features');
   * }
   * ```
   */
  async checkPrivyWalletAuthorization(privyWallet: PrivyEmbeddedWallet): Promise<PrivyAuthorizationStatus> {
    if (!isPrivyEmbeddedWallet(privyWallet)) {
      throw new Error('Invalid wallet: Expected Privy embedded wallet with connectorType="embedded" and walletClientType="privy"');
    }
    this.ensureInitialized();
    return this.authManager!.checkPrivyAuthorizationStatus(privyWallet);
  }

  /**
   * Enable smart account functionality for a Privy wallet using EIP-7702
   *
   * This method will:
   * 1. Create an authorization signature using Privy
   * 2. Build and sign the EIP-7702 transaction
   * 3. Broadcast the transaction to enable smart account features
   * 4. Wait for confirmation
   *
   * @param privyWallet - The Privy embedded wallet to enable smart account for
   * @returns Promise<PrivyAuthorizationResult> - Result of the authorization process
   *
   * @example
   * ```typescript
   * const result = await sdk.enablePrivySmartAccount(privyWallet);
   * if (result.success) {
   *   console.log(`Smart account enabled! TX: ${result.transactionHash}`);
   * } else {
   *   console.error(`Failed to enable: ${result.error}`);
   * }
   * ```
   */
  async enablePrivySmartAccount(privyWallet: PrivyEmbeddedWallet): Promise<PrivyAuthorizationResult> {
    if (!isPrivyEmbeddedWallet(privyWallet)) {
      throw new Error('Invalid wallet: Expected Privy embedded wallet with connectorType="embedded" and walletClientType="privy"');
    }
    this.ensureInitialized();
    return this.authManager!.enablePrivySmartAccount(privyWallet);
  }

  /**
   * Validate that a Privy wallet meets requirements for the SDK
   *
   * @param wallet - Wallet object to validate
   * @returns boolean - True if wallet is a valid Privy embedded wallet
   */
  static validatePrivyWallet(wallet: any): wallet is PrivyEmbeddedWallet {
    return (
      wallet &&
      wallet.address &&
      wallet.connectorType === 'embedded' &&
      wallet.walletClientType === 'privy' &&
      typeof wallet.getEthereumProvider === 'function' &&
      typeof wallet.switchChain === 'function'
    );
  }

  /**
   * Get the current SDK configuration
   */
  getConfig(): SDKConfig {
    return { ...this.config };
  }
}