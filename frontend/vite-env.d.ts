/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVY_APP_ID: string
  readonly VITE_PRIVY_APP_SECRET: string
  readonly VITE_CHAIN_ID: string
  readonly VITE_DELEGATED_ACCOUNT_ADDRESS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    makeUnsignTx: (params: string) => { error?: string; unsignedTx: string; signHash: string };
    compileUnsignTxWithSignature: (params: string) => { err?: string; signedTx: string; txHash: string };
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
    };
  }
}