import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, Loader2, Wallet, Copy, ExternalLink, RefreshCw, Shield, CheckCircle, XCircle, Settings, Zap, Play } from 'lucide-react';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { useSmartAccountAuth } from '@/hooks/useSmartAccountAuth';
import { useDelegatedAccount } from '@/hooks/useDelegatedAccount';
import { useTestScenario } from '@/hooks/useTestScenario';
import { keccak256, encodePacked } from 'viem';
import RealEstateInvestmentABI from '../contracts/RealEstateInvestment.abi.json';
import DelegatedAccountABI from '../contracts/Delegated7702AccountV2.abi.json';

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
    initializeAccount,
    checkInitialized,
    isInitializing,
    isInitialized,
    error: delegatedError,
    approveERC20Max,
  } = useDelegatedAccount();

  const {
    executeWorkflow,
    isExecuting,
    result: workflowResult,
    error: workflowError,
  } = useTestScenario();
  
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showWorkflowInput, setShowWorkflowInput] = useState(false);
  const [workflowInput, setWorkflowInput] = useState('');
  const [erc20ApproveAddress, setErc20ApproveAddress] = useState("");
  const [erc20ApproveLoading, setErc20ApproveLoading] = useState(false);

  // TransactionIntent UI state
  const [nodeAddress, setNodeAddress] = useState("");
  const [targetContract, setTargetContract] = useState("");
  const [targetOwner, setTargetOwner] = useState("");
  const [intentError, setIntentError] = useState<string | null>(null);
  const [intentResult, setIntentResult] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);


  const handleProcessIntent = async () => {
    setIntentError(null);
    setIntentResult(null);
    setProcessing(true);
    try {
      const RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';
      // Find the embedded wallet
      const embeddedWalletObj = wallets.find(wallet =>
        wallet.connectorType === 'embedded' &&
        wallet.walletClientType === 'privy'
      );

      if (!embeddedWalletObj?.address) {
        throw new Error('No embedded wallet found');
      }

      // Get provider and switch to Sepolia
      const provider = await embeddedWalletObj.getEthereumProvider();
      await embeddedWalletObj.switchChain(11155111); // Sepolia

      // Import ethers and get nonce from contract
      const { ethers } = await import('ethers');
      const publicProvider = new ethers.JsonRpcProvider(RPC_URL);

      const realEstateContract = new ethers.Contract(
        targetContract,
        RealEstateInvestmentABI,
        publicProvider
      );
      const nonce = await realEstateContract.nonces(embeddedWalletObj.address);

      // Use nodeAddress from state or fallback
      const nodeAddr = nodeAddress || '0x0000000000000000000000000000000000000000';
      const deadline = Math.floor(Date.now() / 1000) + 7200; // 1 hour from now

      // Compute intentId
      const intentId = keccak256(
        encodePacked(
          ['address', 'uint256', 'uint256'],
          [embeddedWalletObj.address as `0x${string}`, BigInt(nonce), BigInt(deadline)]
        )
      ) as `0x${string}`;

      const transactionIntent = {
        target: targetContract as `0x${string}`,
        value: BigInt(0),
        id: intentId,
        nodeAddress: nodeAddr as `0x${string}`,
        nonce: BigInt(nonce),
        deadline: BigInt(deadline)
      };

      console.log('TransactionIntent:', transactionIntent);

      // Hash for signing
      const intentHash = keccak256(
        encodePacked(
          ['address', 'uint256', 'bytes32', 'address', 'uint256', 'uint256'],
          [
            transactionIntent.target,
            transactionIntent.value,
            transactionIntent.id,
            transactionIntent.nodeAddress,
            transactionIntent.nonce,
            transactionIntent.deadline
          ]
        )
      );

      console.log('intentHash:', intentHash);

      // Request signature
      let signature: `0x${string}`;
      try {
        signature = await provider.request({
          method: 'personal_sign',
          params: [intentHash, embeddedWalletObj.address]
        }) as `0x${string}`;
      } catch (signError) {
        const errorMessage = signError instanceof Error ? signError.message : String(signError);
        setIntentError(`Failed to get signature: ${errorMessage}`);
        setProcessing(false);
        return;
      }

      console.log('Signature:', signature);

      try {
        console.log('Validating signature on-chain...');
        const { ethers: validationEthers } = await import('ethers');
        const validationProvider = new validationEthers.JsonRpcProvider(RPC_URL);
        const iface = new validationEthers.Interface(DelegatedAccountABI);
        console.log('DelegatedAccountABI Interface created');
         const intentStruct = {
          target: transactionIntent.target,
          value: transactionIntent.value.toString(),
          id: transactionIntent.id,
          nodeAddress: transactionIntent.nodeAddress,
          nonce: transactionIntent.nonce.toString(),
          deadline: transactionIntent.deadline.toString()
        };
        console.log('Intent Struct:', intentStruct);

        console.log(iface)

        const calldata = iface.encodeFunctionData('validateIntentSignature', [
          [
            intentStruct.target,
            intentStruct.value,
            intentStruct.id,
            intentStruct.nodeAddress,
            intentStruct.nonce,
            intentStruct.deadline
          ],
          signature
        ]);

        console.log('\n\n');
        console.log('Calldata for validation:', calldata);
        console.log('\n-----------------------------\n');
        console.log('target:', intentStruct.target)
        console.log('value:', intentStruct.value);
        console.log('id:', intentStruct.id);
        console.log('nodeAddress:', intentStruct.nodeAddress);
        console.log('nonce:', intentStruct.nonce);
        console.log('deadline:', intentStruct.deadline);
        console.log('signature:', signature);

        console.log('\n\n');

        const result = await validationProvider.call({
          to: embeddedWalletObj.address,
          data: calldata
        });

        const [isValid, signer] = iface.decodeFunctionResult('validateIntentSignature', result);

        console.log('Validation result:', { isValid, signer });

        if (!isValid) {
          setIntentError('Signature validation failed. The signature does not match the wallet address.');
          setProcessing(false);
          return;
        }
      } catch (validationError) {
        const errorMessage = validationError instanceof Error ? validationError.message : String(validationError);
        setIntentError(`Signature validation error: ${errorMessage}`);
        setProcessing(false);
        return;
      }
      setIntentResult("TransactionIntent processed successfully!");
    } catch (err: any) {
      setIntentError(err.message || "Unknown error");
    }
    setProcessing(false);
  };


  // Debug logging
  useEffect(() => {
    console.log('Dashboard Debug Info:');
    console.log('- Smart Contract Address:', smartContractAddress);
    console.log('- Embedded Wallet Address:', embeddedWallet?.address);
    console.log('- Show Authorization Section:', embeddedWallet?.address && smartContractAddress && smartContractAddress !== '0x0000000000000000000000000000000000000000');
  }, [smartContractAddress, embeddedWallet?.address]);

  // Check if delegated account is initialized
  useEffect(() => {
    if (embeddedWallet?.address) {
      checkInitialized();
    }
  }, [embeddedWallet?.address, checkInitialized]);

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
                      {smartContractAddress && smartContractAddress !== '0x0000000000000000000000000000000000000000' && smartContractAddress !== '0' && (
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

                {embeddedWallet?.address && smartContractAddress && smartContractAddress !== '0x0000000000000000000000000000000000000000' && smartContractAddress !== '0' && (
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-1 gap-3">
                      <Button
                        onClick={initializeAccount}
                        disabled={isInitializing || isInitialized || !isAuthorized}
                        variant={isInitialized ? "outline" : "default"}
                        className="flex items-center justify-center"
                      >
                        {isInitializing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Initializing Account...
                          </>
                        ) : (
                          <>
                            <Zap className="mr-2 h-4 w-4" />
                            {isInitialized ? 'Account Initialized' : 'Initialize Delegated Account'}
                          </>
                        )}
                      </Button>
                      
                      <Button
                        onClick={async () => {
                          const result = await enableSmartAccount();
                          if (result) {
                            // Success feedback could be added here
                          }
                        }}
                        disabled={authLoading || waitingForTx || isAuthorized}
                        variant={isAuthorized ? "outline" : "default"}
                        className="flex items-center justify-center"
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
                    </div>

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
              <div style={{ marginTop: 32, padding: 24, border: "1px solid #eee", borderRadius: 8 }}>
                <h3>Transaction Intent Workflow</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 400 }}>
                  <input
                    type="text"
                    placeholder="Node Address"
                    value={nodeAddress}
                    onChange={e => setNodeAddress(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Target Contract"
                    value={targetContract}
                    onChange={e => setTargetContract(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Target Owner"
                    value={targetOwner}
                    onChange={e => setTargetOwner(e.target.value)}
                  />
                  <button onClick={handleProcessIntent} disabled={processing}>
                    {processing ? "Processing..." : "Process Transaction Intent"}
                  </button>
                  {intentError && <div style={{ color: "red" }}>{intentError}</div>}
                  {intentResult && <div style={{ color: "green" }}>{intentResult}</div>}
                </div>
              </div>
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="text-lg font-medium">Test Workflow Execution</h3>
                <p className="text-sm text-muted-foreground">
                  Execute the real estate property analysis workflow using KRNL network
                </p>
                
                {/* Test Workflow Execution UI */}
                <div className="space-y-2">
                  <Button
                    onClick={() => setShowWorkflowInput(true)}
                    disabled={isExecuting}
                    className="flex items-center justify-center"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Test Scenario
                  </Button>

                  {showWorkflowInput && (
                    <div className="border rounded-lg p-4 mt-2 space-y-3 bg-muted/30">
                      <label className="block text-sm font-medium mb-1">
                        Workflow Parameter (JSON)
                      </label>
                      <textarea
                        className="w-full p-2 border rounded text-sm font-mono"
                        rows={4}
                        value={workflowInput}
                        onChange={e => setWorkflowInput(e.target.value)}
                        placeholder='{"propertyId": "123", "analysisType": "basic"}'
                      />
                      <div className="flex space-x-2">
                        <Button
                          onClick={async () => {
                            await executeWorkflow(workflowInput);
                            setShowWorkflowInput(false);
                          }}
                          disabled={isExecuting || !workflowInput}
                          className="flex items-center justify-center"
                        >
                          {isExecuting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Play className="mr-2 h-4 w-4" />
                              Process
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShowWorkflowInput(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                

                {/* Init Data Button using useDelegatedAccount */}
                <Button
                  onClick={initializeAccount}
                  disabled={isInitializing}
                  className="flex items-center justify-center"
                  variant={isInitialized ? "destructive" : "default"}
                >
                  {isInitializing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Initializing Data...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      {isInitialized ? 'Force Init Data' : 'Init Data'}
                    </>
                  )}
                </Button>

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

              {/* ERC20 Approve UI */}
              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <h3 className="text-lg font-medium">ERC20 Approve</h3>
                <label className="block text-sm font-medium mb-1">Contract Address to Approve</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded text-sm font-mono"
                  placeholder="0x..."
                  value={erc20ApproveAddress}
                  onChange={e => setErc20ApproveAddress(e.target.value)}
                />
                <Button
                  onClick={async () => {
                    setErc20ApproveLoading(true);
                    await approveERC20Max(erc20ApproveAddress);
                    setErc20ApproveLoading(false);
                  }}
                  disabled={!erc20ApproveAddress || erc20ApproveLoading}
                  className="flex items-center justify-center"
                >
                  {erc20ApproveLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>Process</>
                  )}
                </Button>
                {delegatedError && (
                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded">Error: {delegatedError}</div>
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