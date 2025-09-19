import { useKRNLWithPrivy } from './useKRNLWithPrivy';

/**
 * Smart Account Auth hook using new provider pattern
 * Maintains backward compatibility with existing components
 */
export const useSmartAccountAuth = () => {
  const {
    isAuthorized,
    smartAccountEnabled,
    contractAddress,
    isLoading,
    error,
    checkAuth,
    enable
  } = useKRNLWithPrivy();

  const smartContractAddress = contractAddress || import.meta.env.VITE_DELEGATED_ACCOUNT_ADDRESS as string;

  return {
    isAuthorized,
    smartAccountEnabled,
    isLoading,
    error,
    enableSmartAccount: enable,
    refreshStatus: checkAuth,
    smartContractAddress,
    waitingForTx: false, // SDK handles this internally now
    txHash: null // SDK handles this internally now
  };
};