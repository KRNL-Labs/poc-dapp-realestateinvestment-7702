# Real Estate Investment dApp

A proof-of-concept decentralized application for tokenized real estate investment using KRNL Protocol's EIP-7702 account abstraction and workflow execution.

## Architecture

### SDK Integration
- **@krnl-dev/sdk-react-7702**: EIP-7702 account abstraction with Privy wallet integration
- **Privy**: Embedded wallet provider with EIP-7702 support for delegated accounts
- **Smart Contract**: `RealEstateInvestment.sol` with signature-based authorization

### KRNL Node Interaction
1. **Dynamic Configuration**: Fetches node address via `getNodeConfig()` at runtime
2. **Workflow Execution**: Submits property analysis and token purchase workflows
3. **Transaction Intents**: Creates signed intents for delegated execution
4. **Progress Tracking**: Real-time workflow status monitoring

## Key Components

### Hooks
- `useTestScenario`: Orchestrates workflow execution with dynamic node config
- `useKrnlConfig`: Lazy-loads KRNL node configuration on demand
- `useSmartAccountAuth`: Handles EIP-7702 authorization and delegation

### Workflow Types
- **Scenario A**: Property analysis submission with oracle validation
- **Scenario B**: USDC token purchase with automatic approval handling

## Configuration

```typescript
// KRNL SDK Setup
const config = createConfig({
  chain: sepolia,
  delegatedContractAddress: process.env.VITE_DELEGATED_ACCOUNT_ADDRESS,
  privyAppId: process.env.VITE_PRIVY_APP_ID,
  krnlNodeUrl: 'https://node.krnl.xyz' // Auto-configured
});
```

## Development

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Type checking
npm run type-check
```

## Flow Overview

1. User authenticates via Privy embedded wallet
2. Authorize smart account using EIP-7702 delegation
3. Select investment scenario (analysis or purchase)
4. Fetch KRNL node configuration dynamically
5. Create transaction intent with signature
6. Submit workflow template to KRNL node
7. Monitor execution progress and on-chain settlement
