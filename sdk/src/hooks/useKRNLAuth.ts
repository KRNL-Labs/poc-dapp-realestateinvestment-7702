import { useState, useCallback, useEffect, useRef } from 'react';
import { useKRNL } from '../provider/KRNLProvider';
import { KRNLDelegatedAccountSDK } from '../KRNLDelegatedAccountSDK';
import type { PrivyAuthorizationResult, PrivyEmbeddedWallet, PrivySignAuthorizationFunction } from '../types';
import { isPrivyEmbeddedWallet } from '../types';

interface UseKRNLAuthOptions {
  /** Privy sign authorization function */
  signAuthorization: PrivySignAuthorizationFunction;
  /** Privy embedded wallet */
  wallet: PrivyEmbeddedWallet | null;
}

interface UseKRNLAuthResult {
  /** Authorization status */
  isAuthorized: boolean;
  /** Smart account enabled status */
  smartAccountEnabled: boolean;
  /** Contract address */
  contractAddress?: string;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** SDK initialization status */
  isInitialized: boolean;
  /** Check authorization status */
  checkAuth: () => Promise<void>;
  /** Enable smart account */
  enableSmartAccount: () => Promise<boolean>;
}

/**
 * Hook for managing KRNL delegated account authorization
 * Takes signAuthorization as parameter to avoid config coupling
 */
export const useKRNLAuth = (options: UseKRNLAuthOptions): UseKRNLAuthResult => {
  const { config } = useKRNL();
  const { signAuthorization, wallet } = options;

  const [sdk, setSdk] = useState<KRNLDelegatedAccountSDK | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [smartAccountEnabled, setSmartAccountEnabled] = useState(false);
  const [contractAddress, setContractAddress] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initPromiseRef = useRef<Promise<void> | null>(null);

  // Initialize SDK when signAuthorization is available
  useEffect(() => {
    if (!signAuthorization || isInitialized) return;

    const initSDK = async () => {
      if (initPromiseRef.current) return initPromiseRef.current;

      const initPromise = (async () => {
        try {
          setIsLoading(true);
          setError(null);

          const sdkInstance = new KRNLDelegatedAccountSDK(
            config.authConfig,
            signAuthorization,
            config.sdkConfig
          );

          await sdkInstance.initialize(
            config.config.wasmPath,
            config.config.wasmExecPath
          );

          setSdk(sdkInstance);
          setIsInitialized(true);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to initialize SDK');
        } finally {
          setIsLoading(false);
          initPromiseRef.current = null;
        }
      })();

      initPromiseRef.current = initPromise;
      return initPromise;
    };

    initSDK();
  }, [signAuthorization, config, isInitialized]);

  const checkAuth = useCallback(async () => {
    if (!sdk || !wallet) return;

    if (!isPrivyEmbeddedWallet(wallet)) {
      throw new Error('Invalid wallet: Expected Privy embedded wallet with connectorType="embedded" and walletClientType="privy"');
    }

    try {
      setIsLoading(true);
      setError(null);

      const status = await sdk.checkPrivyWalletAuthorization(wallet);
      setIsAuthorized(status.isAuthorized);
      setSmartAccountEnabled(status.smartAccountEnabled);
      setContractAddress(status.contractAddress);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check authorization');
    } finally {
      setIsLoading(false);
    }
  }, [sdk, wallet]);

  const enableSmartAccount = useCallback(async (): Promise<boolean> => {
    if (!sdk || !wallet) {
      setError('SDK or wallet not available');
      return false;
    }

    if (!isPrivyEmbeddedWallet(wallet)) {
      const errorMessage = 'Invalid wallet: Expected Privy embedded wallet with connectorType="embedded" and walletClientType="privy"';
      setError(errorMessage);
      throw new Error(errorMessage);
    }

    setIsLoading(true);
    setError(null);

    try {
      const result: PrivyAuthorizationResult = await sdk.enablePrivySmartAccount(wallet);

      if (result.success) {
        await checkAuth();
        return true;
      } else {
        setError(result.error || 'Failed to enable smart account');
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to enable smart account';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [sdk, wallet, checkAuth]);

  // Auto-check when wallet and SDK are ready
  useEffect(() => {
    if (sdk && wallet && isPrivyEmbeddedWallet(wallet)) {
      checkAuth();
    }
  }, [sdk, wallet, checkAuth]);

  return {
    isAuthorized,
    smartAccountEnabled,
    contractAddress,
    isLoading,
    error,
    isInitialized,
    checkAuth,
    enableSmartAccount
  };
};