/**
 * Example component showing how to use KRNL SDK directly
 * This demonstrates the simplified API after SDK integration
 */
import React from 'react';
import { useKRNLAuth } from '../../../sdk/src';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Loader2, CheckCircle } from 'lucide-react';

export const KRNLAuthExample: React.FC = () => {
  const {
    // Wallet info
    embeddedWallet,
    isWalletConnected,

    // Authentication states
    isAuthenticated,
    isReady,
    walletsReady,

    // Authorization states
    isAuthorized,
    smartAccountEnabled,
    contractAddress,

    // Loading and error states
    isLoading,
    error,
    isInitialized,

    // Actions
    enableSmartAccount,
    checkAuth,
  } = useKRNLAuth();

  const handleAuthorize = async () => {
    const success = await enableSmartAccount();
    if (success) {
      console.log('✅ Smart account enabled successfully!');
    }
  };

  const handleRefresh = async () => {
    await checkAuth();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          KRNL Smart Account
        </CardTitle>
        <CardDescription>
          Direct SDK integration example - no wrapper hooks needed
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Display */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Wallet Connected:</span>
            <span className={isWalletConnected ? 'text-green-600' : 'text-gray-500'}>
              {isWalletConnected ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Authenticated:</span>
            <span className={isAuthenticated ? 'text-green-600' : 'text-gray-500'}>
              {isAuthenticated ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>SDK Ready:</span>
            <span className={isInitialized ? 'text-green-600' : 'text-gray-500'}>
              {isInitialized ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Smart Account:</span>
            <span className={isAuthorized ? 'text-green-600' : 'text-gray-500'}>
              {isAuthorized ? 'Authorized' : 'Not Authorized'}
            </span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Contract Address */}
        {contractAddress && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="text-xs text-blue-600 font-medium">Contract Address</div>
            <div className="text-xs font-mono mt-1">{contractAddress}</div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleAuthorize}
            disabled={
              isLoading ||
              isAuthorized ||
              !isAuthenticated ||
              !isReady ||
              !walletsReady
            }
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : isAuthorized ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Already Authorized
              </>
            ) : (
              'Authorize Smart Account'
            )}
          </Button>
          <Button
            onClick={handleRefresh}
            variant="outline"
            disabled={isLoading}
          >
            Refresh
          </Button>
        </div>

        {/* Debug Info */}
        <details className="text-xs">
          <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
            Debug Info
          </summary>
          <pre className="mt-2 p-2 bg-gray-50 rounded text-[10px] overflow-auto">
{JSON.stringify({
  wallet: embeddedWallet?.address,
  isWalletConnected,
  isAuthenticated,
  isReady,
  walletsReady,
  isAuthorized,
  smartAccountEnabled,
  isInitialized,
  contractAddress
}, null, 2)}
          </pre>
        </details>
      </CardContent>
    </Card>
  );
};