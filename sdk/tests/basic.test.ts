import { isPrivyEmbeddedWallet } from '../src/types';
import { createConfig, chains } from '../src/config';

describe('Basic SDK Functionality', () => {
  describe('Type Guards', () => {
    it('should validate Privy embedded wallets correctly', () => {
      const validWallet = {
        address: '0x1234567890123456789012345678901234567890',
        connectorType: 'embedded',
        walletClientType: 'privy',
        getEthereumProvider: jest.fn()
      };

      expect(isPrivyEmbeddedWallet(validWallet)).toBe(true);
      expect(isPrivyEmbeddedWallet(null)).toBe(false);
      expect(isPrivyEmbeddedWallet(undefined)).toBe(false);

      const invalidWallet = {
        address: '0x1234567890123456789012345678901234567890',
        connectorType: 'external',
        walletClientType: 'privy',
        getEthereumProvider: jest.fn()
      };

      expect(isPrivyEmbeddedWallet(invalidWallet)).toBe(false);
    });
  });

  describe('Configuration', () => {
    it('should create valid configuration', () => {
      const config = createConfig({
        chains: [chains.sepolia('0x1234567890123456789012345678901234567890')]
      });

      expect(config).toBeDefined();
      expect(config.config.chainId).toBe(11155111);
      expect(config.authConfig.contractAddress).toBe('0x1234567890123456789012345678901234567890');
      expect(config.sdkConfig.chainId).toBe(11155111);
    });

    it('should handle multiple chains', () => {
      const config = createConfig({
        chains: [
          chains.sepolia('0x1234567890123456789012345678901234567890'),
          chains.localhost('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')
        ],
        defaultChainId: 31337
      });

      expect(config.config.chainId).toBe(31337);
      expect(config.authConfig.contractAddress).toBe('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');
    });
  });

  describe('Chain Configurations', () => {
    it('should create Sepolia configuration', () => {
      const sepolia = chains.sepolia('0x1234567890123456789012345678901234567890');

      expect(sepolia.chainId).toBe(11155111);
      expect(sepolia.contractAddress).toBe('0x1234567890123456789012345678901234567890');
      expect(sepolia.rpcUrl).toContain('sepolia');
    });

    it('should create localhost configuration', () => {
      const localhost = chains.localhost('0x1234567890123456789012345678901234567890');

      expect(localhost.chainId).toBe(31337);
      expect(localhost.contractAddress).toBe('0x1234567890123456789012345678901234567890');
      expect(localhost.rpcUrl).toBe('http://127.0.0.1:8545');
    });
  });
});