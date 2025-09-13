import { PrivyProvider as Provider } from '@privy-io/react-auth';
import { ReactNode } from 'react';

interface PrivyProviderProps {
  children: ReactNode;
}

const PrivyProvider = ({ children }: PrivyProviderProps) => {
  return (
    <Provider
      appId={import.meta.env.VITE_PRIVY_APP_ID || ''}
      config={{
        appearance: {
          theme: 'light',
          accentColor: '#676FFF',
          logo: 'https://your-logo-url.com/logo.png',
        },
        embeddedWallets: {
          createOnLogin: 'all-users',
          requireUserPasswordOnCreate: false,
        },
        defaultChain: {
          id: 11155111, // Ethereum Mainnet
          name: 'Ethereum',
          network: 'homestead',
          nativeCurrency: {
            decimals: 18,
            name: 'Ether',
            symbol: 'ETH',
          },
          rpcUrls: {
            default: {
              http: ['https://ethereum-sepolia-rpc.publicnode.com'],
            },
            public: {
              http: ['https://ethereum-sepolia-rpc.publicnode.com'],
            },
          },
          blockExplorers: {
            default: {
              name: 'Etherscan',
              url: 'https://sepolia.etherscan.io/',
            },
          },
        },
        walletConnectCloudProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
      }}
    >
      {children}
    </Provider>
  );
};

export default PrivyProvider;