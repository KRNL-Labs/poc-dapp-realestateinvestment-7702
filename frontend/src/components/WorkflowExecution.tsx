import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Play, Coins } from 'lucide-react';
import toast from 'react-hot-toast';

interface WorkflowExecutionProps {
  isAuthorized: boolean;
  currentStep: number;
  activeScenario: 'A' | 'B' | null;
  propertyAddress: string;
  cityStateZip: string;
  usdcAmount: string;
  validationErrors: {
    propertyAddress: string;
    cityStateZip: string;
    usdcAmount: string;
  };
  executeWorkflow: (scenarioType: 'A' | 'B', propertyAddress?: string, cityStateZip?: string, usdcAmount?: string) => Promise<void>;
  mintUSDC: () => Promise<any>;
  isMintingUSDC: boolean;
  usdcBalance: string;
  isLoadingUSDC: boolean;
  refetchUSDC: () => Promise<void>;
  onPropertyAddressChange: (value: string) => void;
  onCityStateZipChange: (value: string) => void;
  onUsdcAmountChange: (value: string) => void;
  onActiveScenarioChange: (scenario: 'A' | 'B' | null) => void;
  validateInputs: (scenarioType?: 'A' | 'B') => boolean;
  balance: string;
}

export const WorkflowExecution = ({
  isAuthorized,
  currentStep,
  activeScenario,
  propertyAddress,
  cityStateZip,
  usdcAmount,
  validationErrors,
  executeWorkflow,
  mintUSDC,
  isMintingUSDC,
  usdcBalance,
  isLoadingUSDC,
  refetchUSDC,
  onPropertyAddressChange,
  onCityStateZipChange,
  onUsdcAmountChange,
  onActiveScenarioChange,
  validateInputs,
  balance
}: WorkflowExecutionProps) => {
  const validateRequirements = (scenarioType: 'A' | 'B'): boolean => {
    // Check smart account authorization
    if (!isAuthorized) {
      toast.error('Smart account must be authorized first');
      return false;
    }

    // Check embedded wallet balance > 0.03 ETH
    if (parseFloat(balance) <= 0.03) {
      toast.error('Insufficient balance. You need more than 0.03 ETH to execute workflows.');
      return false;
    }

    // For scenario B, check USDC balance > 1000
    if (scenarioType === 'B' && parseFloat(usdcBalance) <= 1000) {
      toast.error('USDC balance must be greater than 1000 for property purchase');
      return false;
    }

    return true;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow Execution</CardTitle>
        <CardDescription>Execute real estate analysis or purchase workflows</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Scenario A: Property Analysis */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Scenario A: Property Analysis</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="propertyAddress">Property Address</Label>
                <Input
                  id="propertyAddress"
                  value={propertyAddress}
                  onChange={(e) => onPropertyAddressChange(e.target.value)}
                  placeholder="e.g., 1234-Maple-Street"
                  disabled={currentStep > 0}
                  className={validationErrors.propertyAddress ? 'border-red-500' : ''}
                />
                {validationErrors.propertyAddress && (
                  <p className="text-sm text-red-500 mt-1">{validationErrors.propertyAddress}</p>
                )}
              </div>
              <div>
                <Label htmlFor="cityStateZip">City, State</Label>
                <Input
                  id="cityStateZip"
                  value={cityStateZip}
                  onChange={(e) => onCityStateZipChange(e.target.value)}
                  placeholder="e.g., Austin,TX"
                  disabled={currentStep > 0}
                  className={validationErrors.cityStateZip ? 'border-red-500' : ''}
                />
                {validationErrors.cityStateZip && (
                  <p className="text-sm text-red-500 mt-1">{validationErrors.cityStateZip}</p>
                )}
              </div>
              <Button
                onClick={async () => {
                  if (validateRequirements('A') && validateInputs('A')) {
                    onActiveScenarioChange('A');
                    await executeWorkflow('A', propertyAddress, cityStateZip);
                  }
                }}
                disabled={currentStep > 0}
                className="w-full"
              >
                {currentStep > 0 && activeScenario === 'A' ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing Analysis...</>
                ) : (
                  <><Play className="mr-2 h-4 w-4" />Run Property Analysis</>
                )}
              </Button>
            </div>
          </div>

          {/* Scenario B: Property Purchase */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Scenario B: Property Purchase</h3>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={async () => {
                    await mintUSDC();
                    await refetchUSDC();
                  }}
                  disabled={isMintingUSDC}
                  variant="outline"
                  size="sm"
                >
                  {isMintingUSDC ? (
                    <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Minting...</>
                  ) : (
                    <><Coins className="mr-2 h-3 w-3" />Mint USDC</>
                  )}
                </Button>
                <div className="text-xs text-muted-foreground">
                  Balance: {isLoadingUSDC ? '...' : `${usdcBalance} USDC`}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="propertyAddressB">Property Address</Label>
                <Input
                  id="propertyAddressB"
                  value={propertyAddress}
                  onChange={(e) => onPropertyAddressChange(e.target.value)}
                  placeholder="e.g., 1234-Maple-Street"
                  disabled={currentStep > 0}
                  className={validationErrors.propertyAddress ? 'border-red-500' : ''}
                />
                {validationErrors.propertyAddress && (
                  <p className="text-sm text-red-500 mt-1">{validationErrors.propertyAddress}</p>
                )}
              </div>
              <div>
                <Label htmlFor="cityStateZipB">City, State</Label>
                <Input
                  id="cityStateZipB"
                  value={cityStateZip}
                  onChange={(e) => onCityStateZipChange(e.target.value)}
                  placeholder="e.g., Austin,TX"
                  disabled={currentStep > 0}
                  className={validationErrors.cityStateZip ? 'border-red-500' : ''}
                />
                {validationErrors.cityStateZip && (
                  <p className="text-sm text-red-500 mt-1">{validationErrors.cityStateZip}</p>
                )}
              </div>
              <div>
                <Label htmlFor="usdcAmount">USDC Amount</Label>
                <Input
                  id="usdcAmount"
                  type="number"
                  value={usdcAmount}
                  onChange={(e) => onUsdcAmountChange(e.target.value)}
                  placeholder="e.g., 100"
                  disabled={currentStep > 0}
                  min="1"
                  step="1"
                  className={validationErrors.usdcAmount ? 'border-red-500' : ''}
                />
                {validationErrors.usdcAmount && (
                  <p className="text-sm text-red-500 mt-1">{validationErrors.usdcAmount}</p>
                )}
              </div>
              <Button
                onClick={async () => {
                  if (validateRequirements('B') && validateInputs('B')) {
                    onActiveScenarioChange('B');
                    await executeWorkflow('B', propertyAddress, cityStateZip, usdcAmount);
                  }
                }}
                disabled={currentStep > 0}
                variant="outline"
                className="w-full"
              >
                {currentStep > 0 && activeScenario === 'B' ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing Purchase...</>
                ) : (
                  <><Play className="mr-2 h-4 w-4" />Purchase Property</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};