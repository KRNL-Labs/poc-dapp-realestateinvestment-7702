// Jest setup file for SDK tests
import '@testing-library/jest-dom';

// Mock console methods to reduce noise in tests
Object.assign(console, {
  warn: jest.fn(),
  error: jest.fn(),
});

// Global test utilities and mocks can be added here