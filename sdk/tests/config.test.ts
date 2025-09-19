import { createConfig, chains } from '../src/config';

describe('Configuration', () => {
  describe('createConfig', () => {
    it('should create config with single chain', () => {
      const config = createConfig({
        chains: [chains.sepolia('0x1234567890123456789012345678901234567890')],
        defaultChainId: 11155111
      });

      expect(config).toBeDefined();
      expect(config.config.chainId).toBe(11155111);
      expect(config.authConfig.chainId).toBe(11155111);
      expect(config.authConfig.contractAddress).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should create config with multiple chains', () => {
      const config = createConfig({
        chains: [
          chains.sepolia('0x1234567890123456789012345678901234567890'),
          {
            chainId: 1,
            contractAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            rpcUrl: 'https://mainnet.infura.io/v3/PROJECT_ID'
          }
        ],
        defaultChainId: 1
      });

      expect(config.config.chainId).toBe(1);
      expect(config.authConfig.chainId).toBe(1);
      expect(config.authConfig.contractAddress).toBe('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');
    });

    it('should default to first chain if no defaultChainId specified', () => {
      const config = createConfig({
        chains: [chains.sepolia('0x1234567890123456789012345678901234567890')]
      });

      expect(config.config.chainId).toBe(11155111);
      expect(config.authConfig.chainId).toBe(11155111);
    });

    it('should throw error for empty chains array', () => {
      expect(() => {
        createConfig({
          chains: []
        });
      }).toThrow('At least one chain configuration is required');
    });

    it('should include SDK config with proper defaults', () => {
      const config = createConfig({
        chains: [chains.sepolia('0x1234567890123456789012345678901234567890')]
      });

      expect(config.sdkConfig).toBeDefined();
      expect(config.sdkConfig.chainId).toBe(11155111);
      expect(config.sdkConfig.rpcUrl).toBe('https://sepolia.infura.io/v3/YOUR_API_KEY');
    });
  });

  describe('chains.sepolia', () => {
    it('should create Sepolia chain config with correct defaults', () => {
      const contractAddress = '0x1234567890123456789012345678901234567890';
      const sepoliaChain = chains.sepolia(contractAddress);

      expect(sepoliaChain.chainId).toBe(11155111);
      expect(sepoliaChain.rpcUrl).toBe('https://sepolia.infura.io/v3/YOUR_API_KEY');
      expect(sepoliaChain.contractAddress).toBe(contractAddress);
    });
  });
});