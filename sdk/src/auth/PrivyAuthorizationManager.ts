import {
  AuthorizationConfig,
  PrivyEmbeddedWallet,
  PrivyAuthorizationResult,
  PrivyAuthorizationStatus,
  PrivySignAuthorizationFunction,
  TransactionParams,
  isPrivyEmbeddedWallet
} from '../types';
import { WasmInstance } from '../wasm/WasmInitializer';

export class PrivyAuthorizationManager {
  private config: AuthorizationConfig;
  private wasmUtils: WasmInstance;
  private signAuthorization: PrivySignAuthorizationFunction;

  constructor(
    config: AuthorizationConfig,
    wasmUtils: WasmInstance,
    signAuthorization: PrivySignAuthorizationFunction
  ) {
    this.config = config;
    this.wasmUtils = wasmUtils;
    this.signAuthorization = signAuthorization;
  }

  /**
   * Check if the Privy wallet is authorized for EIP-7702
   */
  async checkPrivyAuthorizationStatus(privyWallet: PrivyEmbeddedWallet): Promise<PrivyAuthorizationStatus> {
    if (!isPrivyEmbeddedWallet(privyWallet)) {
      throw new Error('Invalid wallet: Expected Privy embedded wallet with connectorType="embedded" and walletClientType="privy"');
    }
    try {
      const provider = await privyWallet.getEthereumProvider();

      const accountCode = await provider.request({
        method: 'eth_getCode',
        params: [privyWallet.address, 'latest']
      });

      const smartAccountEnabled = accountCode && accountCode !== '0x' && accountCode.length > 2;

      let isAuthorized = false;
      if (smartAccountEnabled && this.config.contractAddress) {
        const contractAddressWithoutPrefix = this.config.contractAddress.toLowerCase().slice(2);
        const accountCodeWithoutPrefix = accountCode.toLowerCase().slice(2);
        isAuthorized = accountCodeWithoutPrefix.includes(contractAddressWithoutPrefix);
      }

      return {
        isAuthorized,
        smartAccountEnabled,
        contractAddress: this.config.contractAddress
      };
    } catch (error) {
      return {
        isAuthorized: false,
        smartAccountEnabled: false,
        contractAddress: this.config.contractAddress
      };
    }
  }

  /**
   * Enable smart account authorization for Privy wallet using EIP-7702
   */
  async enablePrivySmartAccount(privyWallet: PrivyEmbeddedWallet): Promise<PrivyAuthorizationResult> {
    if (!isPrivyEmbeddedWallet(privyWallet)) {
      throw new Error('Invalid wallet: Expected Privy embedded wallet with connectorType="embedded" and walletClientType="privy"');
    }
    try {
      const provider = await privyWallet.getEthereumProvider();

      // Get current nonce
      const currentNonce = await provider.request({
        method: 'eth_getTransactionCount',
        params: [privyWallet.address, 'latest']
      });
      const authNonce = parseInt(currentNonce, 16);

      // Sign authorization using Privy
      const authorization = await this.signAuthorization({
        contractAddress: this.config.contractAddress as `0x${string}`,
        chainId: this.config.chainId,
        nonce: authNonce + 1
      }, {
        address: privyWallet.address
      });

      // Convert BigInts for JSON serialization
      const signedAuth = {
        ...this.convertBigInts(authorization),
        userAddr: privyWallet.address
      };

      // Prepare transaction parameters
      const params: TransactionParams = {
        chainId: this.config.chainId,
        nonce: authNonce,
        to: '0x0000000000000000000000000000000000000000',
        gas: 50000,
        gasFeeCap: "20000000000",
        gasTipCap: "5000000000",
        authList: [{
          chainId: signedAuth.chainId || this.config.chainId,
          address: signedAuth.contractAddress || this.config.contractAddress,
          nonce: signedAuth.nonce || authNonce,
          r: signedAuth.r,
          s: signedAuth.s,
          v: signedAuth.v && signedAuth.v >= 27 ? signedAuth.v - 27 : signedAuth.v
        }]
      };

      // Use WASM utilities to create unsigned transaction
      const unsignedTx = this.wasmUtils.makeUnsignTx(JSON.stringify(params));
      if (unsignedTx.error) {
        throw new Error(`WASM makeUnsignTx error: ${unsignedTx.error}`);
      }

      // Sign transaction hash using Privy
      const hashSignature = await provider.request({
        method: 'secp256k1_sign',
        params: [unsignedTx.signHash]
      });

      // Compile final signed transaction
      const compiledTx = this.wasmUtils.compileUnsignTxWithSignature(JSON.stringify({
        chainId: params.chainId,
        unsignedTx: unsignedTx.unsignedTx,
        signature: hashSignature,
      }));

      if (compiledTx.error) {
        throw new Error(`WASM compile error: ${compiledTx.error}`);
      }

      // Broadcast transaction
      const transactionHash = await provider.request({
        method: 'eth_sendRawTransaction',
        params: [compiledTx.signedTx]
      });

      // Wait for confirmation
      await this.waitForPrivyTransactionConfirmation(provider, transactionHash);

      return {
        success: true,
        transactionHash
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Wait for Privy transaction confirmation
   */
  private async waitForPrivyTransactionConfirmation(provider: any, txHash: string): Promise<void> {
    let receipt = null;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    while (!receipt && attempts < maxAttempts) {
      try {
        receipt = await provider.request({
          method: 'eth_getTransactionReceipt',
          params: [txHash]
        });

        if (receipt) {
          const currentBlock = await provider.request({
            method: 'eth_blockNumber',
            params: []
          });
          const blocksDifference = parseInt(currentBlock, 16) - parseInt(receipt.blockNumber, 16);

          if (blocksDifference >= 1) {
            break;
          } else {
            receipt = null;
          }
        }
      } catch {
        // Continue waiting
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }

    if (!receipt) {
      throw new Error('Transaction confirmation timeout');
    }
  }

  /**
   * Convert BigInt values to numbers for JSON serialization
   */
  private convertBigInts(obj: any): any {
    if (typeof obj === 'bigint') {
      return Number(obj);
    }
    if (typeof obj === 'object' && obj !== null) {
      const converted: any = {};
      for (const [key, value] of Object.entries(obj)) {
        converted[key] = this.convertBigInts(value);
      }
      return converted;
    }
    return obj;
  }
}