import { encodePacked, keccak256 } from 'viem';

export interface TransactionIntent {
  destinations: `0x${string}`[];
  values: bigint[];
  nonce: bigint;
  deadline: bigint;
  id: `0x${string}`;
}

/**
 * Generate a unique intent ID based on wallet address, nonce, and deadline
 */
export function generateIntentId(
  walletAddress: string,
  nonce: number,
  deadline: number
): `0x${string}` {
  const packed = encodePacked(
    ['address', 'uint256', 'uint256'],
    [walletAddress as `0x${string}`, BigInt(nonce), BigInt(deadline)]
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
  // Fixed deadline for consistency
  const deadline = BigInt(99999999999);

  const intentId = generateIntentId(walletAddress, nonce, Number(deadline));

  return {
    destinations: destinations as `0x${string}`[],
    values,
    nonce: BigInt(nonce),
    deadline,
    id: intentId
  };
}


