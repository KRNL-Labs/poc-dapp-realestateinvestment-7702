/**
 * Logger utility for environment-aware logging
 * Only logs in development mode, silent in production
 */

const isDevelopment = import.meta.env.DEV;

export const logger = {
  /**
   * Log general information
   */
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Log error messages
   */
  error: (...args: any[]) => {
    if (isDevelopment) {
      console.error(...args);
    }
  },

  /**
   * Log warning messages
   */
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  /**
   * Log debug information
   */
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },

  /**
   * Log information in a table format
   */
  table: (data: any) => {
    if (isDevelopment) {
      console.table(data);
    }
  },

  /**
   * Log with a custom group
   */
  group: (label: string, fn: () => void) => {
    if (isDevelopment) {
      console.group(label);
      fn();
      console.groupEnd();
    }
  },

  /**
   * Log with timestamp
   */
  time: (label: string) => {
    if (isDevelopment) {
      console.time(label);
    }
  },

  timeEnd: (label: string) => {
    if (isDevelopment) {
      console.timeEnd(label);
    }
  },

  /**
   * Clear the console
   */
  clear: () => {
    if (isDevelopment) {
      console.clear();
    }
  },
};

/**
 * Development-only assertion
 */
export const devAssert = (condition: any, message?: string): asserts condition => {
  if (isDevelopment && !condition) {
    throw new Error(message || 'Assertion failed');
  }
};