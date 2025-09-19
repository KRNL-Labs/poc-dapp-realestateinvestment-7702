import React, { createContext, useContext, ReactNode } from 'react';
import type { ConfiguredKRNLConfig } from '../config';

interface KRNLContextValue {
  /** Configuration */
  config: ConfiguredKRNLConfig;
}

const KRNLContext = createContext<KRNLContextValue | null>(null);

interface KRNLProviderProps {
  config: ConfiguredKRNLConfig;
  children: ReactNode;
}

export const KRNLProvider: React.FC<KRNLProviderProps> = ({ config, children }) => {
  const contextValue: KRNLContextValue = {
    config
  };

  return (
    <KRNLContext.Provider value={contextValue}>
      {children}
    </KRNLContext.Provider>
  );
};

/**
 * Hook to access KRNL context
 * Throws an error if used outside of KRNLProvider
 */
export const useKRNL = (): KRNLContextValue => {
  const context = useContext(KRNLContext);
  if (!context) {
    throw new Error('useKRNL must be used within a KRNLProvider');
  }
  return context;
};