import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, Loader2, Play } from 'lucide-react';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { useSmartAccountAuth } from '@/hooks/useSmartAccountAuth';
import { useDelegatedAccount } from '@/hooks/useDelegatedAccount';
import { useTestScenario } from '@/hooks/useTestScenario';
import { CheckEventsButton } from '@/components/CheckEventsButton';
import { WalletInfoCard } from '@/components/WalletInfoCard';
import { SmartAccountAuthCard } from '@/components/SmartAccountAuthCard';
import { formatAddress, getChainName } from '@/utils/formatters';
import { logger } from '@/utils/logger';
import { DELEGATE_OWNER } from '@/utils/constants';
import { ethers } from 'ethers';

const Dashboard = () => {
  const { ready, authenticated, logout } = usePrivy();
  const navigate = useNavigate();
  const {
    balance,
    isLoading: balanceLoading,
    wallet: embeddedWallet,
    chainInfo,
    isSwitching,
    refetch
  } = useWalletBalance();

  const {
    isAuthorized,
    smartAccountEnabled,
    isLoading: authLoading,
    error: authError,
    enableSmartAccount,
    refreshStatus,
    smartContractAddress,
    waitingForTx,
    txHash
  } = useSmartAccountAuth();

  const {
    backupPrivateKey,
    checkInitialized,
    checkContractsWhitelisted,
    isExportingKey,
    error: delegatedError,
  } = useDelegatedAccount();

  const {
    executeWorkflow,
    isExecuting,
    result: workflowResult,
    error: workflowError,
  } = useTestScenario();

  const [isDelegating, setIsDelegating] = useState(false);
  const [isDelegated, setIsDelegated] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Memoized chain name calculation
  const chainName = useMemo(
    () => getChainName(chainInfo?.providerChainIdDecimal),
    [chainInfo?.providerChainIdDecimal]
  );

  // Initialize delegated account checks
  useEffect(() => {
    if (embeddedWallet?.address) {
      checkInitialized();
      checkContractsWhitelisted();
    }
  }, [embeddedWallet?.address, checkInitialized, checkContractsWhitelisted]);

  // Navigation guard
  useEffect(() => {
    if (ready && !authenticated) {
      navigate('/');
    }
  }, [ready, authenticated, navigate]);

  // Callbacks with useCallback
  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/');
  }, [logout, navigate]);

  const refreshBalance = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  const handleDelegation = useCallback(async () => {
    if (!embeddedWallet) {
      logger.error('No embedded wallet found');
      return;
    }

    setIsDelegating(true);
    try {
      const delegateOwnerAddress = DELEGATE_OWNER;

      if (!delegateOwnerAddress) {
        throw new Error('Delegate address (Masterkey) not configured');
      }

      const provider = await embeddedWallet.getEthereumProvider();

      // ABI for updateDelegate function
      const updateDelegateABI = [
        {
          name: 'updateDelegate',
          type: 'function',
          inputs: [
            { name: '_newDelegate', type: 'address' }
          ],
          outputs: [],
        }
      ];

      // Encode the function call
      const iface = new ethers.Interface(updateDelegateABI);
      const calldata = iface.encodeFunctionData('updateDelegate', [delegateOwnerAddress]);

      // Send transaction from embedded wallet to itself (delegated account)
      const tx = {
        to: embeddedWallet.address,
        data: calldata,
        value: '0x0'
      };

      logger.log('Delegating to Delegate address (Masterkey):', delegateOwnerAddress);

      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [tx]
      });

      logger.log('Delegation transaction sent:', txHash);

      // Wait for confirmation
      const publicProvider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
      const receipt = await publicProvider.waitForTransaction(txHash);

      if (receipt?.status === 1) {
        setIsDelegated(true);
        logger.log('Delegation successful');
      } else {
        throw new Error('Delegation transaction failed');
      }
    } catch (error) {
      logger.error('Delegation failed:', error);
      setIsDelegated(false);
    } finally {
      setIsDelegating(false);
    }
  }, [embeddedWallet]);

  const handleEventCheck = useCallback((events: any[]) => {
    logger.log('Events found from Dashboard:', events);
  }, []);

  const handleEventError = useCallback((error: Error) => {
    logger.error('Error checking events:', error);
  }, []);

  // Loading state
  if (!ready || !authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar */}
      <nav className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">Real Estate Investment</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                {formatAddress(embeddedWallet?.address)}
              </span>
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Disconnect
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          {/* Wallet Information Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Wallet Info Card */}
            <WalletInfoCard
              address={embeddedWallet?.address}
              balance={balance}
              chainId={chainInfo?.providerChainIdDecimal}
              chainName={chainName}
              isLoading={balanceLoading}
              isSwitching={isSwitching}
              isRefreshing={isRefreshing}
              onRefresh={refreshBalance}
              onBackup={async () => {
                const result = await backupPrivateKey();
                logger.debug('Backup wallet result:', result);
              }}
              isExportingKey={isExportingKey}
            />

            {/* Smart Account Auth Card */}
            <SmartAccountAuthCard
              isAuthorized={isAuthorized}
              smartAccountEnabled={smartAccountEnabled}
              smartContractAddress={smartContractAddress}
              isLoading={authLoading}
              waitingForTx={waitingForTx}
              txHash={txHash}
              error={authError || delegatedError}
              onRefreshStatus={refreshStatus}
              onEnableSmartAccount={async () => {
                const result = await enableSmartAccount();
                logger.debug('Smart account enabled:', result);
              }}
              onDelegate={handleDelegation}
              isDelegating={isDelegating}
              isDelegated={isDelegated}
              embeddedWalletAddress={embeddedWallet?.address}
            />
          </div>

          {/* Investment Dashboard */}
          <Card>
            <CardHeader>
              <CardTitle>Investment Dashboard</CardTitle>
              <CardDescription>
                Your real estate investment portfolio and opportunities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="text-lg font-medium">Test Workflow Execution</h3>
                <p className="text-sm text-muted-foreground">
                  Execute the real estate property analysis workflow using KRNL network
                </p>

                <Button
                  onClick={executeWorkflow}
                  disabled={isExecuting}
                  className="flex items-center justify-center"
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Executing Workflow...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Test Scenario
                    </>
                  )}
                </Button>

                <CheckEventsButton
                  onEventsFound={handleEventCheck}
                  onError={handleEventError}
                />

                {workflowError && (
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                    Error: {workflowError}
                  </div>
                )}

                {workflowResult && (
                  <div className="text-sm bg-green-50 p-3 rounded space-y-2">
                    <div className="font-medium text-green-800">Workflow Executed Successfully!</div>
                    <details className="text-green-700">
                      <summary className="cursor-pointer">View Result</summary>
                      <pre className="mt-2 text-xs overflow-auto">
                        {JSON.stringify(workflowResult, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>

              <p className="text-muted-foreground">
                Additional investment features will be available here.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;