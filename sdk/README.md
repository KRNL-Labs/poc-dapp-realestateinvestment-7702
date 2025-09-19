# KRNL Delegated Account SDK with Privy Integration

A TypeScript SDK for managing delegated accounts on the KRNL platform using Privy wallets for authentication and EIP-7702 account abstraction.

## Features

- **Privy Wallet Integration**: Seamless integration with Privy embedded wallets
- **EIP-7702 Authorization**: Enable smart account functionality for Privy wallets
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Authorization Management**: Check and enable smart account authorization status
- **Transaction Handling**: Built-in transaction signing and confirmation

## Installation

```bash
npm install @krnl/delegated-account
```

## Quick Start

```typescript
import { KRNLDelegatedAccountSDK } from '@krnl/delegated-account';
import { useSign7702Authorization } from '@privy-io/react-auth';

// Initialize the SDK
const sdk = new KRNLDelegatedAccountSDK(
  {
    contractAddress: '0x...',  // Your delegated account contract
    chainId: 11155111,         // Sepolia testnet
  },
  window.wasmUtilities,        // WASM utilities for transaction building
  signAuthorization           // Privy's sign authorization function
);

// Check if Privy wallet is authorized
const privyWallet = wallets.find(w =>
  w.connectorType === 'embedded' &&
  w.walletClientType === 'privy'
);

if (KRNLDelegatedAccountSDK.validatePrivyWallet(privyWallet)) {
  const status = await sdk.checkPrivyWalletAuthorization(privyWallet);

  if (!status.isAuthorized) {
    // Enable smart account functionality
    const result = await sdk.enablePrivySmartAccount(privyWallet);

    if (result.success) {
      console.log(`Authorization successful! TX: ${result.transactionHash}`);
    }
  }
}
```

## API Reference

### KRNLDelegatedAccountSDK

The main SDK class for interacting with KRNL platform using Privy wallets.

#### Constructor

```typescript
new KRNLDelegatedAccountSDK(
  authConfig: AuthorizationConfig,
  wasmUtils: WasmUtilities,
  signAuthorization: PrivySignAuthorizationFunction,
  config?: SDKConfig
)
```

#### Methods

##### `checkPrivyWalletAuthorization(privyWallet)`

Check if a Privy wallet is authorized for smart account functionality.

```typescript
const status = await sdk.checkPrivyWalletAuthorization(privyWallet);
// Returns: PrivyAuthorizationStatus
```

##### `enablePrivySmartAccount(privyWallet)`

Enable smart account functionality for a Privy wallet using EIP-7702.

```typescript
const result = await sdk.enablePrivySmartAccount(privyWallet);
// Returns: PrivyAuthorizationResult
```

##### `validatePrivyWallet(wallet)` (static)

Validate that a wallet object is a valid Privy embedded wallet.

```typescript
if (KRNLDelegatedAccountSDK.validatePrivyWallet(wallet)) {
  // wallet is a valid PrivyEmbeddedWallet
}
```

## Types

### PrivyEmbeddedWallet

```typescript
interface PrivyEmbeddedWallet {
  address: string;
  connectorType: 'embedded';
  walletClientType: 'privy';
  getEthereumProvider: () => Promise<PrivyWalletProvider>;
  switchChain: (chainId: number) => Promise<void>;
}
```

### PrivyAuthorizationStatus

```typescript
interface PrivyAuthorizationStatus {
  isAuthorized: boolean;
  smartAccountEnabled: boolean;
  contractAddress?: string;
}
```

### PrivyAuthorizationResult

```typescript
interface PrivyAuthorizationResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}
```

## Requirements

- **Privy**: This SDK requires `@privy-io/react-auth` for wallet management
- **WASM Utilities**: Transaction building utilities must be available
- **EIP-7702 Support**: Network must support EIP-7702 (currently Sepolia testnet)

## License

MIT