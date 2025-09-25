import { usePrivy } from '@privy-io/react-auth';
import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { LogOut, Loader2, Play, Wallet, Copy, ExternalLink, RefreshCw, Coins, Shield, CheckCircle, XCircle, Settings } from 'lucide-react';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { useKRNL } from '@krnl-dev/sdk-react';
import { useTestScenario } from '@/hooks/useTestScenario';
import { useMintUSDC } from '@/hooks/useMintUSDC';
import { useUSDCBalance } from '@/hooks/useUSDCBalance';
import { formatAddress, getChainName, switchNetwork, formatBalance, getChainCurrency, getExplorerUrl, copyToClipboard, logger } from '@/utils';

const Dashboard = () => {
  const { logout } = usePrivy();
  const { balance, isLoading: balanceLoading, wallet: embeddedWallet, chainInfo, isSwitching, refetch } = useWalletBalance();
  const {
    isAuthorized,
    smartAccountEnabled,
    isLoading: authLoading,
    error: authError,
    enableSmartAccount,
    checkAuth: refreshStatus,
    delegatedContractAddress,
    isAuthenticated,
    isReady,
    walletsReady,
  } = useKRNL();

  const smartContractAddress = delegatedContractAddress || import.meta.env.VITE_DELEGATED_ACCOUNT_ADDRESS as string;
  const { executeWorkflow, isSubmitting, isWaitingForTransaction, submissionResult, executionResult, error: workflowError } = useTestScenario();
  const { mintUSDC, isMinting: isMintingUSDC } = useMintUSDC();
  const { usdcBalance, isLoading: isLoadingUSDC, refetch: refetchUSDC } = useUSDCBalance();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSwitchingToSepolia, setIsSwitchingToSepolia] = useState(false);
  const [activeScenario, setActiveScenario] = useState<'A' | 'B' | null>(null);
  const [propertyAddress, setPropertyAddress] = useState('1234-Maple-Street');
  const [cityStateZip, setCityStateZip] = useState('Austin,TX');
  const [usdcAmount, setUsdcAmount] = useState('1000');
  const [copied, setCopied] = useState(false);
  const [copiedSmart, setCopiedSmart] = useState(false);

  // Validation states
  const [validationErrors, setValidationErrors] = useState({
    propertyAddress: '',
    cityStateZip: '',
    usdcAmount: ''
  });

  // Modal state
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
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

  // Reset active scenario when workflow completes or errors
  useEffect(() => {
    if (!isSubmitting && !isWaitingForTransaction && (executionResult || workflowError)) {
      const timer = setTimeout(() => setActiveScenario(null), 5000); // Reset after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [isSubmitting, isWaitingForTransaction, executionResult, workflowError]);

  // Open modal when workflow starts submitting (after signing)
  useEffect(() => {
    if (isSubmitting && activeScenario) {
      setIsTrackingModalOpen(true);
    }
  }, [isSubmitting, activeScenario]);

  // Handle modal close - clear tracking status
  const handleModalClose = (open: boolean) => {
    setIsTrackingModalOpen(open);
    if (!open) {
      // Clear tracking states when modal is closed
      setActiveScenario(null);
    }
  };

  const handleCopyAddress = useCallback(async () => {
    if (!embeddedWallet?.address) return;
    const result = await copyToClipboard(embeddedWallet.address);
    if (result.success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      logger.error('Failed to copy address:', result.error);
    }
  }, [embeddedWallet?.address]);

  const handleViewExplorer = useCallback(() => {
    if (!embeddedWallet?.address || !chainInfo?.providerChainIdDecimal) return;
    window.open(getExplorerUrl(embeddedWallet.address, chainInfo.providerChainIdDecimal), '_blank');
  }, [embeddedWallet?.address, chainInfo?.providerChainIdDecimal]);

  const handleCopySmartAddress = useCallback(async () => {
    if (!smartContractAddress) return;
    const result = await copyToClipboard(smartContractAddress);
    if (result.success) {
      setCopiedSmart(true);
      setTimeout(() => setCopiedSmart(false), 2000);
    } else {
      logger.error('Failed to copy smart contract address:', result.error);
    }
  }, [smartContractAddress]);

  const currency = getChainCurrency(chainInfo?.providerChainIdDecimal);
  const isValidSmartContract = smartContractAddress &&
    smartContractAddress !== '0x0000000000000000000000000000000000000000' &&
    smartContractAddress !== '0x';

  // Validation functions
  const validatePropertyAddress = (address: string): string => {
    if (!address.trim()) return 'Property address is required';
    if (address.trim().length < 3) return 'Property address must be at least 3 characters';
    if (!/^[a-zA-Z0-9\s\-,.#]+$/.test(address)) return 'Property address contains invalid characters';
    return '';
  };

  const validateCityStateZip = (cityStateZip: string): string => {
    if (!cityStateZip.trim()) return 'City, State ZIP is required';
    if (cityStateZip.trim().length < 3) return 'City, State ZIP must be at least 3 characters';
    if (!/^[a-zA-Z0-9\s\-,.]+$/.test(cityStateZip)) return 'City, State ZIP contains invalid characters';
    return '';
  };

  const validateUsdcAmount = (amount: string): string => {
    if (!amount.trim()) return 'USDC amount is required';
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return 'USDC amount must be a valid number';
    if (numAmount <= 0) return 'USDC amount must be greater than 0';
    if (numAmount < 1000) return 'USDC amount must be at least 1,000';
    if (numAmount > 1000000) return 'USDC amount cannot exceed 1,000,000';
    return '';
  };

  const validateInputs = (): boolean => {
    const errors = {
      propertyAddress: validatePropertyAddress(propertyAddress),
      cityStateZip: validateCityStateZip(cityStateZip),
      usdcAmount: validateUsdcAmount(usdcAmount)
    };

    setValidationErrors(errors);
    return !Object.values(errors).some(error => error !== '');
  };

  // Input change handlers with validation
  const handlePropertyAddressChange = (value: string) => {
    setPropertyAddress(value);
    if (validationErrors.propertyAddress) {
      setValidationErrors(prev => ({ ...prev, propertyAddress: validatePropertyAddress(value) }));
    }
  };

  const handleCityStateZipChange = (value: string) => {
    setCityStateZip(value);
    if (validationErrors.cityStateZip) {
      setValidationErrors(prev => ({ ...prev, cityStateZip: validateCityStateZip(value) }));
    }
  };

  const handleUsdcAmountChange = (value: string) => {
    setUsdcAmount(value);
    if (validationErrors.usdcAmount) {
      setValidationErrors(prev => ({ ...prev, usdcAmount: validateUsdcAmount(value) }));
    }
  };



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

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Account Management Section */}
        <Card>
          <CardHeader>
            <CardTitle>Account Management</CardTitle>
            <CardDescription>Manage your wallet and smart account settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Embedded Wallet Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Wallet className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Embedded Wallet</h3>
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

                <div className="space-y-3">
                  {/* Address Row */}
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Address</span>
                    <div className="flex items-center space-x-2">
                      {!embeddedWallet?.address ? (
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
                            onClick={handleCopyAddress}
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

                  {/* Network Row */}
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Network</span>
                    <div className="flex items-center space-x-2">
                      {(isSwitching || isSwitchingToSepolia) ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span className="text-sm">Switching...</span>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-medium">{chainName}</span>
                          {chainInfo?.providerChainIdDecimal !== 11155111 && (
                            <Button
                              onClick={switchToSepolia}
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                            >
                              Switch to Sepolia
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Balance Row */}
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Balance</span>
                    <div className="flex items-center space-x-2">
                      {!embeddedWallet?.address || balanceLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <span className="text-sm font-medium">
                          {formatBalance(balance)} {currency}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* USDC Balance Row */}
                  {chainInfo?.providerChainIdDecimal === 11155111 && (
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground">USDC Balance</span>
                      <div className="flex items-center space-x-2">
                        {!embeddedWallet?.address || isLoadingUSDC ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <span className="text-sm font-medium">
                            {formatBalance(usdcBalance)} USDC
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {embeddedWallet?.address && (
                  <div className="flex space-x-2 pt-2">
                    <Button
                      onClick={handleViewExplorer}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <ExternalLink className="mr-2 h-3 w-3" />
                      View on Explorer
                    </Button>
                    {chainInfo?.providerChainIdDecimal === 11155111 && (
                      <Button
                        onClick={async () => {
                          const result = await mintUSDC();
                          if (result.success) {
                            await Promise.all([refetch(), refetchUSDC()]);
                          }
                          return result;
                        }}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        disabled={isMintingUSDC}
                      >
                        {isMintingUSDC ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Minting...
                          </>
                        ) : (
                          <>
                            <Coins className="mr-2 h-3 w-3" />
                            Mint 1M USDC
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )}

                {/* Copy Feedback */}
                {copied && (
                  <div className="text-center text-sm text-green-600">
                    Address copied to clipboard!
                  </div>
                )}
              </div>

              {/* Smart Account Section */}
              <div className="lg:border-l lg:border-border lg:pl-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Shield className="h-5 w-5 text-primary" />
                      <h3 className="text-lg font-semibold">Smart Account Authorization</h3>
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
                  <p className="text-sm text-muted-foreground">
                    Manage EIP-7702 delegation and smart contract approvals for enhanced functionality
                  </p>

                  <div className="space-y-3">
                    {/* Authorization Status */}
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

                    {/* Smart Contract Address */}
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground">KRNL Smart Account Address</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs">
                          {smartContractAddress ?
                            formatAddress(smartContractAddress, 6) :
                            'Not configured'
                          }
                        </span>
                        {isValidSmartContract && (
                          <Button
                            onClick={handleCopySmartAddress}
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Transaction Broadcasting */}
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground">Transaction Broadcasting</span>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-600 font-medium">Privy Embedded Wallet</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {embeddedWallet?.address && isValidSmartContract && (
                    <div className="space-y-3 pt-4">
                      <Button
                        onClick={async () => { await enableSmartAccount(); }}
                        disabled={authLoading || isAuthorized || !isAuthenticated || !isReady || !walletsReady}
                        variant={isAuthorized ? "outline" : "default"}
                        className="w-full flex items-center justify-center"
                      >
                        {authLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Settings className="mr-2 h-4 w-4" />
                            {isAuthorized
                              ? 'Already Authorized'
                              : !isAuthenticated || !isReady || !walletsReady
                                ? 'Authentication Required'
                                : 'Authorize Smart Account'
                            }
                          </>
                        )}
                      </Button>

                      {/* Error Display */}
                      {authError && (
                        <div className="text-center text-sm text-red-600 bg-red-50 p-2 rounded">
                          Error: {authError}
                        </div>
                      )}

                      {/* Info Text */}
                      <div className="text-xs text-muted-foreground text-center space-y-1">
                        <div>Uses EIP-7702 delegation for secure smart contract interactions</div>
                        <div className="text-green-600">Powered by Privy Embedded Wallet</div>
                      </div>
                    </div>
                  )}

                  {/* Copy Feedback */}
                  {copiedSmart && (
                    <div className="text-center text-sm text-green-600">
                      Smart contract address copied to clipboard!
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Workflow Execution Section */}
        <Card>
          <CardHeader>
            <CardTitle>Workflow Execution</CardTitle>
            <CardDescription>Execute real estate investment workflows</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Property Analysis */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Property Analysis</h3>
                  <p className="text-sm text-muted-foreground">Analyze property investment potential with AI-powered insights</p>
                </div>

                <p className="text-sm text-muted-foreground">Submit property data for comprehensive investment analysis including market valuation, expected yields, and investment grade rating.</p>

                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="property-address-a">Property Address</Label>
                    <Input
                      id="property-address-a"
                      value={propertyAddress}
                      onChange={(e) => handlePropertyAddressChange(e.target.value)}
                      placeholder="e.g., 1234-Maple-Street"
                      disabled={isSubmitting || isWaitingForTransaction}
                      className={validationErrors.propertyAddress ? 'border-red-500' : ''}
                    />
                    {validationErrors.propertyAddress && (
                      <p className="text-sm text-red-600">{validationErrors.propertyAddress}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city-state-zip-a">City, State ZIP</Label>
                    <Input
                      id="city-state-zip-a"
                      value={cityStateZip}
                      onChange={(e) => handleCityStateZipChange(e.target.value)}
                      placeholder="e.g., Austin,TX"
                      disabled={isSubmitting || isWaitingForTransaction}
                      className={validationErrors.cityStateZip ? 'border-red-500' : ''}
                    />
                    {validationErrors.cityStateZip && (
                      <p className="text-sm text-red-600">{validationErrors.cityStateZip}</p>
                    )}
                  </div>
                </div>

                <Button
                  onClick={async () => {
                    if (validateInputs()) {
                      setActiveScenario('A');
                      executeWorkflow('A', propertyAddress, cityStateZip);
                    }
                  }}
                  disabled={!isAuthorized || isSubmitting || isWaitingForTransaction}
                  className="w-full"
                >
                  {(isSubmitting || isWaitingForTransaction) && activeScenario === 'A' ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isSubmitting ? 'Submitting Analysis...' : 'Processing...'}</>
                  ) : (
                    <><Play className="mr-2 h-4 w-4" />Run Property Analysis</>
                  )}
                </Button>

              </div>

              {/* Divider */}
              <div className="lg:border-l lg:border-border lg:pl-6">
                {/* Property Purchase */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Property Purchase</h3>
                    <p className="text-sm text-muted-foreground">Buy fractional ownership tokens in analyzed properties</p>
                  </div>

                  <p className="text-sm text-muted-foreground">Purchase property investment tokens using USDC. Tokens represent fractional ownership in the real estate investment pool.</p>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="property-address-b">Property Address</Label>
                      <Input
                        id="property-address-b"
                        value={propertyAddress}
                        onChange={(e) => handlePropertyAddressChange(e.target.value)}
                        placeholder="e.g., 1234-Maple-Street"
                        disabled={isSubmitting || isWaitingForTransaction}
                        className={validationErrors.propertyAddress ? 'border-red-500' : ''}
                      />
                      {validationErrors.propertyAddress && (
                        <p className="text-sm text-red-600">{validationErrors.propertyAddress}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city-state-zip-b">City, State ZIP</Label>
                      <Input
                        id="city-state-zip-b"
                        value={cityStateZip}
                        onChange={(e) => handleCityStateZipChange(e.target.value)}
                        placeholder="e.g., Austin,TX"
                        disabled={isSubmitting || isWaitingForTransaction}
                        className={validationErrors.cityStateZip ? 'border-red-500' : ''}
                      />
                      {validationErrors.cityStateZip && (
                        <p className="text-sm text-red-600">{validationErrors.cityStateZip}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="usdc-amount-b">USDC Amount</Label>
                      <Input
                        id="usdc-amount-b"
                        type="number"
                        value={usdcAmount}
                        onChange={(e) => handleUsdcAmountChange(e.target.value)}
                        placeholder="e.g., 100"
                        disabled={isSubmitting || isWaitingForTransaction}
                        min="1"
                        step="1"
                        className={validationErrors.usdcAmount ? 'border-red-500' : ''}
                      />
                      {validationErrors.usdcAmount && (
                        <p className="text-sm text-red-600">{validationErrors.usdcAmount}</p>
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={async () => {
                      if (validateInputs()) {
                        setActiveScenario('B');
                        executeWorkflow('B', propertyAddress, cityStateZip, usdcAmount);
                      }
                    }}
                    disabled={!isAuthorized || isSubmitting || isWaitingForTransaction}
                    variant="outline"
                    className="w-full"
                  >
                    {(isSubmitting || isWaitingForTransaction) && activeScenario === 'B' ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isSubmitting ? 'Processing Purchase...' : 'Executing...'}</>
                    ) : (
                      <><Play className="mr-2 h-4 w-4" />Purchase Property</>
                    )}
                  </Button>

                </div>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Workflow Tracking Modal */}
        <Dialog open={isTrackingModalOpen} onOpenChange={handleModalClose}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader className="text-center">
              <DialogTitle className="flex items-center justify-center gap-2">
                {activeScenario === 'A' ? (
                  <>
                    <Play className="h-5 w-5 text-blue-600" />
                    Property Analysis in Progress
                  </>
                ) : (
                  <>
                    <Coins className="h-5 w-5 text-green-600" />
                    Property Purchase in Progress
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                Please wait while we process your {activeScenario === 'A' ? 'property analysis' : 'property purchase'} request
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="space-y-4">
                {/* Step 1: Submit to KRNL Node */}
                <WorkflowStep
                  icon={isSubmitting ? 'loading' : submissionResult ? 'success' : 'pending'}
                  title="Submit to KRNL Node"
                  description={isSubmitting ? 'Submitting workflow...' : submissionResult ? 'Submitted successfully' : 'Waiting to submit'}
                  status={isSubmitting ? 'Processing...' : undefined}
                />

                {/* Step 2: KRNL Node Execution */}
                <WorkflowStep
                  icon={submissionResult && !executionResult ? 'loading' : executionResult ? 'success' : 'pending'}
                  title="KRNL Node Execution"
                  description={
                    submissionResult && !executionResult
                      ? 'Processing workflow steps on KRNL network...'
                      : executionResult
                        ? 'Workflow execution completed successfully'
                        : 'Waiting for KRNL network execution'
                  }
                  status={submissionResult && !executionResult ? 'Executing...' : undefined}
                />

                {/* Step 3: On-chain Execution */}
                <WorkflowStep
                  icon={executionResult ? 'success' : 'pending'}
                  title="On-chain Execution"
                  description={executionResult ? 'Transaction confirmed on blockchain' : 'Waiting for blockchain execution'}
                />
              </div>

              {/* Error Display */}
              {workflowError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <h4 className="font-medium text-red-800">Error Occurred</h4>
                  </div>
                  <p className="text-sm text-red-700 mt-1">{workflowError}</p>
                </div>
              )}

              {/* Success Results */}
              {executionResult && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <h4 className="font-medium text-green-800">
                      {activeScenario === 'A' ? 'Analysis Completed!' : 'Purchase Completed!'}
                    </h4>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transaction Hash:</span>
                      <a
                        href={`https://sepolia.etherscan.io/tx/${executionResult.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline font-mono"
                      >
                        {formatAddress(executionResult.transactionHash)}
                      </a>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Block Number:</span>
                      <span className="font-mono">{executionResult.blockNumber}</span>
                    </div>
                    {submissionResult && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Workflow ID:</span>
                        <span className="font-mono text-xs">{submissionResult.id}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Close button for completed workflows */}
              {(executionResult || workflowError) && (
                <div className="flex justify-center pt-2">
                  <Button
                    onClick={() => setIsTrackingModalOpen(false)}
                    variant="outline"
                    className="w-full"
                  >
                    Close
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

const WorkflowStep = ({
  icon,
  title,
  description,
  status
}: {
  icon: 'loading' | 'success' | 'pending';
  title: string;
  description: string;
  status?: string;
}) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      {icon === 'loading' ? (
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
      ) : icon === 'success' ? (
        <CheckCircle className="h-5 w-5 text-green-600" />
      ) : (
        <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
      )}
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
    {status && (
      <div className="text-sm text-blue-600 font-medium">{status}</div>
    )}
  </div>
);

export default Dashboard;