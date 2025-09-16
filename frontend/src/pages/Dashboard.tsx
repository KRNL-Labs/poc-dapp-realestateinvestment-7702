import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, Loader2, Wallet, Copy, ExternalLink, RefreshCw, Shield, CheckCircle, XCircle, Settings, Play, Download, UserCheck } from 'lucide-react';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { useSmartAccountAuth } from '@/hooks/useSmartAccountAuth';
import { useDelegatedAccount } from '@/hooks/useDelegatedAccount';
import { useTestScenario } from '@/hooks/useTestScenario';
import { CheckEventsButton } from '@/components/CheckEventsButton';
import { ethers } from 'ethers';

const Dashboard = () => {
  const { ready, authenticated, user, logout } = usePrivy();
  const { wallets } = useWallets();
  const navigate = useNavigate();
  const { balance, isLoading: balanceLoading, error: balanceError, wallet: embeddedWallet, chainInfo, isSwitching, refetch } = useWalletBalance();
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
    isInitialized,
    isExportingKey,
    error: delegatedError,
  } = useDelegatedAccount();

  const {
    executeWorkflow,
    isExecuting,
    result: workflowResult,
    error: workflowError,
  } = useTestScenario();
  
  const [copied, setCopied] = useState(false);
  const [isDelegating, setIsDelegating] = useState(false);
  const [isDelegated, setIsDelegated] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log('Dashboard Debug Info:');
    console.log('- Smart Contract Address:', smartContractAddress);
    console.log('- Embedded Wallet Address:', embeddedWallet?.address);
    console.log('- Is Initialized:', isInitialized);
    console.log('- Is Authorized:', isAuthorized);
    console.log('- Show Authorization Section:', embeddedWallet?.address && smartContractAddress && smartContractAddress !== '0x0000000000000000000000000000000000000000');
  }, [smartContractAddress, embeddedWallet?.address, isInitialized, isAuthorized]);

  // Check if delegated account is initialized
  useEffect(() => {
    if (embeddedWallet?.address) {
      checkInitialized();
      checkContractsWhitelisted();
    }
  }, [embeddedWallet?.address, checkInitialized, checkContractsWhitelisted]);

  useEffect(() => {
    if (ready && !authenticated) {
      navigate('/');
    }
  }, [ready, authenticated, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const copyAddress = () => {
    if (embeddedWallet?.address) {
      navigator.clipboard.writeText(embeddedWallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDelegation = async () => {
    if (!embeddedWallet) {
      console.error('No embedded wallet found');
      return;
    }

    setIsDelegating(true);
    try {
      const realEstateAddress = import.meta.env.VITE_DELEGATE_OWNER;

      if (!realEstateAddress) {
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
      const calldata = iface.encodeFunctionData('updateDelegate', [realEstateAddress]);

      // Send transaction from embedded wallet to itself (delegated account)
      // The updateDelegate function should be called on address(this)
      const tx = {
        to: embeddedWallet.address, // Call on the delegated account itself
        data: calldata,
        value: '0x0'
      };

      console.log('Delegating to Delegate address (Masterkey):', realEstateAddress);

      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [tx]
      });

      console.log('Delegation transaction sent:', txHash);

      // Wait for confirmation
      const publicProvider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
      const receipt = await publicProvider.waitForTransaction(txHash);

      if (receipt?.status === 1) {
        setIsDelegated(true);
        console.log('Delegation successful');
      } else {
        throw new Error('Delegation transaction failed');
      }
    } catch (error) {
      console.error('Delegation failed:', error);
      setIsDelegated(false);
    } finally {
      setIsDelegating(false);
    }
  };

  const refreshBalance = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  if (!ready || !authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const formatAddress = (address: string | undefined): string => {
    if (!address) return 'Creating wallet...';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getChainName = (chainId: number | undefined): string => {
    if (!chainId) return 'Preparing...';
    
    switch (chainId) {
      case 1: return 'Ethereum Mainnet';
      case 11155111: return 'Sepolia Testnet';
      case 137: return 'Polygon';
      case 8453: return 'Base';
      case 42161: return 'Arbitrum One';
      case 10: return 'Optimism';
      default: return `Chain ${chainId}`;
    }
  };
  
  const chainName = getChainName(chainInfo?.providerChainIdDecimal);

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
          {/* Wallet Information Row - Two Cards Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Wallet Information Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Wallet className="h-5 w-5 text-primary" />
                    <CardTitle>Embedded Wallet</CardTitle>
                  </div>
                  <Button
                    onClick={refreshBalance}
                    variant="ghost"
                    size="icon"
                    disabled={balanceLoading || isRefreshing}
                  >
                    <RefreshCw className={`h-4 w-4 ${(balanceLoading || isRefreshing) ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Address</span>
                    <div className="flex items-center space-x-2">
                      {!embeddedWallet ? (
                        <div className="flex items-center space-x-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Creating wallet...</span>
                        </div>
                      ) : (
                        <>
                          <span className="font-mono text-sm">
                            {formatAddress(embeddedWallet.address)}
                          </span>
                          <Button
                            onClick={copyAddress}
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Network</span>
                    <div className="flex items-center space-x-2">
                      {isSwitching ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span className="text-sm">Switching...</span>
                        </>
                      ) : (
                        <span className="text-sm font-medium">{chainName}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Balance</span>
                    <div className="flex items-center space-x-2">
                      {!embeddedWallet || balanceLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <span className="text-sm font-medium">
                          {balance} {chainName.includes('Sepolia') ? 'SEP' : 'ETH'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Wallet Type</span>
                    <span className="text-sm font-medium">Privy Embedded</span>
                  </div>
                </div>

                {embeddedWallet?.address && (
                  <div className="flex space-x-2 pt-2">
                    <Button
                      onClick={() => {
                        const getExplorerUrl = (address: string, chainId: number) => {
                          switch (chainId) {
                            case 1: return `https://etherscan.io/address/${address}`;
                            case 11155111: return `https://sepolia.etherscan.io/address/${address}`;
                            case 137: return `https://polygonscan.com/address/${address}`;
                            case 8453: return `https://basescan.org/address/${address}`;
                            case 42161: return `https://arbiscan.io/address/${address}`;
                            case 10: return `https://optimistic.etherscan.io/address/${address}`;
                            default: return `https://etherscan.io/address/${address}`;
                          }
                        };
                        window.open(getExplorerUrl(embeddedWallet.address, chainInfo?.providerChainIdDecimal), '_blank');
                      }}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <ExternalLink className="mr-2 h-3 w-3" />
                      View on Explorer
                    </Button>
                    <Button
                      onClick={backupPrivateKey}
                      disabled={isExportingKey}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      {isExportingKey ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          Exporting...
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-3 w-3" />
                          Backup Wallet
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {copied && (
                  <div className="text-center text-sm text-green-600">
                    Address copied to clipboard!
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Smart Contract Authorization Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Shield className="h-5 w-5 text-primary" />
                    <CardTitle>Smart Contract Authorization</CardTitle>
                  </div>
                  <Button
                    onClick={refreshStatus}
                    variant="ghost"
                    size="icon"
                    disabled={authLoading}
                  >
                    <RefreshCw className={`h-4 w-4 ${authLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                <CardDescription>
                  Manage EIP-7702 delegation and smart contract approvals for enhanced functionality
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">KRNL Smart Account Authorized</span>
                    <div className="flex items-center space-x-2">
                      {authLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (smartAccountEnabled && isAuthorized) ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-green-600 font-medium">Authorized</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-red-500" />
                          <span className="text-sm text-red-600 font-medium">Not Authorized</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">KRNL Smart Account Address</span>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs">
                        {smartContractAddress ? 
                          `${smartContractAddress.slice(0, 6)}...${smartContractAddress.slice(-4)}` : 
                          'Not configured'
                        }
                      </span>
                      {smartContractAddress && smartContractAddress !== '0x0000000000000000000000000000000000000000' && smartContractAddress !== '0x' && (
                        <Button
                          onClick={() => {
                            navigator.clipboard.writeText(smartContractAddress);
                          }}
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Transaction Broadcasting</span>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-600 font-medium">Privy Embedded Wallet</span>
                    </div>
                  </div>
                </div>

                {embeddedWallet?.address && smartContractAddress && smartContractAddress !== '0x0000000000000000000000000000000000000000' && smartContractAddress !== '0x' && (
                  <div className="space-y-3 pt-4">
                    <Button
                      onClick={async () => {
                        const result = await enableSmartAccount();
                        if (result) {
                          // Success feedback could be added here
                        }
                      }}
                      disabled={authLoading || waitingForTx || isAuthorized}
                      variant={isAuthorized ? "outline" : "default"}
                      className="w-full flex items-center justify-center"
                    >
                      {waitingForTx ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Waiting for transaction...
                        </>
                      ) : (
                        <>
                          <Settings className="mr-2 h-4 w-4" />
                          {isAuthorized ? 'Already Authorized' : 'Authorize Smart Account'}
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={handleDelegation}
                      disabled={isDelegating || isDelegated || !isAuthorized}
                      variant={isDelegated ? "outline" : "secondary"}
                      className="w-full flex items-center justify-center"
                    >
                      {isDelegating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Delegating...
                        </>
                      ) : (
                        <>
                          <UserCheck className="mr-2 h-4 w-4" />
                          {isDelegated ? 'Already Delegated' : 'Delegate to this Dapp'}
                        </>
                      )}
                    </Button>

                    {waitingForTx && txHash && (
                      <div className="text-center text-sm text-blue-600 bg-blue-50 p-2 rounded">
                        <div className="flex items-center justify-center space-x-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Transaction pending: {txHash?.slice(0, 10)}...</span>
                        </div>
                        <a 
                          href={`https://sepolia.etherscan.io/tx/${txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs underline hover:no-underline mt-1 inline-block"
                        >
                          View on Explorer
                        </a>
                      </div>
                    )}

                    {(authError || delegatedError) && (
                      <div className="text-center text-sm text-red-600 bg-red-50 p-2 rounded">
                        Error: {authError || delegatedError}
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground text-center space-y-1">
                      <div>Uses EIP-7702 delegation for secure smart contract interactions</div>
                      <div className="text-green-600">Powered by Privy Embedded Wallet</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area */}
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
                  onEventsFound={(events) => {
                    console.log('Events found from Dashboard:', events);
                  }}
                  onError={(error) => {
                    console.error('Error checking events:', error);
                  }}
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