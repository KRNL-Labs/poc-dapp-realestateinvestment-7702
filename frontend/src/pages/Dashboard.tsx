import { usePrivy } from '@privy-io/react-auth';
import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, Loader2, Play } from 'lucide-react';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { useSmartAccountAuth } from '@/hooks/useSmartAccountAuth';
import { useTestScenario } from '@/hooks/useTestScenario';
import { WalletInfoCard } from '@/components/WalletInfoCard';
import { SmartAccountAuthCard } from '@/components/SmartAccountAuthCard';
import { formatAddress, getChainName, switchNetwork } from '@/utils';

const Dashboard = () => {
  const { logout } = usePrivy();
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
    executeWorkflow,
    isSubmitting,
    isWaitingForTransaction,
    submissionResult,
    executionResult,
    error: workflowError,
  } = useTestScenario();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSwitchingToSepolia, setIsSwitchingToSepolia] = useState(false);

  const chainName = useMemo(
    () => getChainName(chainInfo?.providerChainIdDecimal),
    [chainInfo?.providerChainIdDecimal]
  );


  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  const refreshBalance = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  const switchToSepolia = useCallback(async () => {
    if (!embeddedWallet) return;

    setIsSwitchingToSepolia(true);
    try {
      await switchNetwork(embeddedWallet, 11155111); // Sepolia Chain ID
      await refetch(); // Refresh balance after network switch
    } catch (error) {
      console.error('Failed to switch to Sepolia:', error);
    } finally {
      setIsSwitchingToSepolia(false);
    }
  }, [embeddedWallet, refetch]);



  return (
    <div className="min-h-screen bg-background">
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <WalletInfoCard
              address={embeddedWallet?.address}
              balance={balance}
              chainId={chainInfo?.providerChainIdDecimal}
              chainName={chainName}
              isLoading={balanceLoading}
              isSwitching={isSwitching}
              isRefreshing={isRefreshing}
              isSwitchingToSepolia={isSwitchingToSepolia}
              onRefresh={refreshBalance}
              onSwitchToSepolia={switchToSepolia}
            />
            <SmartAccountAuthCard
              isAuthorized={isAuthorized}
              smartAccountEnabled={smartAccountEnabled}
              smartContractAddress={smartContractAddress}
              isLoading={authLoading}
              waitingForTx={waitingForTx}
              txHash={txHash}
              error={authError}
              onRefreshStatus={refreshStatus}
              onEnableSmartAccount={async () => {
                await enableSmartAccount();
              }}
              embeddedWalletAddress={embeddedWallet?.address}
            />
          </div>

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
                  disabled={isSubmitting || isWaitingForTransaction}
                  className="flex items-center justify-center"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting to KRNL Node...
                    </>
                  ) : isWaitingForTransaction ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Waiting for Execution...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Test Scenario
                    </>
                  )}
                </Button>

                {(isSubmitting || isWaitingForTransaction || submissionResult || executionResult) && (
                  <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded space-y-2">
                    <div className="font-medium">Process Status:</div>
                    <div className="space-y-1">
                      <div className={`flex items-center ${isSubmitting ? 'text-blue-600' : submissionResult ? 'text-green-600' : 'text-gray-400'}`}>
                        {isSubmitting ? (
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        ) : submissionResult ? (
                          <span className="mr-2">✓</span>
                        ) : (
                          <span className="mr-2">○</span>
                        )}
                        Submit to KRNL Node
                      </div>
                      <div className={`flex items-center ${isWaitingForTransaction ? 'text-blue-600' : executionResult ? 'text-green-600' : 'text-gray-400'}`}>
                        {isWaitingForTransaction ? (
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        ) : executionResult ? (
                          <span className="mr-2">✓</span>
                        ) : (
                          <span className="mr-2">○</span>
                        )}
                        {isWaitingForTransaction ? 'Transaction Executing' : 'Transaction Execution'}
                      </div>
                    </div>
                  </div>
                )}


                {workflowError && (
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                    Error: {workflowError}
                  </div>
                )}

                {submissionResult && (
                  <div className="text-sm bg-green-50 p-3 rounded space-y-2">
                    <div className="font-medium text-green-800">
                      Workflow Submitted to KRNL Node Successfully!
                    </div>
                    <div className="text-green-700">
                      <span className="font-medium">Workflow ID:</span>
                      <span className="ml-2">{submissionResult.id}</span>
                    </div>
                    <details className="text-green-700">
                      <summary className="cursor-pointer">View Submission Details</summary>
                      <pre className="mt-2 text-xs overflow-auto">
                        {JSON.stringify(submissionResult, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}

                {executionResult && (
                  <div className="text-sm bg-green-50 p-3 rounded space-y-2">
                    <div className="font-medium text-green-800">
                      Transaction Confirmed On-Chain!
                    </div>
                    <div className="text-green-700 space-y-1">
                      <div>
                        <span className="font-medium">Transaction Hash:</span>
                        <a
                          href={`https://sepolia.etherscan.io/tx/${executionResult.transactionHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-blue-600 hover:underline"
                        >
                          {formatAddress(executionResult.transactionHash)}
                        </a>
                      </div>
                      <div>
                        <span className="font-medium">Block:</span>
                        <span className="ml-2">{executionResult.blockNumber}</span>
                      </div>
                    </div>
                    <details className="text-green-700">
                      <summary className="cursor-pointer">View Transaction Details</summary>
                      <pre className="mt-2 text-xs overflow-auto">
                        {JSON.stringify(executionResult, null, 2)}
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