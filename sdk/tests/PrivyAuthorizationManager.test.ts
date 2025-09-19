import { PrivyAuthorizationManager } from '../src/auth/PrivyAuthorizationManager';
import type { PrivyEmbeddedWallet, AuthorizationConfig, PrivySignAuthorizationFunction } from '../src/types';
import type { WasmInstance } from '../src/wasm/WasmInitializer';

// Mock WASM utilities
const mockWasmUtilities: WasmInstance = {
  makeUnsignTx: jest.fn().mockReturnValue({
    signHash: '0xabcdef1234567890',
    unsignedTx: '0x1234567890abcdef'
  }),
  compileUnsignTxWithSignature: jest.fn().mockReturnValue({
    signedTx: '0xfedcba0987654321'
  }),
  isInitialized: true
};

describe('PrivyAuthorizationManager Core Tests', () => {
  let authManager: PrivyAuthorizationManager;
  let mockAuthConfig: AuthorizationConfig;
  let mockSignAuthorization: jest.MockedFunction<PrivySignAuthorizationFunction>;
  let mockWallet: PrivyEmbeddedWallet;
  let mockProvider: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthConfig = {
      contractAddress: '0x1234567890123456789012345678901234567890',
      chainId: 11155111,
      rpcUrl: 'https://sepolia.infura.io/v3/PROJECT_ID'
    };

    mockSignAuthorization = jest.fn().mockResolvedValue({
      r: '0xabc123',
      s: '0xdef456',
      v: 27
    });

    mockProvider = {
      request: jest.fn().mockResolvedValue('0x1234567890abcdef')
    };

    mockWallet = {
      address: '0x9876543210987654321098765432109876543210',
      connectorType: 'embedded',
      walletClientType: 'privy',
      chainId: 'eip155:11155111',
      getEthereumProvider: jest.fn().mockResolvedValue(mockProvider),
      switchChain: jest.fn().mockResolvedValue(undefined)
    };

    authManager = new PrivyAuthorizationManager(mockAuthConfig, mockWasmUtilities, mockSignAuthorization);
  });

  describe('checkPrivyAuthorizationStatus', () => {
    it('should validate wallet type before checking status', async () => {
      const invalidWallet = {
        address: '0x123',
        connectorType: 'external',
        walletClientType: 'privy',
        getEthereumProvider: jest.fn()
      } as any;

      await expect(
        authManager.checkPrivyAuthorizationStatus(invalidWallet)
      ).rejects.toThrow('Invalid wallet: Expected Privy embedded wallet');
    });

    it('should return authorization status for smart account enabled wallet', async () => {
      const result = await authManager.checkPrivyAuthorizationStatus(mockWallet);

      expect(result).toEqual({
        isAuthorized: false,
        smartAccountEnabled: true,
        contractAddress: mockAuthConfig.contractAddress
      });

      expect(mockProvider.request).toHaveBeenCalledWith({
        method: 'eth_getCode',
        params: [mockWallet.address, 'latest']
      });
    });
  });

  describe('enablePrivySmartAccount', () => {
    it('should validate wallet type before enabling smart account', async () => {
      const invalidWallet = {
        address: '0x123',
        connectorType: 'embedded',
        walletClientType: 'metamask',
        getEthereumProvider: jest.fn()
      } as any;

      await expect(
        authManager.enablePrivySmartAccount(invalidWallet)
      ).rejects.toThrow('Invalid wallet: Expected Privy embedded wallet');
    });

    it('should handle WASM compilation errors', async () => {
      (mockWasmUtilities.makeUnsignTx as jest.Mock).mockReturnValue({
        error: 'WASM compilation error'
      });

      const result = await authManager.enablePrivySmartAccount(mockWallet);

      expect(result.success).toBe(false);
      expect(result.error).toContain('WASM compilation error');
    });
  });
});