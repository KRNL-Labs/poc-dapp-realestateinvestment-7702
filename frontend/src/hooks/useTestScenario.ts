import { useState } from 'react';
import { useWallets } from '@privy-io/react-auth';
import testScenarioData from '../test-scenario.json';

const REAL_ESTATE_INVESTMENT_ADDRESS = import.meta.env.VITE_REAL_ESTATE_INVESTMENT_ADDRESS;

export const useTestScenario = () => {
  const { wallets } = useWallets();
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const executeWorkflow = async () => {
    setIsExecuting(true);
    setError(null);
    setResult(null);

    try {
      // Get embedded wallet address
      const embeddedWallet = wallets.find(wallet =>
        wallet.connectorType === 'embedded' &&
        wallet.walletClientType === 'privy'
      );

      if (!embeddedWallet?.address) {
        throw new Error('No embedded wallet found');
      }

      // Deep clone the test scenario data
      const workflowData = JSON.parse(JSON.stringify(testScenarioData));

      // Replace placeholders with actual values
      const replacePlaceholders = (obj: any): any => {
        if (typeof obj === 'string') {
          return obj
            .replace(/\{\{ENV\.SENDER_ADDRESS\}\}/g, embeddedWallet.address)
            .replace(/\{\{ENV\.TARGET_CONTRACT\}\}/g, REAL_ESTATE_INVESTMENT_ADDRESS);
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

      // const payload = {
      //   workflow: processedWorkflow
      // };

      // const response = await fetch('http://localhost:8080/api/execute-workflow', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify(payload)
      // });

      const payload = {
        id: 1,
        jsonrpc: '2.0',
        method: 'krnl_executeWorkflow',
        params: [processedWorkflow]
      };

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
      setResult(data);
      console.log('Workflow execution result:', data);
      
    } catch (error) {
      console.error('Error executing workflow:', error);
      setError(error instanceof Error ? error.message : 'Failed to execute workflow');
    } finally {
      setIsExecuting(false);
    }
  };

  return {
    executeWorkflow,
    isExecuting,
    result,
    error,
  };
};