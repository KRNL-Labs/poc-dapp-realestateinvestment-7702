/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVY_APP_ID: string;
  readonly VITE_CHAIN_ID: string;
  readonly VITE_DELEGATED_ACCOUNT_ADDRESS: string;
  readonly VITE_PRIVY_APP_SECRET?: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    Go: new () => Go;
    makeUnsignTx: (params: string) => WasmResult;
    makeSignHash: (params: string) => { signHash: string };
    compileUnsignTxWithSignature: (params: string) => CompileResult;
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: any[] }) => Promise<any>;
    };
  }
}

interface Go {
  importObject: WebAssembly.Imports;
  run: (instance: WebAssembly.Instance) => void;
}

interface WasmResult {
  error?: string;
  unsignedTx: string;
  signHash: string;
}

interface CompileResult {
  error?: string;
  signedTx: string;
  txHash: string;
}