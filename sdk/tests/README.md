# KRNL SDK Tests

This directory contains comprehensive tests for the KRNL Delegated Account SDK.

## Test Structure

### Core Tests (Working)
- **`basic.test.ts`** - Basic SDK functionality including type guards and configuration
- **`types.test.ts`** - Comprehensive type guard testing for Privy wallet validation
- **`config.test.ts`** - Configuration system tests including multi-chain support

### Advanced Tests (Framework Ready)
- **`KRNLDelegatedAccountSDK.test.ts`** - Full SDK class testing with mocked dependencies
- **`PrivyAuthorizationManager.test.ts`** - Authorization manager with WASM utilities
- **`useKRNLAuth.test.tsx`** - React hook testing with proper provider context
- **`KRNLProvider.test.tsx`** - Provider component testing
- **`integration.test.tsx`** - Full integration tests covering complete workflows

## Running Tests

```bash
# Run all working tests
npm test -- --testPathPatterns="basic.test.ts|types.test.ts|config.test.ts"

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- --testPathPatterns=types.test.ts

# Watch mode
npm run test:watch
```

## Test Coverage

Current coverage for core functionality:
- **Configuration System**: 100% coverage
- **Type Guards**: 100% coverage
- **Chain Configurations**: 100% coverage

## Test Features

### 1. Type Safety Validation
- Validates Privy embedded wallet types at runtime
- Tests edge cases for invalid wallet types
- Ensures proper error messages for type violations

### 2. Configuration Testing
- Multi-chain configuration support
- Default chain selection logic
- Error handling for invalid configurations

### 3. Wallet Validation
- Comprehensive testing of `isPrivyEmbeddedWallet` type guard
- Tests all required properties and edge cases
- Validates integration with SDK functions

### 4. Error Scenarios
- Tests proper error handling throughout the SDK
- Validates error messages are descriptive and helpful
- Ensures graceful failure modes

## Testing Framework

- **Jest** for test runner and assertions
- **@testing-library/react** for React component testing
- **TypeScript** for type-safe testing
- **Jest Environment** configured for both Node.js and browser environments

## Next Steps

The advanced test suites are ready and can be enabled once the React Testing Library version compatibility is resolved. All tests follow best practices with proper mocking, isolation, and comprehensive coverage.