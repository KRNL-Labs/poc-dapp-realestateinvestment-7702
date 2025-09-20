import { useState } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { encodePacked, keccak256 } from 'viem';
import testScenarioData from '../test-scenario.json';
import testScenarioBData from '../test-scenario-b.json';
import DelegatedAccountABI from '../contracts/Delegated7702AccountV2.abi.json';
import RealEstateInvestmentABI from '../contracts/RealEstateInvestment.abi.json';
import ERC20ABI from '../contracts/ERC20.abi.json';
import { CONTRACT_ADDRESSES, RPC_URL, DELEGATE_OWNER } from '../const';

const REAL_ESTATE_INVESTMENT_ADDRESS = CONTRACT_ADDRESSES.REAL_ESTATE_INVESTMENT;
const MOCK_USDC_ADDRESS = CONTRACT_ADDRESSES.MOCK_USDC;

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
  const [isWaitingForTransaction, setIsWaitingForTransaction] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<WorkflowSubmissionResult | null>(null);
  const [executionResult, setExecutionResult] = useState<TransactionConfirmationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUSDCApproval = async (embeddedWallet: any) => {
    if (!MOCK_USDC_ADDRESS || !REAL_ESTATE_INVESTMENT_ADDRESS) {
      throw new Error('Missing contract addresses');
    }

    try {
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider(RPC_URL);

      // Check current allowance
      const usdcContract = new ethers.Contract(MOCK_USDC_ADDRESS, ERC20ABI, provider);
      const currentAllowance = await usdcContract.allowance(embeddedWallet.address, REAL_ESTATE_INVESTMENT_ADDRESS);

      if (currentAllowance === 0n) {
        const walletProvider = await embeddedWallet.getEthereumProvider();
        const signer = new ethers.BrowserProvider(walletProvider).getSigner();
        const usdcWithSigner = new ethers.Contract(MOCK_USDC_ADDRESS, ERC20ABI, await signer);
        const approveTx = await usdcWithSigner.approve(REAL_ESTATE_INVESTMENT_ADDRESS, ethers.MaxUint256);
        await approveTx.wait();
      }
    } catch (error) {
      throw new Error(`USDC approval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const executeWorkflow = async (scenarioType: 'A' | 'B' = 'A') => {
    setIsSubmitting(true);
    setError(null);
    setSubmissionResult(null);
    setExecutionResult(null);
    setIsWaitingForTransaction(false);

    try {
      const embeddedWallet = wallets.find(w => w.connectorType === 'embedded' && w.walletClientType === 'privy');
      if (!embeddedWallet?.address) throw new Error('No embedded wallet found');

      await embeddedWallet.switchChain(11155111);
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const nonce = await new ethers.Contract(REAL_ESTATE_INVESTMENT_ADDRESS, RealEstateInvestmentABI, provider).nonces(embeddedWallet.address);

      const nodeAddress = '0x0000000000000000000000000000000000000000';
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const intentId = keccak256(encodePacked(['address', 'uint256', 'uint256'], [embeddedWallet.address as `0x${string}`, BigInt(nonce), BigInt(deadline)])) as `0x${string}`;
      const transactionIntent = {
        target: REAL_ESTATE_INVESTMENT_ADDRESS as `0x${string}`,
        value: BigInt(0),
        id: intentId,
        nodeAddress: nodeAddress as `0x${string}`,
        delegate: DELEGATE_OWNER as `0x${string}`,
        nonce: BigInt(nonce),
        deadline: BigInt(deadline)
      };

      const intentHash = keccak256(encodePacked(['address', 'uint256', 'bytes32', 'address', 'address', 'uint256', 'uint256'], [transactionIntent.target, transactionIntent.value, transactionIntent.id, transactionIntent.nodeAddress, transactionIntent.delegate, transactionIntent.nonce, transactionIntent.deadline]));

      const walletProvider = await embeddedWallet.getEthereumProvider();
      const signature = await walletProvider.request({ method: 'personal_sign', params: [intentHash, embeddedWallet.address] }) as `0x${string}`;

      const iface = new ethers.Interface(DelegatedAccountABI);
      const intentStruct = {
        target: transactionIntent.target,
        value: transactionIntent.value.toString(),
        id: transactionIntent.id,
        nodeAddress: transactionIntent.nodeAddress,
        delegate: transactionIntent.delegate,
        nonce: transactionIntent.nonce.toString(),
        deadline: transactionIntent.deadline.toString()
      };
      const result = await provider.call({
        to: embeddedWallet.address,
        data: iface.encodeFunctionData('validateIntentSignature', [intentStruct, signature])
      });
      const [isValid] = iface.decodeFunctionResult('validateIntentSignature', result);
      if (!isValid) {
        setError('Signature validation failed');
        return;
      }
      
      if (scenarioType === 'B') await handleUSDCApproval(embeddedWallet);

      const selectedScenario = scenarioType === 'B' ? testScenarioBData : testScenarioData;
      const workflowData = JSON.parse(JSON.stringify(selectedScenario));
      const flattenObject = (obj: any, prefix = ''): Record<string, any> => {
        const result: Record<string, any> = {};
        for (const key in obj) {
          const newKey = prefix ? `${prefix}.${key}` : key;
          if (Array.isArray(obj[key])) {
            obj[key].forEach((item: any, i: number) =>
              Object.assign(result, typeof item === 'object' ? flattenObject(item, `${newKey}.${i}`) : { [`${newKey}.${i}`]: item })
            );
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            Object.assign(result, flattenObject(obj[key], newKey));
          } else {
            result[newKey] = obj[key];
          }
        }
        return result;
      };
      const flattenedWorkflowData = flattenObject(workflowData);

      if (scenarioType === 'A') flattenedWorkflowData['workflow.steps.5.inputs.value.authData.executions'] = [];
      if (scenarioType === 'B') flattenedWorkflowData['workflow.steps.1.inputs.value.authData.executions'] = [];
      
      const replacements: Record<string, string> = {
        '{{ENV.SENDER_ADDRESS}}': embeddedWallet.address,
        '{{ENV.TARGET_CONTRACT}}': REAL_ESTATE_INVESTMENT_ADDRESS,
        '{{ENV.NODE_ADDRESS}}': nodeAddress,
        '{{USER_SIGNATURE}}': signature,
        '{{TRANSACTION_INTENT_TARGET}}': transactionIntent.target,
        '{{TRANSACTION_INTENT_VALUE}}': transactionIntent.value.toString(),
        '{{TRANSACTION_INTENT_ID}}': transactionIntent.id,
        '{{TRANSACTION_INTENT_NODE_ADDRESS}}': transactionIntent.nodeAddress,
        '{{TRANSACTION_INTENT_DELEGATE}}': transactionIntent.delegate,
        '{{TRANSACTION_INTENT_NONCE}}': transactionIntent.nonce.toString(),
        '{{TRANSACTION_INTENT_DEADLINE}}': transactionIntent.deadline.toString()
      };
      for (const key in flattenedWorkflowData) {
        if (typeof flattenedWorkflowData[key] === 'string') {
          for (const [placeholder, value] of Object.entries(replacements)) {
            flattenedWorkflowData[key] = flattenedWorkflowData[key].replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
          }
        }
      }

      const unflattenObject = (flattened: Record<string, any>): any => {
        const result: any = {};
        for (const key in flattened) {
          const keys = key.split('.');
          let current = result;
          for (let i = 0; i < keys.length - 1; i++) {
            const part = keys[i];
            const nextPart = keys[i + 1];
            if (!current[part]) current[part] = /^\d+$/.test(nextPart) ? [] : {};
            current = current[part];
          }
          current[keys[keys.length - 1]] = flattened[key];
        }
        return result;
      };
      const processedWorkflow = unflattenObject(flattenedWorkflowData);

      const KRNL_RPC_URL = 'https://v0-1-0.node.lat/';

      const response = await fetch(KRNL_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/vnd.oci.image.manifest.v1+json' },
        body: JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'krnl_executeWorkflow', params: [processedWorkflow] })
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      if (data.result.admissionResult.accepted == false) throw new Error(data.result.admissionResult.reason);

      setSubmissionResult(data);

      setIsSubmitting(false);
      setIsWaitingForTransaction(true);

      const timeoutId = setTimeout(() => {
        clearInterval(pollInterval);
        setIsWaitingForTransaction(false);
        setError('Execution timeout');
      }, 60000);

      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(KRNL_RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'krnl_workflowStatus',
              params: [
                transactionIntent.id
              ],
              id: 1
            })
          });

          if (!statusResponse.ok) {
            console.error(`Status check failed: HTTP ${statusResponse.status}`);
            return;
          }

          const statusData = await statusResponse.json();
          const { code, result } = statusData.result || {};

          // Status codes
          const CODE_PENDING = 0;
          const CODE_PROCESSING = 1;
          const CODE_SUCCESS = 2;
          const CODE_FAILED = 3;
          const CODE_INTENT_NOT_FOUND = 4;
          const CODE_WORKFLOW_NOT_FOUND = 5;
          const CODE_INVALID = 6;

          switch (code) {
            case CODE_PENDING:
            case CODE_PROCESSING:
              // Continue polling
              return;

            case CODE_SUCCESS:
              clearInterval(pollInterval);
              clearTimeout(timeoutId);

              // Poll for transaction confirmation
              const txHash = result as string;
              if (!txHash) {
                setIsWaitingForTransaction(false);
                setError('Transaction hash not received');
                break;
              }

              console.log('Transaction hash received:', txHash);
              const { ethers } = await import('ethers');
              const provider = new ethers.JsonRpcProvider(RPC_URL);

              let confirmationInterval: NodeJS.Timeout;
              let confirmationTimeout: NodeJS.Timeout;

              const checkReceipt = async () => {
                try {
                  const tx = await provider.getTransaction(txHash);
                  if (tx) {
                    console.log('Transaction confirmed:', {
                      hash: txHash,
                      blockNumber: tx.blockNumber
                    });

                    clearInterval(confirmationInterval);
                    clearTimeout(confirmationTimeout);
                    setIsWaitingForTransaction(false);
                    setExecutionResult({
                      transactionHash: txHash,
                      blockNumber: tx.blockNumber || 0,
                      args: tx,
                    });
                  } else {
                    console.log('Transaction pending, continuing to poll...');
                  }
                } catch (error) {
                  console.error('Error checking transaction receipt:', error);
                }
              };

              // Start polling
              confirmationInterval = setInterval(checkReceipt, 2000);

              // Initial check
              await checkReceipt();

              // Set timeout for transaction confirmation (e.g., 2 minutes)
              confirmationTimeout = setTimeout(() => {
                clearInterval(confirmationInterval);
                setIsWaitingForTransaction(false);
                setError('Transaction confirmation timeout');
              }, 1200000);
              break;

            case CODE_FAILED:
              clearInterval(pollInterval);
              clearTimeout(timeoutId);
              setIsWaitingForTransaction(false);
              setError('Workflow execution failed');
              break;

            case CODE_INTENT_NOT_FOUND:
              clearInterval(pollInterval);
              clearTimeout(timeoutId);
              setIsWaitingForTransaction(false);
              setError('Intent not found');
              break;

            case CODE_WORKFLOW_NOT_FOUND:
              clearInterval(pollInterval);
              clearTimeout(timeoutId);
              setIsWaitingForTransaction(false);
              setError('Workflow not found');
              break;

            case CODE_INVALID:
              clearInterval(pollInterval);
              clearTimeout(timeoutId);
              setIsWaitingForTransaction(false);
              setError('Invalid workflow status');
              break;

            default:
              clearInterval(pollInterval);
              clearTimeout(timeoutId);
              setIsWaitingForTransaction(false);
              setError(`Unknown status code: ${code}`);
              break;
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 5000);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Workflow execution failed');
      setIsSubmitting(false);
      setIsWaitingForTransaction(false);
    }
  };

  return {
    executeWorkflow,
    isSubmitting,
    isWaitingForTransaction,
    submissionResult,
    executionResult,
    error,
  };
};