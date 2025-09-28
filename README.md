# Real Estate Investment dApp

A proof-of-concept decentralized application for tokenized real estate investment using KRNL Protocol's EIP-7702 account abstraction and workflow execution.

## Architecture

### SDK Integration
- **@krnl-dev/sdk-react-7702**: EIP-7702 account abstraction with Privy wallet integration
- **Privy** (required): Embedded wallet provider with EIP-7702 support for delegated accounts
- **Smart Contract**: `RealEstateInvestment.sol` with signature-based authorization

### KRNL Node Interaction
1. **Dynamic Configuration**: Fetches node address via `getNodeConfig()` at runtime
2. **Workflow Execution**: Submits property analysis and token purchase workflows
3. **Transaction Intents**: Creates signed intents for delegated execution
4. **Progress Tracking**: Real-time workflow status monitoring

## Key Components

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

## Setup Instructions

### 1. Clone Repository
```bash
git clone <repo-url>
cd poc-dapp-realestateinvestment
```

### 2. Deploy Real Estate Investment Contract (Optional)

You can use sample contracts in .env.example
```bash
git submodule update --init --recursive
cd contracts
cp .env.example .env
forge script script/Deploy.s.sol --rpc-url sepolia --broadcast
```

### 3. Environment Configuration
```bash
cd frontend
cp .env.example .env
```

### 4. Update Contract Addresses (Optional)

You can use sample contracts in .env.example
Edit `.env` file with your contract addresses:
```env
VITE_REAL_ESTATE_INVESTMENT_ADDRESS=
VITE_DELEGATED_ACCOUNT_ADDRESS=
VITE_TARGET_CONTRACT_OWNER=
VITE_ATTESTOR_IMAGE=image://ghcr.io/krnl-labs/attestor-poc-realestateinvestment-dapp:latest@sha256:...
```

### 5. Update Privy Environment Variables
Configure Privy authentication (get your credentials from https://dashboard.privy.io/):
```env
VITE_PRIVY_APP_ID=your_privy_app_id
VITE_PRIVY_APP_SECRET=your_privy_app_secret
```

### 6. Start Development Server
```bash
npm install
npm run dev
```

## Development Commands

```bash
# Type checking
npm run type-check

# Build for production
npm run build

# Linting
npm run lint
```

## Flow Overview

1. User authenticates via Privy embedded wallet
2. Authorize smart account using EIP-7702 delegation
3. Select investment scenario (analysis or purchase)
4. Fetch KRNL node configuration dynamically
5. Create transaction intent with signature
6. Submit workflow template to KRNL node
7. Monitor execution progress and on-chain settlement
