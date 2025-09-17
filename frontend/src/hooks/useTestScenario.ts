import { useState } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { encodePacked, keccak256 } from 'viem';
import testScenarioData from '../test-scenario.json';
import DelegatedAccountABI from '../contracts/Delegated7702AccountV2.abi.json';
import RealEstateInvestmentABI from '../contracts/RealEstateInvestment.abi.json';
import { logger } from '../utils';
import { CONTRACT_ADDRESSES, RPC_URL } from '../const';

const REAL_ESTATE_INVESTMENT_ADDRESS = CONTRACT_ADDRESSES.REAL_ESTATE_INVESTMENT;

interface WorkflowSubmissionResult {
  id: number;
  jsonrpc: string;
  result?: unknown;
  error?: unknown;
}

interface TransactionConfirmationResult {
  transactionHash: string;
  blockNumber: number;
  args: unknown;
}

export const useTestScenario = () => {
  const { wallets } = useWallets();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWaitingForExecution, setIsWaitingForExecution] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<WorkflowSubmissionResult | null>(null);
  const [executionResult, setExecutionResult] = useState<TransactionConfirmationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const executeWorkflow = async () => {
    setIsSubmitting(true);
    setError(null);
    setSubmissionResult(null);
    setExecutionResult(null);

    try {
      // Get embedded wallet address
      const embeddedWallet = wallets.find(wallet =>
        wallet.connectorType === 'embedded' &&
        wallet.walletClientType === 'privy'
      );

      if (!embeddedWallet?.address) {
        throw new Error('No embedded wallet found');
      }

      // Step 1: Get current nonce from target contract and create TransactionIntent
      const provider = await embeddedWallet.getEthereumProvider();

      // Ensure we're on the right network first
      await embeddedWallet.switchChain(11155111); // Sepolia

      // Get current nonce from the RealEstateInvestment contract
      const { ethers } = await import('ethers');
      const publicProvider = new ethers.JsonRpcProvider(RPC_URL);

      const targetContract = new ethers.Contract(REAL_ESTATE_INVESTMENT_ADDRESS, RealEstateInvestmentABI, publicProvider);
      const nonce = await targetContract.nonces(embeddedWallet.address);
      logger.debug('Current nonce from RealEstateInvestment contract:', nonce.toString());

      // Create TransactionIntent with new structure
      const nodeAddress = '0x0000000000000000000000000000000000000000'; // TODO: Get from environment
      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const intentId = keccak256(
        encodePacked(
          ['address', 'uint256', 'uint256'],
          [embeddedWallet.address as `0x${string}`, BigInt(nonce), BigInt(deadline)]
        )
      ) as `0x${string}`;

      const transactionIntent = {
        target: REAL_ESTATE_INVESTMENT_ADDRESS as `0x${string}`,
        value: BigInt(0), // No ETH value for this transaction
        id: intentId,
        nodeAddress: nodeAddress as `0x${string}`,
        nonce: BigInt(nonce),
        deadline: BigInt(deadline)
      };

      logger.debug('Created TransactionIntent:', transactionIntent);

      // Step 2: Create hash for signing (matching contract's hash order)
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
      } catch (signError) {
        const errorMessage = signError instanceof Error ? signError.message : String(signError);
        logger.error('Signature request failed:', errorMessage);
        throw new Error(`Failed to get signature: ${errorMessage}`);
      }

      // Step 4: Validate signature on contract before proceeding
      logger.log('Validating signature on contract...');

      try {
        // Validate the signature using ABI
        const { ethers: validationEthers } = await import('ethers');
        const validationProvider = new validationEthers.JsonRpcProvider(RPC_URL);
        const iface = new validationEthers.Interface(DelegatedAccountABI);

        // Prepare the intent struct with new structure
        const intentStruct = {
          target: transactionIntent.target,
          value: transactionIntent.value.toString(),
          id: transactionIntent.id,
          nodeAddress: transactionIntent.nodeAddress,
          nonce: transactionIntent.nonce.toString(),
          deadline: transactionIntent.deadline.toString()
        };

        // Encode the function call
        const calldata = iface.encodeFunctionData('validateIntentSignature', [
          intentStruct,
          signature
        ]);

        // Call the validation function
        const result = await validationProvider.call({
          to: embeddedWallet.address, // Call on user's delegated account
          data: calldata
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
      } catch (validationError) {
        const errorMessage = validationError instanceof Error ? validationError.message : String(validationError);
        logger.error('Error validating signature:', errorMessage);
        setError(`Signature validation error: ${errorMessage}`);
        return; // Exit early if validation fails
      }

      // Step 5: Prepare workflow with signature
      const workflowData = JSON.parse(JSON.stringify(testScenarioData));

      // Flatten the workflowData into a key-value map with dot notation
      const flattenObject = (obj: unknown, prefix = ''): Record<string, unknown> => {
        const flattened: Record<string, unknown> = {};

        const record = obj as Record<string, unknown>;
        for (const key in record) {
          if (Object.prototype.hasOwnProperty.call(record, key)) {
            const newKey = prefix ? `${prefix}.${key}` : key;

            if (record[key] === null || record[key] === undefined) {
              flattened[newKey] = record[key];
            } else if (Array.isArray(record[key])) {
              // Handle arrays with index notation
              (record[key] as unknown[]).forEach((item: unknown, index: number) => {
                if (typeof item === 'object' && item !== null) {
                  Object.assign(flattened, flattenObject(item, `${newKey}.${index}`));
                } else {
                  flattened[`${newKey}.${index}`] = item;
                }
              });
            } else if (typeof record[key] === 'object') {
              // Recursively flatten nested objects
              Object.assign(flattened, flattenObject(record[key], newKey));
            } else {
              // Primitive values
              flattened[newKey] = record[key];
            }
          }
        }

        return flattened;
      };

      const flattenedWorkflowData = flattenObject(workflowData);

      // Replace placeholders with actual values in the flattened data
      for (const key in flattenedWorkflowData) {
        if (Object.prototype.hasOwnProperty.call(flattenedWorkflowData, key)) {
          // temp fix
          flattenedWorkflowData['workflow.steps.5.inputs.value.authData.executions'] = [];

          if (typeof flattenedWorkflowData[key] === 'string') {
            const value = flattenedWorkflowData[key] as string;

            // Replace placeholders with actual values
            flattenedWorkflowData[key] = value
              .replace(/\{\{ENV\.SENDER_ADDRESS\}\}/g, embeddedWallet.address)
              .replace(/\{\{ENV\.TARGET_CONTRACT\}\}/g, REAL_ESTATE_INVESTMENT_ADDRESS)
              .replace(/\{\{ENV\.NODE_ADDRESS\}\}/g, nodeAddress)
              .replace(/\{\{USER_SIGNATURE\}\}/g, signature)
              .replace(/\{\{TRANSACTION_INTENT_TARGET\}\}/g, transactionIntent.target)
              .replace(/\{\{TRANSACTION_INTENT_VALUE\}\}/g, transactionIntent.value.toString())
              .replace(/\{\{TRANSACTION_INTENT_ID\}\}/g, transactionIntent.id)
              .replace(/\{\{TRANSACTION_INTENT_NODE_ADDRESS\}\}/g, transactionIntent.nodeAddress)
              .replace(/\{\{TRANSACTION_INTENT_NONCE\}\}/g, transactionIntent.nonce.toString())
              .replace(/\{\{TRANSACTION_INTENT_DEADLINE\}\}/g, transactionIntent.deadline.toString());
          }
        }
      }

      // Unflatten the flattenedWorkflowData back to nested object
      const unflattenObject = (flattened: Record<string, unknown>): unknown => {
        const result: Record<string, unknown> = {};

        for (const key in flattened) {
          if (Object.prototype.hasOwnProperty.call(flattened, key)) {
            const keys = key.split('.');
            let current: Record<string, unknown> = result;

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
                  current = current[part] as Record<string, unknown>;
                } else {
                  // Next part is an object key
                  if (!current[part]) {
                    current[part] = {};
                  }
                  current = current[part] as Record<string, unknown>;
                }
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
      logger.log('Workflow submission result:', data);
      setSubmissionResult(data);

      // Step 1 complete - workflow submitted to KRNL node
      setIsSubmitting(false);

      // Step 2 - Start waiting for execution (transaction confirmation)
      logger.log('Starting to wait for transaction execution with ID:', transactionIntent.id);
      setIsWaitingForExecution(true);

      const pollInterval = setInterval(async () => {
        try {
          const { ethers: pollEthers } = await import('ethers');
          const pollProvider = new pollEthers.JsonRpcProvider(RPC_URL);
          const contract = new pollEthers.Contract(embeddedWallet.address, DelegatedAccountABI, pollProvider);

          // Get events from the last 100 blocks to catch recent events
          const currentBlock = await pollProvider.getBlockNumber();
          const fromBlock = Math.max(0, currentBlock - 100);

          const filter = contract.filters.TransactionIntentExecuted();
          const events = await contract.queryFilter(filter, fromBlock, currentBlock);

          // Look for event with matching ID - use type guard to check for EventLog
          const matchingEvent = events.find(event => {
            if ('args' in event && event.args) {
              return event.args.intentId === transactionIntent.id;
            }
            return false;
          });

          if (matchingEvent && 'args' in matchingEvent) {
            clearInterval(pollInterval);
            setIsWaitingForExecution(false);
            logger.log('✅ Found matching TransactionIntentExecuted event:', matchingEvent);

            // Step 2 complete - transaction confirmed
            setExecutionResult({
              transactionHash: matchingEvent.transactionHash,
              blockNumber: matchingEvent.blockNumber,
              args: matchingEvent.args
            });
          }
        } catch (eventError) {
          logger.error('Error polling for events:', eventError);
        }
      }, 5000); // Poll every 5 seconds until found
    } catch (error) {
      logger.error('Error executing workflow:', error);
      setError(error instanceof Error ? error.message : 'Failed to execute workflow');
    } finally {
      setIsSubmitting(false);
      setIsWaitingForExecution(false);
    }
  };

  return {
    executeWorkflow,
    isSubmitting,
    isWaitingForExecution,
    submissionResult,
    executionResult,
    error,
  };
};