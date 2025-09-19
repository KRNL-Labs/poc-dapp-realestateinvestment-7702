import { isPrivyEmbeddedWallet, type PrivyEmbeddedWallet } from '../src/types';

describe('Type Guards', () => {
  describe('isPrivyEmbeddedWallet', () => {
    it('should return true for valid Privy embedded wallet', () => {
      const validWallet: PrivyEmbeddedWallet = {
        address: '0x1234567890123456789012345678901234567890',
        connectorType: 'embedded',
        walletClientType: 'privy',
        chainId: 'eip155:1',
        getEthereumProvider: jest.fn().mockResolvedValue({}),
        switchChain: jest.fn().mockResolvedValue(undefined)
      };

      expect(isPrivyEmbeddedWallet(validWallet)).toBe(true);
    });

    it('should return false for wallet with wrong connectorType', () => {
      const invalidWallet = {
        address: '0x1234567890123456789012345678901234567890',
        connectorType: 'external',
        walletClientType: 'privy',
        getEthereumProvider: jest.fn().mockResolvedValue({})
      };

      expect(isPrivyEmbeddedWallet(invalidWallet)).toBe(false);
    });

    it('should return false for wallet with wrong walletClientType', () => {
      const invalidWallet = {
        address: '0x1234567890123456789012345678901234567890',
        connectorType: 'embedded',
        walletClientType: 'metamask',
        getEthereumProvider: jest.fn().mockResolvedValue({})
      };

      expect(isPrivyEmbeddedWallet(invalidWallet)).toBe(false);
    });

    it('should return false for wallet without address', () => {
      const invalidWallet = {
        connectorType: 'embedded',
        walletClientType: 'privy',
        getEthereumProvider: jest.fn().mockResolvedValue({})
      };

      expect(isPrivyEmbeddedWallet(invalidWallet)).toBe(false);
    });

    it('should return false for wallet without getEthereumProvider function', () => {
      const invalidWallet = {
        address: '0x1234567890123456789012345678901234567890',
        connectorType: 'embedded',
        walletClientType: 'privy'
      };

      expect(isPrivyEmbeddedWallet(invalidWallet)).toBe(false);
    });

    it('should return false for null input', () => {
      expect(isPrivyEmbeddedWallet(null)).toBe(false);
    });

    it('should return false for undefined input', () => {
      expect(isPrivyEmbeddedWallet(undefined)).toBe(false);
    });

    it('should return false for non-object input', () => {
      expect(isPrivyEmbeddedWallet('string')).toBe(false);
      expect(isPrivyEmbeddedWallet(123)).toBe(false);
      expect(isPrivyEmbeddedWallet([])).toBe(false);
    });

    it('should return true even without optional properties', () => {
      const validWallet = {
        address: '0x1234567890123456789012345678901234567890',
        connectorType: 'embedded',
        walletClientType: 'privy',
        getEthereumProvider: jest.fn().mockResolvedValue({})
        // Missing optional switchChain and chainId
      };

      expect(isPrivyEmbeddedWallet(validWallet)).toBe(true);
    });
  });
});