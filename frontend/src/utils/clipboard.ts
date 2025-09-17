import { logger } from './logger';
import React from 'react';

export interface CopyToClipboardResult {
  success: boolean;
  error?: Error;
}

/**
 * Copies text to clipboard with fallback for older browsers
 * @param text - Text to copy to clipboard
 * @returns Promise with success status and optional error
 */
export const copyToClipboard = async (text: string): Promise<CopyToClipboardResult> => {
  try {
    // Modern way using Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      logger.debug('Text copied to clipboard using Clipboard API');
      return { success: true };
    }

    // Fallback for older browsers or non-secure contexts
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);

    if (successful) {
      logger.debug('Text copied to clipboard using fallback method');
      return { success: true };
    } else {
      throw new Error('Failed to copy text to clipboard');
    }
  } catch (error) {
    logger.error('Failed to copy to clipboard:', error);
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
};

/**
 * Hook-friendly clipboard copy with state management
 * Returns a function that copies text and manages copied state
 */
export const useCopyToClipboard = () => {
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const timeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined);

  const copy = React.useCallback(async (text: string, duration = 2000) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const result = await copyToClipboard(text);

    if (result.success) {
      setCopied(true);
      setError(null);

      // Reset copied state after duration
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, duration);
    } else {
      setCopied(false);
      setError(result.error || null);
    }

    return result;
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { copy, copied, error };
};