export interface ChainInfo {
  id: number;
  name: string;
  symbol: string;
  rpcUrls: string[];
  blockExplorerUrls: string[];
}

interface SwitchError extends Error {
  code?: number;
}

interface EthereumProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
}

export const CHAINS: Record<number, ChainInfo> = {
  1: {
    id: 1,
    name: 'Ethereum Mainnet',
    symbol: 'ETH',
    rpcUrls: ['https://mainnet.infura.io/v3/'],
    blockExplorerUrls: ['https://etherscan.io']
  },
  11155111: {
    id: 11155111,
    name: 'Sepolia Testnet', 
    symbol: 'SEP',
    rpcUrls: ['https://sepolia.infura.io/v3/'],
    blockExplorerUrls: ['https://sepolia.etherscan.io']
  },
  137: {
    id: 137,
    name: 'Polygon',
    symbol: 'MATIC',
    rpcUrls: ['https://polygon-rpc.com'],
    blockExplorerUrls: ['https://polygonscan.com']
  },
  8453: {
    id: 8453,
    name: 'Base',
    symbol: 'ETH',
    rpcUrls: ['https://mainnet.base.org'],
    blockExplorerUrls: ['https://basescan.org']
  }
};

export const getRequiredChainId = (): number => {
  const chainId = import.meta.env.VITE_CHAIN_ID as string;
  return chainId ? parseInt(chainId, 10) : 11155111;
};

export const getChainInfo = (chainId: number): ChainInfo => {
  return CHAINS[chainId] || {
    id: chainId,
    name: `Chain ${chainId}`,
    symbol: 'ETH',
    rpcUrls: [],
    blockExplorerUrls: []
  };
};

export const switchNetwork = async (provider: EthereumProvider, targetChainId: number): Promise<boolean> => {
  const chainInfo = getChainInfo(targetChainId);
  const hexChainId = `0x${targetChainId.toString(16)}`;
  
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hexChainId }],
    });
    return true;
  } catch (switchError) {
    const error = switchError as SwitchError;
    if (error.code === 4902) {
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: hexChainId,
            chainName: chainInfo.name,
            nativeCurrency: {
              name: chainInfo.symbol,
              symbol: chainInfo.symbol,
              decimals: 18,
            },
            rpcUrls: chainInfo.rpcUrls,
            blockExplorerUrls: chainInfo.blockExplorerUrls,
          }],
        });
        return true;
      } catch (addError) {
        console.error('Failed to add network:', addError);
        return false;
      }
    } else {
      console.error('Failed to switch network:', switchError);
      return false;
    }
  }
};