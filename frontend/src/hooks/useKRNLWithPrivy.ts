import { useWallets, useSign7702Authorization } from '@privy-io/react-auth';
import { useKRNLAuth, isPrivyEmbeddedWallet } from '../../../sdk/src';

/**
 * Combined hook that integrates Privy authentication with KRNL SDK
 * Passes signAuthorization to useKRNLAuth
 */
export const useKRNLWithPrivy = () => {
  const { wallets } = useWallets();
  const { signAuthorization } = useSign7702Authorization();

  // Get embedded wallet from Privy with proper type checking
  const embeddedWallet = wallets.find(isPrivyEmbeddedWallet) || null;

  // Use KRNL auth with signAuthorization and wallet
  const krnlAuth = useKRNLAuth({
    signAuthorization: signAuthorization || (() => Promise.reject(new Error('signAuthorization not available'))),
    wallet: embeddedWallet || null
  });

  return {
    // Wallet info
    embeddedWallet,
    isWalletConnected: !!embeddedWallet,

    // KRNL auth
    ...krnlAuth,
    enable: krnlAuth.enableSmartAccount,
    checkAuth: krnlAuth.checkAuth
  };
};