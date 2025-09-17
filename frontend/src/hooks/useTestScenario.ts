import { useState } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { encodePacked, keccak256 } from 'viem';
import testScenarioData from '../test-scenario.json';
import {
  createTransactionIntent
} from '../utils/transactionIntent';
import DelegatedAccountABI from '../contracts/Delegated7702Account.abi.json';
import { logger } from '../utils/logger';
import { CONTRACT_ADDRESSES } from '../utils/constants';

const REAL_ESTATE_INVESTMENT_ADDRESS = CONTRACT_ADDRESSES.REAL_ESTATE_INVESTMENT;

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

      // Step 1: Get current nonce from contract and create TransactionIntent
      const provider = await embeddedWallet.getEthereumProvider();

      // Ensure we're on the right network first
      await embeddedWallet.switchChain(11155111); // Sepolia

      // Get current nonce from the contract using ABI
      const { ethers } = await import('ethers');
      const contractInterface = new ethers.Interface(DelegatedAccountABI);
      const getNonceCalldata = contractInterface.encodeFunctionData('getCurrentNonce', []);

      const nonceResult = await provider.request({
        method: 'eth_call',
        params: [{
          to: embeddedWallet.address,
          data: getNonceCalldata
        }, 'latest']
      });

      const [currentNonce] = contractInterface.decodeFunctionResult('getCurrentNonce', nonceResult);
      logger.debug('Current nonce result:', currentNonce);
      const nonce = Number(currentNonce);
      logger.debug('Using current contract nonce:', nonce);

      const destinations = [REAL_ESTATE_INVESTMENT_ADDRESS];
      const values = [BigInt(0)]; // No ETH value for this transaction

      const transactionIntent = createTransactionIntent(
        destinations,
        values,
        embeddedWallet.address,
        nonce
      );

      logger.debug('Created TransactionIntent:', transactionIntent);

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

      logger.debug('Intent hash to sign:', intentHash);

      // Step 3: Request signature from user using Privy embedded wallet

      logger.log('Requesting signature from user for workflow execution...');

      let signature: `0x${string}`;
      try {
        // Use personal_sign for message signing - this should trigger Privy popup
        signature = await provider.request({
          method: 'personal_sign',
          params: [intentHash, embeddedWallet.address]
        }) as `0x${string}`;

        logger.log('User signature obtained:', signature);
      } catch (signError: any) {
        logger.error('Signature request failed:', signError);
        throw new Error(`Failed to get signature: ${signError.message || signError}`);
      }

      // Step 4: Validate signature on contract before proceeding
      logger.log('Validating signature on contract...');

      try {
        // Validate the signature using ABI
        const iface = contractInterface;

        // Prepare the intent struct
        const intentStruct = {
          destinations: transactionIntent.destinations,
          values: transactionIntent.values.map(v => v.toString()),
          nonce: transactionIntent.nonce.toString(),
          deadline: transactionIntent.deadline.toString(),
          id: transactionIntent.id
        };

        // Encode the function call
        const calldata = iface.encodeFunctionData('validateIntentSignature', [
          intentStruct,
          signature
        ]);

        // Call the validation function
        const result = await provider.request({
          method: 'eth_call',
          params: [{
            to: embeddedWallet.address, // Call on user's delegated account
            data: calldata
          }, 'latest']
        });

        // Decode the result
        const [isValid, signer] = iface.decodeFunctionResult('validateIntentSignature', result);

        logger.debug('Signature validation result:', {
          isValid,
          signer,
          expectedSigner: embeddedWallet.address
        });

        if (!isValid) {
          logger.error('Signature validation failed!');
          logger.error(`Recovered signer: ${signer}`);
          logger.error(`Expected signer: ${embeddedWallet.address}`);
          setError('Signature validation failed. The signature does not match the wallet address.');
          return; // Exit early if validation fails
        }

        logger.log('✅ Signature validation passed!');
      } catch (validationError: any) {
        logger.error('Error validating signature:', validationError);
        setError(`Signature validation error: ${validationError.message || validationError}`);
        return; // Exit early if validation fails
      }

      // Step 5: Prepare workflow with signature
      const workflowData = JSON.parse(JSON.stringify(testScenarioData));

      // Flatten the workflowData into a key-value map with dot notation
      const flattenObject = (obj: any, prefix = ''): Record<string, any> => {
        const flattened: Record<string, any> = {};

        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            const newKey = prefix ? `${prefix}.${key}` : key;

            if (obj[key] === null || obj[key] === undefined) {
              flattened[newKey] = obj[key];
            } else if (Array.isArray(obj[key])) {
              // Handle arrays with index notation
              obj[key].forEach((item: any, index: number) => {
                if (typeof item === 'object' && item !== null) {
                  Object.assign(flattened, flattenObject(item, `${newKey}.${index}`));
                } else {
                  flattened[`${newKey}.${index}`] = item;
                }
              });
            } else if (typeof obj[key] === 'object') {
              // Recursively flatten nested objects
              Object.assign(flattened, flattenObject(obj[key], newKey));
            } else {
              // Primitive values
              flattened[newKey] = obj[key];
            }
          }
        }

        return flattened;
      };

      const flattenedWorkflowData = flattenObject(workflowData);

      // Replace placeholders with actual values in the flattened data
      for (const key in flattenedWorkflowData) {
        // temp fix
        flattenedWorkflowData['workflow.steps.5.inputs.value.authData.executions'] = [];

        if (typeof flattenedWorkflowData[key] === 'string') {
          const value = flattenedWorkflowData[key];

          // Check for specific array placeholders and replace with actual arrays
          if (value === '{{TRANSACTION_INTENT_DESTINATIONS}}') {
            flattenedWorkflowData[key] = transactionIntent.destinations;
          } else if (value === '{{TRANSACTION_INTENT_VALUES}}') {
            flattenedWorkflowData[key] = transactionIntent.values.map(v => v.toString());
          } else {
            // For other placeholders, do string replacement
            flattenedWorkflowData[key] = value
              .replace(/\{\{ENV\.SENDER_ADDRESS\}\}/g, embeddedWallet.address)
              .replace(/\{\{ENV\.TARGET_CONTRACT\}\}/g, REAL_ESTATE_INVESTMENT_ADDRESS)
              .replace(/\{\{TRANSACTION_INTENT_ID\}\}/g, transactionIntent.id)
              .replace(/\{\{TRANSACTION_INTENT_NONCE\}\}/g, transactionIntent.nonce.toString())
              .replace(/\{\{TRANSACTION_INTENT_DEADLINE\}\}/g, transactionIntent.deadline.toString())
              .replace(/\{\{USER_SIGNATURE\}\}/g, signature);
          }
        }
      }

      // Unflatten the flattenedWorkflowData back to nested object
      const unflattenObject = (flattened: Record<string, any>): any => {
        const result: any = {};

        for (const key in flattened) {
          const keys = key.split('.');
          let current = result;

          for (let i = 0; i < keys.length; i++) {
            const part = keys[i];
            const isLastKey = i === keys.length - 1;

            if (isLastKey) {
              current[part] = flattened[key];
            } else {
              const nextPart = keys[i + 1];
              const isNextPartNumeric = /^\d+$/.test(nextPart);

              if (isNextPartNumeric) {
                // Next part is an array index
                if (!current[part]) {
                  current[part] = [];
                }
                current = current[part];
              } else {
                // Next part is an object key
                if (!current[part]) {
                  current[part] = {};
                }
                current = current[part];
              }
            }
          }
        }

        return result;
      };

      const processedWorkflow = unflattenObject(flattenedWorkflowData);

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

      logger.debug('Processed workflow with signature:', JSON.stringify(processedWorkflow));

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
      logger.log('Workflow execution result:', data);
      
    } catch (error) {
      logger.error('Error executing workflow:', error);
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