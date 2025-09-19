# Deployment Guide

## Prerequisites

- Set environment variables in `.env`:
  ```bash
  PRIVATE_KEY=your_private_key
  ENTRY_POINT_ADDRESS=0x0000000071727De22E5E9d8BAf0edAc6f37da032  # Optional, defaults to v0.7 EntryPoint
  OWNER=your_owner_address  # Optional, defaults to deployer address
  ```

- Fee configuration is hardcoded in the deployment scripts:
  - Node Fee: 0.001 ETH
  - Protocol Fee: 0.001 ETH

## Deployment Process

**Step 1: Deploy Vault**
```bash
forge script script/DeployVault.s.sol:DeployVault --rpc-url $RPC_URL --broadcast
```

Note the deployed Vault address from the output.

**⚠️ IMPORTANT: Wait for the transaction to be confirmed before proceeding to Step 2**
- Check your transaction on the block explorer
- This prevents "gapped-nonce" errors with delegated accounts

**Step 2: Deploy Delegated7702AccountV2**
```bash
forge script script/DeployDelegatedAccountV2.s.sol:DeployDelegatedAccountV2Script --rpc-url $RPC_URL --broadcast
```

Note: The vault address is now hardcoded as a constant in the contract.

## Verification

After deployment, verify contracts on Etherscan:

```bash
# Verify Vault
forge verify-contract <VAULT_ADDRESS> src/Vault.sol:Vault \
  --constructor-args $(cast abi-encode "constructor(address,uint256,uint256)" $OWNER $NODE_FEE $PROTOCOL_FEE) \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --chain sepolia

# Verify Delegated7702AccountV2
forge verify-contract <ACCOUNT_ADDRESS> src/Delegated7702AccountV2.sol:Delegated7702AccountV2 \
  --constructor-args $(cast abi-encode "constructor(address)" $ENTRY_POINT_ADDRESS) \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --chain sepolia
```

## Deployed Contract Addresses

Record your deployed addresses here after deployment:

- **Vault**: `0x...`
- **Delegated7702AccountV2**: `0x...`
- **EntryPoint** (v0.7): `0x0000000071727De22E5E9d8BAf0edAc6f37da032`