import { KRNLDelegatedAccountSDK } from '../src/KRNLDelegatedAccountSDK';
import type { AuthorizationConfig, SDKConfig } from '../src/types';

// Mock the dependencies
jest.mock('../src/auth/PrivyAuthorizationManager');
jest.mock('../src/wasm/WasmInitializer', () => ({
  initializeWasm: jest.fn().mockResolvedValue({
    makeUnsignTx: jest.fn(),
    compileUnsignTxWithSignature: jest.fn(),
    isInitialized: true
  })
}));

describe('KRNLDelegatedAccountSDK Core Tests', () => {
  let sdk: KRNLDelegatedAccountSDK;
  let mockAuthConfig: AuthorizationConfig;
  let mockSdkConfig: SDKConfig;
  let mockSignAuthorization: jest.Mock;
  let mockInvalidWallet: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthConfig = {
      contractAddress: '0x1234567890123456789012345678901234567890',
      chainId: 11155111,
      rpcUrl: 'https://sepolia.infura.io/v3/PROJECT_ID'
    };

    mockSdkConfig = {
      chainId: 11155111,
      rpcUrl: 'https://sepolia.infura.io/v3/PROJECT_ID'
    };

    mockSignAuthorization = jest.fn().mockResolvedValue({
      r: '0xabc123',
      s: '0xdef456',
      v: 27
    });

    mockInvalidWallet = {
      address: '0x123',
      connectorType: 'external',
      walletClientType: 'privy',
      getEthereumProvider: jest.fn()
    };

    sdk = new KRNLDelegatedAccountSDK(mockAuthConfig, mockSignAuthorization, mockSdkConfig);
  });

  describe('wallet validation', () => {
    it('should validate wallet before checking authorization', async () => {
      await sdk.initialize('/path/to/wasm', '/path/to/wasm-exec');

      await expect(
        sdk.checkPrivyWalletAuthorization(mockInvalidWallet)
      ).rejects.toThrow('Invalid wallet: Expected Privy embedded wallet');
    });

    it('should validate wallet before enabling smart account', async () => {
      await sdk.initialize('/path/to/wasm', '/path/to/wasm-exec');

      await expect(
        sdk.enablePrivySmartAccount(mockInvalidWallet)
      ).rejects.toThrow('Invalid wallet: Expected Privy embedded wallet');
    });
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await sdk.initialize('/path/to/wasm', '/path/to/wasm-exec');

      expect(sdk.getConfig()).toEqual(mockSdkConfig);
    });

    it('should handle multiple initialization calls', async () => {
      await sdk.initialize('/path/to/wasm', '/path/to/wasm-exec');

      // Second initialization should not fail in mocked environment
      await sdk.initialize('/path/to/wasm', '/path/to/wasm-exec');

      expect(sdk.getConfig()).toEqual(mockSdkConfig);
    });
  });

  describe('getConfig', () => {
    it('should return copy of SDK configuration', () => {
      const config = sdk.getConfig();

      expect(config).toEqual(mockSdkConfig);
      expect(config).not.toBe(mockSdkConfig); // Should be a copy, not reference
    });
  });
});