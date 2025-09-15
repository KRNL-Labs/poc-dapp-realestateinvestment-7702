import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useWallets } from '@privy-io/react-auth';
import { encodePacked, keccak256 } from 'viem';
import testScenarioData from '@/test-scenario.json';
import {
  createTransactionIntent,
  getCurrentNonce
} from '@/utils/transactionIntent';

const REAL_ESTATE_INVESTMENT_ADDRESS = import.meta.env.VITE_REAL_ESTATE_INVESTMENT_ADDRESS;

interface TestScenarioButtonProps {
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
}

export function TestScenarioButton({
  onSuccess,
  onError
}: TestScenarioButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { wallets } = useWallets();

  // Find ONLY embedded wallet - strictly filter for Privy embedded wallets
  const embeddedWallet = wallets.find(wallet =>
    wallet.connectorType === 'embedded' &&
    wallet.walletClientType === 'privy'
  ) || null;

  const handleTestScenario = async () => {
    if (!embeddedWallet?.address) {
      console.error('No embedded wallet found');
      onError?.(new Error('Please connect your embedded wallet first'));
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Get provider and current nonce from contract
      const provider = await embeddedWallet.getEthereumProvider();

      // Ensure we're on the right network first
      await embeddedWallet.switchChain(11155111); // Sepolia

      // Fixed nonce to 0 for testing
      const nonce = 0;
      const destinations = [REAL_ESTATE_INVESTMENT_ADDRESS];
      const values = [BigInt(0)]; // No ETH value for this transaction

      const transactionIntent = createTransactionIntent(
        destinations,
        values,
        embeddedWallet.address,
        nonce
      );

      console.log('Created TransactionIntent:', transactionIntent);

      // Step 2: Create hash for signing
      const intentHash = keccak256(
        encodePacked(
          ['address[]', 'uint256[]', 'uint256', 'uint256', 'bytes32'],
          [
            transactionIntent.destinations,
            transactionIntent.values,
            transactionIntent.nonce,
            transactionIntent.deadline,
            transactionIntent.id
          ]
        )
      );

      console.log('Intent hash to sign:', intentHash);

      // Step 3: Request signature from user using Privy embedded wallet

      console.log('Requesting signature from user...');
      console.log('Provider:', provider);
      console.log('Wallet address:', embeddedWallet.address);

      let signature: `0x${string}`;
      try {
        // Use personal_sign for message signing - this should trigger Privy popup
        // Format: personal_sign requires hex string
        signature = await provider.request({
          method: 'personal_sign',
          params: [intentHash, embeddedWallet.address]
        }) as `0x${string}`;

        console.log('User signature obtained:', signature);
      } catch (signError: any) {
        console.error('Signature request failed:', signError);
        throw new Error(`Failed to get signature: ${signError.message || signError}`);
      }

      // Step 4: Prepare the workflow with signature
      const workflowData = JSON.parse(JSON.stringify(testScenarioData));

      // Replace placeholders with actual values including signature
      const replacePlaceholders = (obj: any): any => {
        if (typeof obj === 'string') {
          return obj
            .replace(/\{\{ENV\.SENDER_ADDRESS\}\}/g, embeddedWallet.address)
            .replace(/\{\{ENV\.TARGET_CONTRACT\}\}/g, REAL_ESTATE_INVESTMENT_ADDRESS)
            .replace(/\{\{TRANSACTION_INTENT_ID\}\}/g, transactionIntent.id)
            .replace(/\{\{TRANSACTION_INTENT_NONCE\}\}/g, transactionIntent.nonce.toString())
            .replace(/\{\{TRANSACTION_INTENT_DEADLINE\}\}/g, transactionIntent.deadline.toString())
            .replace(/\{\{USER_SIGNATURE\}\}/g, signature);
        }
        if (Array.isArray(obj)) {
          return obj.map(replacePlaceholders);
        }
        if (obj !== null && typeof obj === 'object') {
          const result: any = {};
          for (const key in obj) {
            result[key] = replacePlaceholders(obj[key]);
          }
          return result;
        }
        return obj;
      };

      const processedWorkflow = replacePlaceholders(workflowData);

      // Add transaction intent to workflow
      processedWorkflow.transactionIntent = {
        destinations: transactionIntent.destinations,
        values: transactionIntent.values.map(v => v.toString()),
        nonce: transactionIntent.nonce.toString(),
        deadline: transactionIntent.deadline.toString(),
        id: transactionIntent.id,
        signature: signature
      };

      console.log('Processed Test Scenario with signature:', processedWorkflow);

      // Create KRNL JSON-RPC request
      const payload = {
        id: 1,
        jsonrpc: '2.0',
        method: 'krnl_executeWorkflow',
        params: [processedWorkflow]
      };

      // Send directly to KRNL node
      const response = await fetch('https://v0-1-0.node.lat/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.oci.image.manifest.v1+json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Workflow execution result:', data);
      onSuccess?.(data);

    } catch (error) {
      console.error('Error in test scenario:', error);
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleTestScenario}
      disabled={isLoading || !embeddedWallet?.address}
      className="bg-blue-600 hover:bg-blue-700"
    >
      {isLoading ? 'Generating...' : 'Test Scenario'}
    </Button>
  );
}

// Example usage in a parent component:
/*
function Dashboard() {
  const handleSuccess = (result) => {
    console.log('Scenario executed successfully:', result);
    // Show success notification or update UI
  };

  const handleError = (error) => {
    console.error('Scenario failed:', error);
    // Show error notification
  };

  return (
    <TestScenarioButton
      propertyAddress="1234-Maple-Street"
      propertyCityStateZip="Austin,TX"
      onSuccess={handleSuccess}
      onError={handleError}
    />
  );
}
*/