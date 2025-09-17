import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import delegatedAccountABI from '../contracts/Delegated7702Account.abi.json';
import { RPC_URL, DELEGATE_OWNER } from '../const';

export const useDelegatedAccount = () => {
  const { exportWallet } = usePrivy();
  const { wallets } = useWallets();
  const [isExportingKey, setIsExportingKey] = useState(false);
  const [isDelegatedToOwner, setIsDelegatedToOwner] = useState(false);
  const [error, setError] = useState<string | null>(null);





  const checkDelegation = useCallback(async () => {
    if (!wallets.length || !DELEGATE_OWNER) return false;

    try {
      // Find ONLY embedded wallet
      const embeddedWallet = wallets.find(wallet =>
        wallet.connectorType === 'embedded' &&
        wallet.walletClientType === 'privy'
      ) || null;

      if (!embeddedWallet) return false;

      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const contract = new ethers.Contract(
        embeddedWallet.address,
        delegatedAccountABI,
        provider
      );

      // Check current delegate
      const currentDelegate = await contract.delegate();
      const isDelegated = currentDelegate.toLowerCase() === DELEGATE_OWNER.toLowerCase();
      setIsDelegatedToOwner(isDelegated);
      return isDelegated;
    } catch (error) {
      console.error('Error checking delegation status:', error);
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
    backupPrivateKey,
    checkDelegation,
    isExportingKey,
    isDelegatedToOwner,
    error,
  };
};