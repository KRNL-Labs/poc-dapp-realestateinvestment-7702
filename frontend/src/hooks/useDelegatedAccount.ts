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

const DELEGATE_OWNER = import.meta.env.VITE_DELEGATE_OWNER;

const FEE_CONFIG = {
  MIN_EXCHANGE_RATE: BigInt(import.meta.env.VITE_MIN_EXCHANGE_RATE || '3000000000'),
  MAX_EXCHANGE_RATE: BigInt(import.meta.env.VITE_MAX_EXCHANGE_RATE || '4000000000'),
  MIN_FEE: BigInt(import.meta.env.VITE_MIN_FEE || '100000'),
  MAX_FEE: BigInt(import.meta.env.VITE_MAX_FEE || '5000000'),
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
  const { user, sendTransaction, exportWallet } = usePrivy();
  const { wallets } = useWallets();
  const [isInitializing, setIsInitializing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAddingToWhitelist, setIsAddingToWhitelist] = useState(false);
  const [isExportingKey, setIsExportingKey] = useState(false);
  const [areContractsWhitelisted, setAreContractsWhitelisted] = useState(false);
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
      const owner = await contract.owner();
      console.log('cccc', owner)
      
      if (!initialized) {
        setIsInitialized(false);
        return false;
      }
      
      // Additional check: Verify RealEstate contract is whitelisted
      const realEstateWhitelisted = await contract.isDestinationWhitelisted(
        CONTRACT_ADDRESSES.REAL_ESTATE_INVESTMENT
      );

      console.log('xxxx',realEstateWhitelisted)
      
      const fullyInitialized = initialized && realEstateWhitelisted;
      setIsInitialized(fullyInitialized);
      return fullyInitialized;
    } catch (error) {
      console.error('Error checking initialization status:', error);
      return false;
    }
  }, [wallets]);

  const initializeBasic = useCallback(async () => {
    if (!wallets.length) {
      setError('No wallet connected');
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      // Find ONLY embedded wallet - strictly filter for Privy embedded wallets
      const embeddedWallet = wallets.find(wallet => 
        wallet.connectorType === 'embedded' && 
        wallet.walletClientType === 'privy'
      ) || null;
      
      if (!embeddedWallet?.address) {
        setError('No embedded wallet found');
        return;
      }

      const embeddedAddress = embeddedWallet.address;

      // Encode the basic initialization data - use full function signature for overloaded function
      const iface = new ethers.Interface(delegatedAccountABI);
      const initData = iface.encodeFunctionData('initialize(address,address,uint256,uint256,uint256,uint256)', [
        embeddedAddress,                    // owner
        DELEGATE_OWNER,                     // delegate
        FEE_CONFIG.MIN_EXCHANGE_RATE,       // minExchangeRate
        FEE_CONFIG.MAX_EXCHANGE_RATE,       // maxExchangeRate
        FEE_CONFIG.MIN_FEE,                 // minRequiredFee
        FEE_CONFIG.MAX_FEE                  // maxFeePerTransaction
      ]);

      // Send the transaction to the embedded wallet address
      const txResult = await sendTransaction({
        to: embeddedAddress,
        data: initData,
      });

      const txHash = txResult.hash;
      console.log('Basic initialization transaction sent:', txHash);
      
      // Wait for confirmation
      const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
      const receipt = await provider.waitForTransaction(txHash);
      
      if (receipt?.status === 1) {
        console.log('Account basic initialization successful');
        // Note: Don't set isInitialized to true yet, as whitelist still needs to be configured
      } else {
        throw new Error('Transaction failed');
      }
      
    } catch (error) {
      console.error('Error with basic initialization:', error);
      setError(error instanceof Error ? error.message : 'Failed to initialize account');
    } finally {
      setIsInitializing(false);
    }
  }, [wallets, sendTransaction]);

  const initializeWithConfig = useCallback(async () => {
    if (!wallets.length) {
      setError('No wallet connected');
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      // Find ONLY embedded wallet - strictly filter for Privy embedded wallets
      const embeddedWallet = wallets.find(wallet => 
        wallet.connectorType === 'embedded' && 
        wallet.walletClientType === 'privy'
      ) || null;
      
      if (!embeddedWallet?.address) {
        setError('No embedded wallet found');
        return;
      }

      const embeddedAddress = embeddedWallet.address;
      
      // Create the account configuration with whitelist
      const config: AccountConfig = {
        owner: embeddedAddress,
        delegate: DELEGATE_OWNER,
        feeRecipient: embeddedAddress,
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

      // Encode the initialization data with config
      const iface = new ethers.Interface(delegatedAccountABI);
      const initData = iface.encodeFunctionData('initializeWithConfig', [config]);

      // Send the transaction to the embedded wallet address
      const txResult = await sendTransaction({
        to: embeddedAddress,
        data: initData,
      });

      const txHash = txResult.hash;
      console.log('Config initialization transaction sent:', txHash);
      
      // Wait for confirmation
      const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
      const receipt = await provider.waitForTransaction(txHash);
      
      if (receipt?.status === 1) {
        setIsInitialized(true);
        console.log('Account initialized with config successfully');
      } else {
        throw new Error('Transaction failed');
      }
      
    } catch (error) {
      console.error('Error initializing with config:', error);
      setError(error instanceof Error ? error.message : 'Failed to initialize account with config');
    } finally {
      setIsInitializing(false);
    }
  }, [wallets, sendTransaction]);

  const addDestinationToWhitelist = useCallback(async (destinationAddress: string) => {
    if (!wallets.length) {
      setError('No wallet connected');
      return;
    }

    if (!destinationAddress || !ethers.isAddress(destinationAddress)) {
      setError('Invalid destination address');
      return;
    }

    setIsAddingToWhitelist(true);
    setError(null);

    try {
      // Find ONLY embedded wallet - strictly filter for Privy embedded wallets
      const embeddedWallet = wallets.find(wallet => 
        wallet.connectorType === 'embedded' && 
        wallet.walletClientType === 'privy'
      ) || null;
      
      if (!embeddedWallet?.address) {
        setError('No embedded wallet found');
        return;
      }

      const embeddedAddress = embeddedWallet.address;

      // Check if already whitelisted
      const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
      const contract = new ethers.Contract(
        embeddedAddress,
        delegatedAccountABI,
        provider
      );

      const isWhitelisted = await contract.isDestinationWhitelisted(destinationAddress);
      if (isWhitelisted) {
        setError('Address is already whitelisted');
        return;
      }

      // Encode the updateDestinationWhitelist call
      const iface = new ethers.Interface(delegatedAccountABI);
      const updateWhitelistData = iface.encodeFunctionData('updateDestinationWhitelist', [
        destinationAddress,
        true // whitelist the address
      ]);

      // Since updateDestinationWhitelist requires msg.sender == address(this),
      // we need to call it through the account itself (self-call)
      const txResult = await sendTransaction({
        to: embeddedAddress,
        data: updateWhitelistData,
      });

      const txHash = txResult.hash;
      console.log('Whitelist update transaction sent:', txHash);
      
      // Wait for confirmation
      const receipt = await provider.waitForTransaction(txHash);
      
      if (receipt?.status === 1) {
        console.log('Destination whitelisted successfully:', destinationAddress);
        return true;
      } else {
        throw new Error('Transaction failed');
      }
      
    } catch (error) {
      console.error('Error adding to whitelist:', error);
      setError(error instanceof Error ? error.message : 'Failed to add destination to whitelist');
      return false;
    } finally {
      setIsAddingToWhitelist(false);
    }
  }, [wallets, sendTransaction]);

  const checkContractsWhitelisted = useCallback(async () => {
    if (!wallets.length) return false;

    try {
      // Find ONLY embedded wallet
      const embeddedWallet = wallets.find(wallet =>
        wallet.connectorType === 'embedded' &&
        wallet.walletClientType === 'privy'
      ) || null;

      if (!embeddedWallet) return false;

      const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
      const contract = new ethers.Contract(
        embeddedWallet.address,
        delegatedAccountABI,
        provider
      );

      // Check if both contracts are whitelisted
      const [realEstateWhitelisted, mockUsdcWhitelisted] = await Promise.all([
        CONTRACT_ADDRESSES.REAL_ESTATE_INVESTMENT ?
          contract.isDestinationWhitelisted(CONTRACT_ADDRESSES.REAL_ESTATE_INVESTMENT) :
          Promise.resolve(true),
        CONTRACT_ADDRESSES.MOCK_USDC ?
          contract.isDestinationWhitelisted(CONTRACT_ADDRESSES.MOCK_USDC) :
          Promise.resolve(true)
      ]);

      const allWhitelisted = realEstateWhitelisted && mockUsdcWhitelisted;
      setAreContractsWhitelisted(allWhitelisted);
      return allWhitelisted;
    } catch (error) {
      console.error('Error checking whitelist status:', error);
      return false;
    }
  }, [wallets]);

  const backupPrivateKey = useCallback(async () => {
    if (!wallets.length) {
      setError('No wallet connected');
      return;
    }

    setIsExportingKey(true);
    setError(null);

    try {
      // Find ONLY embedded wallet - strictly filter for Privy embedded wallets
      const embeddedWallet = wallets.find(wallet => 
        wallet.connectorType === 'embedded' && 
        wallet.walletClientType === 'privy'
      ) || null;
      
      if (!embeddedWallet) {
        setError('No embedded wallet found');
        return;
      }

      // Privy's exportWallet function opens a modal for the user to export their wallet
      // This is a secure way to export the private key with user authentication
      if (exportWallet) {
        await exportWallet();
        console.log('Wallet export modal opened successfully');
        return true;
      } else {
        // If exportWallet is not available, try using the wallet's export method directly
        if ('export' in embeddedWallet && typeof embeddedWallet.export === 'function') {
          await embeddedWallet.export();
          console.log('Wallet exported successfully');
          return true;
        } else {
          setError('Wallet export not supported. Please check Privy dashboard for backup options.');
          return false;
        }
      }
    } catch (error) {
      console.error('Error exporting wallet:', error);
      setError(error instanceof Error ? error.message : 'Failed to export wallet');
      return false;
    } finally {
      setIsExportingKey(false);
    }
  }, [wallets, exportWallet]);

  return {
    initializeBasic,
    initializeWithConfig,
    addDestinationToWhitelist,
    backupPrivateKey,
    checkInitialized,
    checkContractsWhitelisted,
    isInitializing,
    isInitialized,
    isAddingToWhitelist,
    isExportingKey,
    areContractsWhitelisted,
    error,
  };
};