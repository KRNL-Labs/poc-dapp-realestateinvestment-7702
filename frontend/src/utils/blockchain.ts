import { ethers } from 'ethers';
import { CHAIN_CONFIG, DEFAULT_CHAIN, CONTRACT_ADDRESSES } from './constants';
import { logger } from './logger';

/**
 * Gets the RPC provider for a specific chain
 * @param chainId - Chain ID to get provider for
 * @returns JsonRpcProvider instance
 */
export const getProvider = (chainId?: number): ethers.JsonRpcProvider => {
  const chain = chainId
    ? Object.values(CHAIN_CONFIG).find(c => c.id === chainId)
    : DEFAULT_CHAIN;

  const rpcUrl = chain?.rpcUrl || DEFAULT_CHAIN.rpcUrl;
  return new ethers.JsonRpcProvider(rpcUrl);
};

/**
 * Waits for a transaction to be confirmed
 * @param txHash - Transaction hash to wait for
 * @param confirmations - Number of confirmations to wait for (default: 1)
 * @param provider - Optional provider, uses default if not provided
 * @returns Transaction receipt
 */
export const waitForTransaction = async (
  txHash: string,
  confirmations = 1,
  provider?: ethers.JsonRpcProvider
): Promise<ethers.TransactionReceipt | null> => {
  const _provider = provider || getProvider();

  try {
    logger.debug(`Waiting for transaction ${txHash} with ${confirmations} confirmations`);
    const receipt = await _provider.waitForTransaction(txHash, confirmations);
    logger.debug('Transaction confirmed:', receipt);
    return receipt;
  } catch (error) {
    logger.error('Error waiting for transaction:', error);
    throw error;
  }
};

/**
 * Gets the current block number
 * @param chainId - Chain ID to query
 * @returns Current block number
 */
export const getCurrentBlock = async (chainId?: number): Promise<number> => {
  const provider = getProvider(chainId);
  try {
    const blockNumber = await provider.getBlockNumber();
    logger.debug(`Current block on chain ${chainId}: ${blockNumber}`);
    return blockNumber;
  } catch (error) {
    logger.error('Error getting block number:', error);
    throw error;
  }
};

/**
 * Gets the balance of an address
 * @param address - Address to check balance for
 * @param chainId - Chain ID to query
 * @returns Balance in ETH (as string)
 */
export const getBalance = async (address: string, chainId?: number): Promise<string> => {
  const provider = getProvider(chainId);
  try {
    const balance = await provider.getBalance(address);
    const formatted = ethers.formatEther(balance);
    logger.debug(`Balance for ${address}: ${formatted} ETH`);
    return formatted;
  } catch (error) {
    logger.error('Error getting balance:', error);
    throw error;
  }
};

/**
 * Checks if an address has code (is a contract)
 * @param address - Address to check
 * @param chainId - Chain ID to query
 * @returns True if address is a contract
 */
export const isContract = async (address: string, chainId?: number): Promise<boolean> => {
  const provider = getProvider(chainId);
  try {
    const code = await provider.getCode(address);
    const hasCode = code !== '0x' && code.length > 2;
    logger.debug(`Address ${address} is contract: ${hasCode}`);
    return hasCode;
  } catch (error) {
    logger.error('Error checking contract code:', error);
    return false;
  }
};

/**
 * Gets transaction receipt with retry logic
 * @param txHash - Transaction hash
 * @param maxAttempts - Maximum number of attempts (default: 60)
 * @param delayMs - Delay between attempts in milliseconds (default: 5000)
 * @param provider - Optional provider
 * @returns Transaction receipt or null
 */
export const getTransactionReceiptWithRetry = async (
  txHash: string,
  maxAttempts = 60,
  delayMs = 5000,
  provider?: ethers.JsonRpcProvider
): Promise<ethers.TransactionReceipt | null> => {
  const _provider = provider || getProvider();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const receipt = await _provider.getTransactionReceipt(txHash);

      if (receipt) {
        const currentBlock = await _provider.getBlockNumber();
        const confirmations = currentBlock - receipt.blockNumber;

        if (confirmations >= 1) {
          logger.debug(`Transaction ${txHash} confirmed after ${attempt} attempts`);
          return receipt;
        }
      }
    } catch (error) {
      logger.debug(`Attempt ${attempt} failed for tx ${txHash}:`, error);
    }

    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delayMs));

      // Log progress every 12 attempts (1 minute with 5s delay)
      if (attempt % 12 === 0) {
        logger.log(`Still waiting for transaction ${txHash} (${Math.floor(attempt * delayMs / 60000)} minutes)`);
      }
    }
  }

  logger.warn(`Transaction ${txHash} not confirmed after ${maxAttempts} attempts`);
  return null;
};

/**
 * Creates a contract instance
 * @param contractName - Name of the contract from CONTRACT_ADDRESSES
 * @param abi - Contract ABI
 * @param signerOrProvider - Signer or provider instance
 * @returns Contract instance
 */
export const getContract = (
  contractName: keyof typeof CONTRACT_ADDRESSES,
  abi: any[],
  signerOrProvider?: ethers.Signer | ethers.Provider
): ethers.Contract => {
  const address = CONTRACT_ADDRESSES[contractName];

  if (!address) {
    throw new Error(`Contract address for ${contractName} not configured`);
  }

  const provider = signerOrProvider || getProvider();
  return new ethers.Contract(address, abi, provider);
};

/**
 * Validates an Ethereum address
 * @param address - Address to validate
 * @returns True if valid Ethereum address
 */
export const isValidAddress = (address: string): boolean => {
  try {
    ethers.getAddress(address);
    return true;
  } catch {
    return false;
  }
};

/**
 * Gets the checksum address
 * @param address - Address to convert to checksum format
 * @returns Checksum address or null if invalid
 */
export const getChecksumAddress = (address: string): string | null => {
  try {
    return ethers.getAddress(address);
  } catch {
    return null;
  }
};