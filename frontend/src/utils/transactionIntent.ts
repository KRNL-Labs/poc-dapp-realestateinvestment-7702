import { encodePacked, keccak256, toHex } from 'viem';
import type { WalletClient } from 'viem';

export interface TransactionIntent {
  destinations: `0x${string}`[];
  values: bigint[];
  nonce: bigint;
  deadline: bigint;
  id: `0x${string}`;
}

/**
 * Generate a unique intent ID based on wallet address, nonce, and timestamp
 */
export function generateIntentId(
  walletAddress: string,
  nonce: number,
  timestamp: number
): `0x${string}` {
  const packed = encodePacked(
    ['address', 'uint256', 'uint256'],
    [walletAddress as `0x${string}`, BigInt(nonce), BigInt(timestamp)]
  );
  return keccak256(packed);
}

/**
 * Create a TransactionIntent for signing
 */
export function createTransactionIntent(
  destinations: string[],
  values: bigint[],
  walletAddress: string,
  nonce: number
): TransactionIntent {
  const timestamp = Math.floor(Date.now() / 1000);
  const deadline = BigInt(timestamp + 3600); // 1 hour from now

  const intentId = generateIntentId(walletAddress, nonce, timestamp);

  return {
    destinations: destinations as `0x${string}`[],
    values,
    nonce: BigInt(nonce),
    deadline,
    id: intentId
  };
}

/**
 * Create the hash of the transaction intent for signing
 */
export function hashTransactionIntent(intent: TransactionIntent): `0x${string}` {
  // This should match the Solidity keccak256(abi.encode(...))
  const encoded = encodePacked(
    ['address[]', 'uint256[]', 'uint256', 'uint256', 'bytes32'],
    [
      intent.destinations,
      intent.values,
      intent.nonce,
      intent.deadline,
      intent.id
    ]
  );
  return keccak256(encoded);
}

/**
 * Request signature for a transaction intent
 */
export async function signTransactionIntent(
  intent: TransactionIntent,
  walletClient: WalletClient,
  account: `0x${string}`
): Promise<`0x${string}`> {
  const intentHash = hashTransactionIntent(intent);

  // Sign the message hash
  const signature = await walletClient.signMessage({
    account,
    message: { raw: intentHash }
  });

  return signature;
}

/**
 * Get the current nonce from the delegated account contract
 * @param userAddress The user's delegated account address
 * @param provider Ethereum provider to query the contract
 */
export async function getCurrentNonce(userAddress: string, provider: any): Promise<number> {
  try {
    // ABI for getCurrentNonce function
    const getCurrentNonceABI = [
      {
        name: 'getCurrentNonce',
        type: 'function',
        inputs: [],
        outputs: [{ name: 'nonce', type: 'uint256' }],
        stateMutability: 'view'
      }
    ];

    // Import ethers dynamically
    const { ethers } = await import('ethers');
    const iface = new ethers.Interface(getCurrentNonceABI);
    const calldata = iface.encodeFunctionData('getCurrentNonce', []);

    // Call the contract to get current nonce
    const result = await provider.request({
      method: 'eth_call',
      params: [{
        to: userAddress, // Call on the user's delegated account
        data: calldata
      }, 'latest']
    });

    // Decode the result
    const decoded = iface.decodeFunctionResult('getCurrentNonce', result);
    const currentNonce = Number(decoded[0]);

    console.log(`Current nonce from contract: ${currentNonce}`);
    return currentNonce;
  } catch (error) {
    console.error('Error getting current nonce from contract:', error);
    // Fallback to timestamp-based nonce if contract call fails
    return Date.now() % 1000000;
  }
}

