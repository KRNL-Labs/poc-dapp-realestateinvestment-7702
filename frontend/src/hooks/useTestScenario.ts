import { useState } from 'react';
import { useWallets } from '@privy-io/react-auth';
import {
  encodePacked,
  keccak256,
  createPublicClient,
  createWalletClient,
  http,
  custom,
  getContract,
  maxUint256
} from 'viem';
import { sepolia } from 'viem/chains';
import { useKRNL, type TransactionIntentParams, type WorkflowExecutionResult, type PrivyEmbeddedWallet } from '@krnl-dev/sdk-react';
import testScenarioData from '../test-scenario.json';
import testScenarioBData from '../test-scenario-b.json';
import RealEstateInvestmentABI from '../contracts/RealEstateInvestment.abi.json';
import ERC20ABI from '../contracts/ERC20.abi.json';
import { CONTRACT_ADDRESSES, RPC_URL, DELEGATE_OWNER } from '../const';

const REAL_ESTATE_INVESTMENT_ADDRESS = CONTRACT_ADDRESSES.REAL_ESTATE_INVESTMENT;
const MOCK_USDC_ADDRESS = CONTRACT_ADDRESSES.MOCK_USDC;


export const useTestScenario = () => {
  const { wallets } = useWallets();
  const {
    signTransactionIntent,
    executeWorkflow,
    submissionResult,
    executionResult,
    isWaitingForTransaction,
    isSubmitting: sdkIsSubmitting
  } = useKRNL();
  const [error, setError] = useState<string | null>(null);

  const handleUSDCApproval = async (embeddedWallet: PrivyEmbeddedWallet) => {
    if (!MOCK_USDC_ADDRESS || !REAL_ESTATE_INVESTMENT_ADDRESS) {
      throw new Error('Missing contract addresses');
    }

    try {
      // Check current allowance with public client
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(RPC_URL)
      });

      const usdcContract = getContract({
        address: MOCK_USDC_ADDRESS as `0x${string}`,
        abi: ERC20ABI,
        client: publicClient
      });

      const currentAllowance = await usdcContract.read.allowance([
        embeddedWallet.address as `0x${string}`,
        REAL_ESTATE_INVESTMENT_ADDRESS as `0x${string}`
      ]) as bigint;

      if (currentAllowance === 0n) {
        const provider = await embeddedWallet.getEthereumProvider();
        const walletClient = createWalletClient({
          account: embeddedWallet.address as `0x${string}`,
          chain: sepolia,
          transport: custom(provider)
        });

        const { request } = await publicClient.simulateContract({
          address: MOCK_USDC_ADDRESS as `0x${string}`,
          abi: ERC20ABI,
          functionName: 'approve',
          args: [REAL_ESTATE_INVESTMENT_ADDRESS as `0x${string}`, maxUint256],
          account: embeddedWallet.address as `0x${string}`
        });

        await walletClient.writeContract(request);
      }
    } catch (error) {
      throw new Error(`USDC approval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const executeTestWorkflow = async (scenarioType: 'A' | 'B' = 'A', propertyAddress?: string, cityStateZip?: string, usdcAmount?: string) => {
    setError(null);

    try {
      const embeddedWallet = wallets.find(w => w.connectorType === 'embedded' && w.walletClientType === 'privy');
      if (!embeddedWallet?.address) throw new Error('No embedded wallet found');

      await embeddedWallet.switchChain(11155111);

      // Get nonce using viem
      const client = createPublicClient({
        chain: sepolia,
        transport: http(RPC_URL)
      });

      const contract = getContract({
        address: REAL_ESTATE_INVESTMENT_ADDRESS as `0x${string}`,
        abi: RealEstateInvestmentABI,
        client
      });

      const nonce = await contract.read.nonces([embeddedWallet.address]) as bigint;

      const nodeAddress = '0x0000000000000000000000000000000000000000';
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // Get the target function selector from the RealEstateInvestment contract
      const targetFunctionName = scenarioType === 'B' ? 'purchaseTokens' : 'submitPropertyAnalysis';
      const targetFunctionSelector = RealEstateInvestmentABI.find(
        (item: any) => item.type === 'function' && item.name === targetFunctionName
      );
      if (!targetFunctionSelector) {
        throw new Error(`Function ${targetFunctionName} not found in ABI`);
      }

      // Create function signature and get selector (first 4 bytes of keccak256)
      // For tuple types, we need to build the nested structure properly
      const buildTypeString = (input: any): string => {
        if (input.type === 'tuple') {
          const components = input.components.map((comp: any) => buildTypeString(comp)).join(',');
          return `(${components})`;
        } else if (input.type === 'tuple[]') {
          const components = input.components.map((comp: any) => buildTypeString(comp)).join(',');
          return `(${components})[]`;
        } else {
          return input.type;
        }
      };

      const functionSig = `${targetFunctionName}(${targetFunctionSelector.inputs.map((input: any) => buildTypeString(input)).join(',')})`;
      const functionSelectorBytes = keccak256(encodePacked(['string'], [functionSig])).slice(0, 10);

      // Ensure it's exactly 4 bytes (8 hex chars + 0x)
      if (functionSelectorBytes.length !== 10) {
        throw new Error(`Invalid function selector length: ${functionSelectorBytes.length}`);
      }

      const intentId = keccak256(encodePacked(['address', 'uint256', 'uint256'], [embeddedWallet.address as `0x${string}`, nonce, BigInt(deadline)])) as `0x${string}`;

      const transactionIntent: TransactionIntentParams = {
        target: REAL_ESTATE_INVESTMENT_ADDRESS as `0x${string}`,
        value: BigInt(0),
        id: intentId,
        nodeAddress: nodeAddress as `0x${string}`,
        delegate: DELEGATE_OWNER as `0x${string}`,
        targetFunction: functionSelectorBytes as `0x${string}`,
        nonce,
        deadline: BigInt(deadline)
      };

      // Use SDK method to sign transaction intent
      const signature = await signTransactionIntent(transactionIntent);

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
        '{{TRANSACTION_INTENT_TARGET_FUNCTION}}': transactionIntent.targetFunction,
        '{{TRANSACTION_INTENT_NONCE}}': transactionIntent.nonce.toString(),
        '{{TRANSACTION_INTENT_DEADLINE}}': transactionIntent.deadline.toString(),
        '{{PROPERTY_ADDRESS}}': propertyAddress || '1234-Maple-Street',
        '{{CITY_STATE_ZIP}}': cityStateZip || 'Austin,TX',
        '{{USDC_AMOUNT}}': usdcAmount ? (parseFloat(usdcAmount) * 1000000).toString() : '100000000'
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

      // Use SDK method to execute workflow - SDK handles all polling
      const workflowResult: WorkflowExecutionResult = await executeWorkflow(processedWorkflow, transactionIntent);
      if (!workflowResult.success) {
        throw new Error(workflowResult.error || 'Failed to execute workflow');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Workflow execution failed');
    }
  };

  return {
    executeWorkflow: executeTestWorkflow,
    isSubmitting: sdkIsSubmitting,
    isWaitingForTransaction,
    submissionResult,
    executionResult,
    error,
  };
};