import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import delegatedAccountABI from '../contracts/Delegated7702Account.abi.json';

// Get configuration from environment variables
const CONTRACT_ADDRESSES = {
  DELEGATED_ACCOUNT: import.meta.env.VITE_DELEGATED_ACCOUNT_ADDRESS,
  MOCK_USDC: import.meta.env.VITE_MOCK_USDC_ADDRESS,
  REAL_ESTATE_INVESTMENT: import.meta.env.VITE_REAL_ESTATE_INVESTMENT_ADDRESS,
};

const FEE_CONFIG = {
  MIN_EXCHANGE_RATE: BigInt(import.meta.env.VITE_MIN_EXCHANGE_RATE || '2900000000000000000000'),
  MAX_EXCHANGE_RATE: BigInt(import.meta.env.VITE_MAX_EXCHANGE_RATE || '4000000000000000000000'),
  MIN_FEE: BigInt(import.meta.env.VITE_MIN_FEE || '100000'),
  MAX_FEE: BigInt(import.meta.env.VITE_MAX_FEE || '10000000'),
};

interface AccountConfig {
  owner: string;
  delegate: string;
  feeRecipient: string;
  minExchangeRate: bigint;
  maxExchangeRate: bigint;
  minRequiredFee: bigint;
  maxFeePerTransaction: bigint;
  initialDestinations: string[];
  destinationStatuses: boolean[];
}

export const useDelegatedAccount = () => {
  const { user, sendTransaction } = usePrivy();
  const { wallets } = useWallets();
  const [isInitializing, setIsInitializing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkInitialized = useCallback(async () => {
    if (!wallets.length) return false;

    try {
      // Find ONLY embedded wallet - strictly filter for Privy embedded wallets (following useWalletBalance pattern)
      const embeddedWallet = wallets.find(wallet => 
        wallet.connectorType === 'embedded' && 
        wallet.walletClientType === 'privy'
      ) || null;
      
      if (!embeddedWallet?.address) {
        console.error('No embedded wallet found');
        return false;
      }

      const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
      
      // Check initialization status on the embedded wallet address (where the delegated code lives)
      const contract = new ethers.Contract(
        embeddedWallet.address, // ← Embedded wallet address, not the implementation contract
        delegatedAccountABI,
        provider
      );

      const initialized = await contract.isInitialized();
      setIsInitialized(initialized);
      return initialized;
    } catch (error) {
      console.error('Error checking initialization status:', error);
      return false;
    }
  }, [wallets]);

  const initializeAccount = useCallback(async () => {
    if (!wallets.length) {
      setError('No wallet connected');
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      // Find ONLY embedded wallet - strictly filter for Privy embedded wallets (following useWalletBalance pattern)
      const embeddedWallet = wallets.find(wallet => 
        wallet.connectorType === 'embedded' && 
        wallet.walletClientType === 'privy'
      ) || null;
      
      if (!embeddedWallet?.address) {
        setError('No embedded wallet found');
        return;
      }

      const embeddedAddress = embeddedWallet.address;
      
      // Create the account configuration matching the Go implementation
      const config: AccountConfig = {
        owner: embeddedAddress,
        delegate: embeddedAddress, // Same as owner in the Go implementation
        feeRecipient: embeddedAddress, // Can be updated to a different address if needed
        minExchangeRate: FEE_CONFIG.MIN_EXCHANGE_RATE,
        maxExchangeRate: FEE_CONFIG.MAX_EXCHANGE_RATE,
        minRequiredFee: FEE_CONFIG.MIN_FEE,
        maxFeePerTransaction: FEE_CONFIG.MAX_FEE,
        initialDestinations: [
          CONTRACT_ADDRESSES.MOCK_USDC,
          CONTRACT_ADDRESSES.REAL_ESTATE_INVESTMENT
        ],
        destinationStatuses: [true, true], // Both whitelisted
      };

      // Encode the initialization data
      const iface = new ethers.Interface(delegatedAccountABI);
      const initData = iface.encodeFunctionData('initializeWithConfig', [config]);

      // Send the transaction to the embedded wallet address
      const txResult = await sendTransaction({
        to: embeddedAddress, // ← Send to embedded wallet address
        data: initData,
      });

      const txHash = txResult.hash;
      console.log('Initialization transaction sent:', txHash);
      
      // Wait for confirmation
      const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
      
      const receipt = await provider.waitForTransaction(txHash);
      
      if (receipt?.status === 1) {
        setIsInitialized(true);
        console.log('Account initialized successfully');
      } else {
        throw new Error('Transaction failed');
      }
      
    } catch (error) {
      console.error('Error initializing account:', error);
      setError(error instanceof Error ? error.message : 'Failed to initialize account');
    } finally {
      setIsInitializing(false);
    }
  }, [wallets, sendTransaction]);

  return {
    initializeAccount,
    checkInitialized,
    isInitializing,
    isInitialized,
    error,
  };
};