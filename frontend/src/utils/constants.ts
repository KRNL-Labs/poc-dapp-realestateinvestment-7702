// Chain configurations
export const CHAIN_CONFIG = {
  SEPOLIA: {
    id: 11155111,
    name: 'Sepolia Testnet',
    currency: 'SEP',
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorerUrl: 'https://sepolia.etherscan.io',
  },
  MAINNET: {
    id: 1,
    name: 'Ethereum Mainnet',
    currency: 'ETH',
    rpcUrl: 'https://ethereum-rpc.publicnode.com',
    explorerUrl: 'https://etherscan.io',
  },
  POLYGON: {
    id: 137,
    name: 'Polygon',
    currency: 'MATIC',
    rpcUrl: 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
  },
  BASE: {
    id: 8453,
    name: 'Base',
    currency: 'ETH',
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
  },
  ARBITRUM: {
    id: 42161,
    name: 'Arbitrum One',
    currency: 'ETH',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
  },
  OPTIMISM: {
    id: 10,
    name: 'Optimism',
    currency: 'ETH',
    rpcUrl: 'https://mainnet.optimism.io',
    explorerUrl: 'https://optimistic.etherscan.io',
  },
} as const;

// Get default chain from environment or fallback to Sepolia
export const DEFAULT_CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID || '11155111');
export const DEFAULT_CHAIN = Object.values(CHAIN_CONFIG).find(
  chain => chain.id === DEFAULT_CHAIN_ID
) || CHAIN_CONFIG.SEPOLIA;

// Contract addresses from environment
export const CONTRACT_ADDRESSES = {
  DELEGATED_ACCOUNT: import.meta.env.VITE_DELEGATED_ACCOUNT_ADDRESS,
  MOCK_USDC: import.meta.env.VITE_MOCK_USDC_ADDRESS,
  REAL_ESTATE_INVESTMENT: import.meta.env.VITE_REAL_ESTATE_INVESTMENT_ADDRESS,
} as const;

// Fee configuration from environment
export const FEE_CONFIG = {
  MIN_EXCHANGE_RATE: BigInt(import.meta.env.VITE_MIN_EXCHANGE_RATE || '3000000000'),
  MAX_EXCHANGE_RATE: BigInt(import.meta.env.VITE_MAX_EXCHANGE_RATE || '4000000000'),
  MIN_FEE: BigInt(import.meta.env.VITE_MIN_FEE || '100000'),
  MAX_FEE: BigInt(import.meta.env.VITE_MAX_FEE || '5000000'),
} as const;

// Delegate owner from environment
export const DELEGATE_OWNER = import.meta.env.VITE_DELEGATE_OWNER;

// UI Constants
export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
} as const;

export const TOAST_DURATION = {
  SHORT: 2000,
  NORMAL: 3000,
  LONG: 5000,
} as const;

// Blockchain constants
export const BLOCK_LOOKBACK = 10000; // Number of blocks to look back for events
export const TX_CONFIRMATION_BLOCKS = 1; // Number of blocks to wait for tx confirmation
export const TX_POLLING_INTERVAL = 5000; // Milliseconds between tx status checks