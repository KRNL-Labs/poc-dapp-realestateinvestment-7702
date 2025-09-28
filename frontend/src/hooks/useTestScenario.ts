import { useState } from 'react';
import { useWallets } from '@privy-io/react-auth';
import toast from 'react-hot-toast';
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
import { useKRNL, useNodeConfig, type TransactionIntentParams, type PrivyEmbeddedWallet, type WorkflowObject } from '@krnl-dev/sdk-react-7702';
import testScenarioData from '../test-scenario.json';
import testScenarioBData from '../test-scenario-b.json';
import RealEstateInvestmentABI from '../contracts/RealEstateInvestment.abi.json';
import ERC20ABI from '../contracts/ERC20.abi.json';
import { RPC_URL, TARGET_CONTRACT_OWNER, REAL_ESTATE_INVESTMENT_ADDRESS, MOCK_USDC_ADDRESS, ATTESTOR_IMAGE, DEFAULT_CHAIN_ID } from '../const';
import type { ABIInput, ABIFunction } from '../types';


export const useTestScenario = () => {
  const { wallets } = useWallets();
  const {
    signTransactionIntent,
    executeWorkflowFromTemplate,
    resetSteps,
    error: sdkError,
    statusCode,
    steps,
    currentStep
  } = useKRNL();
  const { getConfig } = useNodeConfig();
  const [error, setError] = useState<string | null>(null);


  const getEmbeddedWallet = (): PrivyEmbeddedWallet => {
    const embeddedWallet = wallets.find(w => w.connectorType === 'embedded' && w.walletClientType === 'privy');
    if (!embeddedWallet?.address) throw new Error('No embedded wallet found');
    return embeddedWallet;
  };

  const handleUSDCApproval = async (embeddedWallet: PrivyEmbeddedWallet) => {
    if (!MOCK_USDC_ADDRESS || !REAL_ESTATE_INVESTMENT_ADDRESS) {
      throw new Error('Missing contract addresses');
    }

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
  };

  const getContractNonce = async (embeddedWallet: PrivyEmbeddedWallet): Promise<bigint> => {
    const client = createPublicClient({
      chain: sepolia,
      transport: http(RPC_URL)
    });

    const contract = getContract({
      address: REAL_ESTATE_INVESTMENT_ADDRESS as `0x${string}`,
      abi: RealEstateInvestmentABI,
      client
    });

    return await contract.read.nonces([embeddedWallet.address]) as bigint;
  };

  const buildTypeString = (input: ABIInput): string => {
    if (input.type === 'tuple') {
      const components = input.components?.map((comp) => buildTypeString(comp)).join(',') || '';
      return `(${components})`;
    } else if (input.type === 'tuple[]') {
      const components = input.components?.map((comp) => buildTypeString(comp)).join(',') || '';
      return `(${components})[]`;
    } else {
      return input.type;
    }
  };

  const getFunctionSelector = (scenarioType: 'A' | 'B'): string => {
    const targetFunctionName = scenarioType === 'B' ? 'purchaseTokens' : 'submitPropertyAnalysis';

    const targetFunctionSelector = (RealEstateInvestmentABI as ABIFunction[]).find(
      (item) => item.type === 'function' && item.name === targetFunctionName
    );
    if (!targetFunctionSelector) {
      throw new Error(`Function ${targetFunctionName} not found in ABI`);
    }

    const functionSig = `${targetFunctionName}(${targetFunctionSelector.inputs.map((input) => buildTypeString(input)).join(',')})`;
    const functionSelectorBytes = keccak256(encodePacked(['string'], [functionSig])).slice(0, 10);

    if (functionSelectorBytes.length !== 10) {
      throw new Error(`Invalid function selector length: ${functionSelectorBytes.length}`);
    }

    return functionSelectorBytes;
  };

  const createTransactionIntent = (embeddedWallet: PrivyEmbeddedWallet, scenarioType: 'A' | 'B', nonce: bigint, nodeAddress: string): TransactionIntentParams => {
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const functionSelector = getFunctionSelector(scenarioType);

    const intentId = keccak256(encodePacked(
      ['address', 'uint256', 'uint256'],
      [embeddedWallet.address as `0x${string}`, nonce, BigInt(deadline)]
    )) as `0x${string}`;

    return {
      target: REAL_ESTATE_INVESTMENT_ADDRESS as `0x${string}`,
      value: BigInt(0),
      id: intentId,
      nodeAddress: nodeAddress as `0x${string}`,
      delegate: TARGET_CONTRACT_OWNER as `0x${string}`,
      targetFunction: functionSelector as `0x${string}`,
      nonce,
      deadline: BigInt(deadline)
    };
  };

  const createTemplateReplacements = (
    embeddedWallet: PrivyEmbeddedWallet,
    transactionIntent: TransactionIntentParams,
    signature: string,
    propertyAddress?: string,
    cityStateZip?: string,
    usdcAmount?: string
  ): Record<string, string> => {
    return {
      '{{ENV.SENDER_ADDRESS}}': embeddedWallet.address,
      '{{ENV.TARGET_CONTRACT}}': REAL_ESTATE_INVESTMENT_ADDRESS,
      '{{ENV.ATTESTOR_IMAGE}}': ATTESTOR_IMAGE || '',
      '{{USER_SIGNATURE}}': signature,
      '{{TRANSACTION_INTENT_VALUE}}': transactionIntent.value.toString(),
      '{{TRANSACTION_INTENT_ID}}': transactionIntent.id,
      '{{TRANSACTION_INTENT_DELEGATE}}': transactionIntent.delegate,
      '{{TRANSACTION_INTENT_DEADLINE}}': transactionIntent.deadline.toString(),
      '{{PROPERTY_ADDRESS}}': propertyAddress || '1234-Maple-Street',
      '{{CITY_STATE_ZIP}}': cityStateZip || 'Austin,TX',
      '{{USDC_AMOUNT}}': usdcAmount ? (parseFloat(usdcAmount) * 1000000).toString() : '100000000'
    };
  };

  const selectScenarioTemplate = (scenarioType: 'A' | 'B') => {
    return scenarioType === 'B' ? testScenarioBData : testScenarioData;
  };


  const executeTestWorkflow = async (
    scenarioType: 'A' | 'B' = 'A',
    propertyAddress?: string,
    cityStateZip?: string,
    usdcAmount?: string
  ) => {
    setError(null);
    resetSteps();

    try {
      const embeddedWallet = getEmbeddedWallet();
      await embeddedWallet.switchChain?.(11155111);

      if (scenarioType === 'B') {
        await handleUSDCApproval(embeddedWallet);
      }

      const nodeConfig = await getConfig();
      if (!nodeConfig.workflow.node_address) {
        throw new Error('Node address not available from KRNL node configuration.');
      }

      const nonce = await getContractNonce(embeddedWallet);
      const transactionIntent = createTransactionIntent(embeddedWallet, scenarioType, nonce, nodeConfig.workflow.node_address);
      const signature = await signTransactionIntent(transactionIntent);

      const selectedScenario = selectScenarioTemplate(scenarioType);
      const replacements = createTemplateReplacements(
        embeddedWallet,
        transactionIntent,
        signature,
        propertyAddress,
        cityStateZip,
        usdcAmount
      );

      await executeWorkflowFromTemplate(selectedScenario as WorkflowObject, replacements);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Workflow execution failed';
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  return {
    executeWorkflow: executeTestWorkflow,
    resetSteps,
    error: error || sdkError,
    statusCode,
    steps,
    currentStep
  };
};