import { CHAIN_CONFIG } from './constants';

/**
 * Formats an Ethereum address to shortened form
 * @param address - Full Ethereum address
 * @param chars - Number of characters to show at start and end (default: 6)
 * @returns Formatted address like "0x1234...5678"
 */
export const formatAddress = (address: string | undefined, chars = 6): string => {
  if (!address) return 'No address';
  if (address.length < chars * 2 + 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars + 2)}`;
};

/**
 * Formats a balance value with appropriate decimal places
 * @param balance - Balance value as string or number
 * @param decimals - Number of decimal places to show (default: 4)
 * @returns Formatted balance string
 */
export const formatBalance = (balance: string | number | undefined, decimals = 4): string => {
  if (balance === undefined || balance === null) return '0';

  const num = typeof balance === 'string' ? parseFloat(balance) : balance;
  if (isNaN(num)) return '0';

  // For very small numbers, use exponential notation
  if (num > 0 && num < 0.0001) {
    return num.toExponential(2);
  }

  // For normal numbers, use fixed decimal places
  return num.toFixed(decimals).replace(/\.?0+$/, '');
};

/**
 * Gets the chain name from chain ID
 * @param chainId - Numeric chain ID
 * @returns Human-readable chain name
 */
export const getChainName = (chainId: number | undefined): string => {
  if (!chainId) return 'Unknown Network';

  const chain = Object.values(CHAIN_CONFIG).find(c => c.id === chainId);
  return chain?.name || `Chain ${chainId}`;
};

/**
 * Gets the currency symbol for a chain
 * @param chainId - Numeric chain ID
 * @returns Currency symbol (ETH, MATIC, etc.)
 */
export const getChainCurrency = (chainId: number | undefined): string => {
  if (!chainId) return 'ETH';

  const chain = Object.values(CHAIN_CONFIG).find(c => c.id === chainId);
  return chain?.currency || 'ETH';
};

/**
 * Gets the explorer URL for an address on a specific chain
 * @param address - Ethereum address
 * @param chainId - Numeric chain ID
 * @returns Full explorer URL
 */
export const getExplorerUrl = (address: string, chainId: number): string => {
  const chain = Object.values(CHAIN_CONFIG).find(c => c.id === chainId);
  const baseUrl = chain?.explorerUrl || CHAIN_CONFIG.SEPOLIA.explorerUrl;
  return `${baseUrl}/address/${address}`;
};

/**
 * Gets the transaction explorer URL for a specific chain
 * @param txHash - Transaction hash
 * @param chainId - Numeric chain ID
 * @returns Full explorer URL for transaction
 */
export const getTxExplorerUrl = (txHash: string, chainId: number): string => {
  const chain = Object.values(CHAIN_CONFIG).find(c => c.id === chainId);
  const baseUrl = chain?.explorerUrl || CHAIN_CONFIG.SEPOLIA.explorerUrl;
  return `${baseUrl}/tx/${txHash}`;
};

/**
 * Formats a transaction hash to shortened form
 * @param hash - Full transaction hash
 * @param chars - Number of characters to show at start and end (default: 10)
 * @returns Formatted hash like "0x1234567890...1234567890"
 */
export const formatTxHash = (hash: string | undefined, chars = 10): string => {
  if (!hash) return 'No hash';
  if (hash.length < chars * 2 + 2) return hash;
  return `${hash.slice(0, chars)}...${hash.slice(-chars + 2)}`;
};

/**
 * Converts a value to BigInt string representation
 * @param value - Value to convert
 * @returns String representation of BigInt
 */
export const toBigIntString = (value: string | number | bigint): string => {
  return BigInt(value).toString();
};

/**
 * Formats a timestamp to human-readable date
 * @param timestamp - Unix timestamp (seconds or milliseconds)
 * @returns Formatted date string
 */
export const formatTimestamp = (timestamp: number | string): string => {
  const ts = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
  // Check if timestamp is in seconds (less than 10 billion) or milliseconds
  const date = new Date(ts < 10000000000 ? ts * 1000 : ts);
  return date.toLocaleString();
};

/**
 * Formats a percentage value
 * @param value - Percentage value (0-100)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted percentage string with % symbol
 */
export const formatPercentage = (value: number | string, decimals = 2): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0%';
  return `${num.toFixed(decimals)}%`;
};