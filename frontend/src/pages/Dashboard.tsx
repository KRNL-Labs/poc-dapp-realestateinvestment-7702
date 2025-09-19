import { usePrivy } from '@privy-io/react-auth';
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, Loader2, Play } from 'lucide-react';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { useSmartAccountAuth } from '@/hooks/useSmartAccountAuth';
import { useTestScenario } from '@/hooks/useTestScenario';
import { useMintUSDC } from '@/hooks/useMintUSDC';
import { useUSDCBalance } from '@/hooks/useUSDCBalance';
import { WalletInfoCard } from '@/components/WalletInfoCard';
import { SmartAccountAuthCard } from '@/components/SmartAccountAuthCard';
import { formatAddress, getChainName, switchNetwork } from '@/utils';

const Dashboard = () => {
  const { logout } = usePrivy();
  const { balance, isLoading: balanceLoading, wallet: embeddedWallet, chainInfo, isSwitching, refetch } = useWalletBalance();
  const { isAuthorized, smartAccountEnabled, isLoading: authLoading, error: authError, enableSmartAccount, refreshStatus, smartContractAddress, waitingForTx, txHash } = useSmartAccountAuth();
  const { executeWorkflow, isSubmitting, isWaitingForTransaction, submissionResult, executionResult, error: workflowError } = useTestScenario();
  const { mintUSDC, isMinting: isMintingUSDC } = useMintUSDC();
  const { usdcBalance, isLoading: isLoadingUSDC, refetch: refetchUSDC } = useUSDCBalance();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSwitchingToSepolia, setIsSwitchingToSepolia] = useState(false);
  const chainName = getChainName(chainInfo?.providerChainIdDecimal);

  const refreshBalance = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refetch(), refetchUSDC()]);
    setIsRefreshing(false);
  }, [refetch, refetchUSDC]);

  const switchToSepolia = useCallback(async () => {
    if (!embeddedWallet) return;
    setIsSwitchingToSepolia(true);
    try {
      await switchNetwork(embeddedWallet, 11155111);
      await Promise.all([refetch(), refetchUSDC()]);
    } catch {
      // Ignore network switch errors
    }
    finally { setIsSwitchingToSepolia(false); }
  }, [embeddedWallet, refetch, refetchUSDC]);



  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-semibold">Real Estate Investment</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">{formatAddress(embeddedWallet?.address)}</span>
              <Button onClick={() => logout()} variant="outline" size="sm">
                <LogOut className="mr-2 h-4 w-4" />Disconnect
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
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
            onMintUSDC={async () => {
              const result = await mintUSDC();
              if (result.success) {
                await Promise.all([refetch(), refetchUSDC()]);
              }
              return result;
            }}
            isMintingUSDC={isMintingUSDC}
            usdcBalance={usdcBalance}
            isLoadingUSDC={isLoadingUSDC}
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
            onEnableSmartAccount={async () => { await enableSmartAccount(); }}
            embeddedWalletAddress={embeddedWallet?.address}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Investment Dashboard</CardTitle>
            <CardDescription>Your real estate investment portfolio and opportunities</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-lg p-4 space-y-4">
              <div>
                <h3 className="text-lg font-medium">Test Workflow Execution</h3>
                <p className="text-sm text-muted-foreground">Execute real estate workflows using KRNL network</p>
              </div>

              <div className="flex gap-2">
                {['A', 'B'].map(type => (
                  <Button key={type} onClick={() => executeWorkflow(type as 'A' | 'B')} disabled={isSubmitting || isWaitingForTransaction} variant={type === 'B' ? 'outline' : 'default'}>
                    {(isSubmitting || isWaitingForTransaction) ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isSubmitting ? 'Submitting...' : 'Executing...'}</>
                    ) : (
                      <><Play className="mr-2 h-4 w-4" />{type === 'A' ? 'Property Analysis' : 'Purchase Tokens'}</>
                    )}
                  </Button>
                ))}
              </div>

              {(isSubmitting || isWaitingForTransaction || submissionResult || executionResult) && (
                <div className="text-sm bg-blue-50 p-3 rounded space-y-2">
                  <div className="font-medium text-blue-600">Process Status:</div>
                  <StatusItem
                    active={isSubmitting}
                    completed={!!submissionResult}
                    label="Submit to KRNL Node"
                  />
                  <StatusItem
                    active={isWaitingForTransaction}
                    completed={!!executionResult}
                    label={isWaitingForTransaction ? 'Transaction Executing' : 'Transaction Execution'}
                  />
                </div>
              )}


              {workflowError && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded">Error: {workflowError}</div>
              )}

              {submissionResult && (
                <ResultCard
                  title="Workflow Submitted to KRNL Node Successfully!"
                  data={{"Workflow ID": submissionResult.id}}
                  details={submissionResult}
                  detailsLabel="View Submission Details"
                />
              )}

              {executionResult && (
                <ResultCard
                  title="Transaction Confirmed On-Chain!"
                  data={{
                    "Transaction Hash": (
                      <a href={`https://sepolia.etherscan.io/tx/${executionResult.transactionHash}`}
                         target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {formatAddress(executionResult.transactionHash)}
                      </a>
                    ),
                    "Block": executionResult.blockNumber
                  }}
                  details={executionResult}
                  detailsLabel="View Transaction Details"
                />
              )}
            </div>
            <p className="text-muted-foreground">Additional investment features will be available here.</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

const StatusItem = ({ active, completed, label }: { active: boolean; completed: boolean; label: string }) => (
  <div className={`flex items-center ${active ? 'text-blue-600' : completed ? 'text-green-600' : 'text-gray-400'}`}>
    {active ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : completed ? '✓ ' : '○ '}{label}
  </div>
);

const ResultCard = ({ title, data, details, detailsLabel }: { title: string; data: Record<string, React.ReactNode>; details: object; detailsLabel: string }) => (
  <div className="text-sm bg-green-50 p-3 rounded space-y-2">
    <div className="font-medium text-green-800">{title}</div>
    <div className="text-green-700 space-y-1">
      {Object.entries(data).map(([key, value]) => (
        <div key={key}><span className="font-medium">{key}:</span><span className="ml-2">{value}</span></div>
      ))}
    </div>
    <details className="text-green-700">
      <summary className="cursor-pointer">{detailsLabel}</summary>
      <pre className="mt-2 text-xs overflow-auto">{JSON.stringify(details, null, 2)}</pre>
    </details>
  </div>
);

export default Dashboard;