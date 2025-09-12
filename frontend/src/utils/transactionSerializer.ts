import { ethers } from 'ethers';

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

interface Go {
  importObject: WebAssembly.Imports;
  run: (instance: WebAssembly.Instance) => void;
}

interface PrivyAuthorization {
  chainId?: number | string;
  contractAddress?: string;
  address?: string;
  nonce?: number | string;
  r: string;
  s: string;
  v: number;
}

interface TransactionParams {
  chainId: number | string;
  nonce: number | string;
  to: string;
  value?: string;
  gasLimit?: number | string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  authorizationList?: PrivyAuthorization[];
}

interface TxInput {
  chainId: number;
  nonce: number;
  to: string;
  value: string;
  gas?: number;
  gasPrice?: string;
  gasFeeCap: string;
  gasTipCap: string;
  authList: {
    chainId: number;
    address: string;
    nonce: number;
    r: string;
    s: string;
    v: number;
  }[];
}

interface CompileInput {
  chainId: number;
  unsignedTx: string;
  signature: string;
}

interface SignatureComponents {
  r: string;
  s: string;
  v?: number;
  yParity?: number;
}

interface EmbeddedWallet {
  address: string;
  getEthereumProvider: () => Promise<any>;
}

declare global {
  interface Window {
    Go: new () => Go;
    makeUnsignTx: (params: string) => WasmResult;
    makeSignHash: (params: string) => { signHash: string };
    compileUnsignTxWithSignature: (params: string) => CompileResult;
  }
}

let wasmInstance: WebAssembly.Instance | null = null;
let wasmReady = false;

/**
 * Initialize WASM module for EIP-7702 transaction serialization
 * Loads wasm_exec.js and eip7702.wasm
 */
export const initializeWasm = async (): Promise<void> => {
  if (wasmReady) return;
  
  try {
    // Load wasm_exec.js script dynamically
    if (typeof window.Go === 'undefined') {
      const script = document.createElement('script');
      script.src = '/wasm_exec.js';
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    
    if (typeof window.Go === 'undefined') {
      throw new Error('Go WASM runtime not loaded');
    }
    
    const go = new window.Go();
    
    // Load WASM module
    const wasmModule = await WebAssembly.instantiateStreaming(
      fetch('/eip7702.wasm'),
      go.importObject
    );
    
    go.run(wasmModule.instance);
    wasmInstance = wasmModule.instance;
    wasmReady = true;
    
    console.log('✅ EIP-7702 WASM module initialized');
    console.log('Available functions:', {
      makeUnsignTx: typeof window.makeUnsignTx,
      makeSignHash: typeof window.makeSignHash,
      compileUnsignTxWithSignature: typeof window.compileUnsignTxWithSignature
    });
    
  } catch (error) {
    console.warn('WASM initialization failed:', (error as Error).message);
    wasmReady = false;
  }
};

/**
 * Convert BigInt values to strings/numbers recursively
 * @param {*} obj - Object that may contain BigInt values
 * @returns {*} Object with BigInt values converted
 */
const convertBigInts = (obj: any): any => {
  if (typeof obj === 'bigint') {
    return Number(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(convertBigInts);
  }
  if (typeof obj === 'object' && obj !== null) {
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertBigInts(value);
    }
    return converted;
  }
  return obj;
};

/**
 * Convert Privy authorization to txwasm format
 * @param {Object} authorization - Privy authorization object
 * @returns {Object} Authorization in txwasm format
 */
const convertPrivyAuthToTxWasm = (authorization: PrivyAuthorization) => {
  // First convert any BigInt values
  const cleanAuth = convertBigInts(authorization);
  
  console.log('aaa', cleanAuth)
  return {
    chainId: typeof cleanAuth.chainId === 'string' ? 
      parseInt(cleanAuth.chainId, 16) : 
      cleanAuth.chainId,
    address: cleanAuth.contractAddress || cleanAuth.address,
    nonce: typeof cleanAuth.nonce === 'string' ? 
      parseInt(cleanAuth.nonce, 16) : 
      cleanAuth.nonce,
    r: cleanAuth.r,
    s: cleanAuth.s,
    v: cleanAuth.v
  };
};

/**
 * Create unsigned EIP-7702 transaction using WASM
 * @param {Object} params - Transaction parameters
 * @returns {Object} { unsignedTx, signHash }
 */
export const makeUnsignedTransaction = async (params: TransactionParams): Promise<{ unsignedTx: string; signHash: string }> => {
  if (!wasmReady) {
    await initializeWasm();
    if (!wasmReady) {
      throw new Error('WASM module not available');
    }
  }
  
  if (typeof window.makeUnsignTx !== 'function') {
    throw new Error('makeUnsignTx function not available in WASM');
  }
  
  // First convert any BigInt values in the entire params object
  const cleanParams = convertBigInts(params);
  
  // Convert parameters to txwasm format
  const txInput = {
    chainId: typeof cleanParams.chainId === 'string' ? parseInt(cleanParams.chainId, 16) : cleanParams.chainId,
    nonce: typeof cleanParams.nonce === 'string' ? parseInt(cleanParams.nonce, 16) : cleanParams.nonce,
    to: cleanParams.to,
    value: cleanParams.value || "0", // Add value field (defaults to 0)
    gas: typeof cleanParams.gasLimit === 'string' ? parseInt(cleanParams.gasLimit, 16) : cleanParams.gasLimit,
    gasPrice: cleanParams.gasPrice ? (typeof cleanParams.gasPrice === 'string' ? 
      parseInt(cleanParams.gasPrice, 16).toString() : 
      cleanParams.gasPrice.toString()) : undefined, // Add gasPrice for legacy transactions
    gasFeeCap: typeof cleanParams.maxFeePerGas === 'string' ? 
      parseInt(cleanParams.maxFeePerGas, 16).toString() : 
      cleanParams.maxFeePerGas.toString(),
    gasTipCap: typeof cleanParams.maxPriorityFeePerGas === 'string' ? 
      parseInt(cleanParams.maxPriorityFeePerGas, 16).toString() : 
      cleanParams.maxPriorityFeePerGas.toString(),
    authList: cleanParams.authorizationList ? 
      cleanParams.authorizationList.map(convertPrivyAuthToTxWasm) : 
      []
  };
  
  console.log('📦 Creating unsigned transaction with params:', txInput);
  
  // Test JSON serialization before passing to WASM
  try {
    const jsonString = JSON.stringify(txInput);
    console.log('✅ JSON serialization successful, length:', jsonString.length);
  } catch (error) {
    console.error('❌ JSON serialization failed:', error);
    console.error('Problematic txInput:', txInput);
    throw new Error('Failed to serialize transaction parameters: ' + (error as Error).message);
  }
  
  const result = window.makeUnsignTx(JSON.stringify(txInput));
  
  if (result.error) {
    throw new Error(`WASM makeUnsignTx error: ${result.error}`);
  }
  
  console.log('✅ Unsigned transaction created:', {
    unsignedTx: result.unsignedTx.substring(0, 20) + '...',
    signHash: result.signHash
  });
  
  return {
    unsignedTx: result.unsignedTx,
    signHash: result.signHash
  };
};

/**
 * Compile unsigned transaction with signature using WASM
 * @param {string} unsignedTx - Unsigned transaction hex
 * @param {string} signature - 65-byte signature hex (r||s||v)
 * @param {number} chainId - Chain ID
 * @returns {Object} { signedTx, txHash }
 */
export const compileSignedTransaction = async (unsignedTx: string, signature: string, chainId: number | string) => {
  if (!wasmReady) {
    await initializeWasm();
    if (!wasmReady) {
      throw new Error('WASM module not available');
    }
  }
  
  if (typeof window.compileUnsignTxWithSignature !== 'function') {
    throw new Error('compileUnsignTxWithSignature function not available in WASM');
  }
  
  // Convert BigInt values if any
  const cleanChainId = convertBigInts(chainId);
  
  const compileInput = {
    chainId: typeof cleanChainId === 'string' ? parseInt(cleanChainId, 16) : cleanChainId,
    unsignedTx: unsignedTx,
    signature: signature
  };
  
  console.log('🔧 Compiling signed transaction:', {
    chainId: compileInput.chainId,
    unsignedTx: compileInput.unsignedTx.substring(0, 20) + '...',
    signature: compileInput.signature.substring(0, 20) + '...'
  });
  
  const result = window.compileUnsignTxWithSignature(JSON.stringify(compileInput));
  
  if (result.error) {
    throw new Error(`WASM compile error: ${result.error}`);
  }
  
  console.log('✅ Signed transaction compiled:', {
    signedTx: result.signedTx.substring(0, 20) + '...',
    txHash: result.txHash
  });
  
  return {
    signedTx: result.signedTx,
    txHash: result.txHash
  };
};

/**
 * Sign a message hash using external wallet (Privy)
 * @param {string} signHash - Hash to sign
 * @param {Function} signFunction - Privy signing function
 * @returns {string} 65-byte signature (r||s||v)
 */
export const signHashWithPrivy = async (signHash: string, signFunction: (hash: string) => Promise<any>) => {
  try {
    console.log('✍️ Signing hash with Privy:', signHash);
    
    // Sign the hash using Privy
    const signature = await signFunction(signHash);
    
    let sigHex;
    if (typeof signature === 'string') {
      sigHex = signature;
    } else if (signature.r && signature.s && (signature.v !== undefined || signature.yParity !== undefined)) {
      // Reconstruct signature from r, s, v components
      const r = signature.r.startsWith('0x') ? signature.r.slice(2) : signature.r;
      const s = signature.s.startsWith('0x') ? signature.s.slice(2) : signature.s;
      const v = signature.v !== undefined ? signature.v : (signature.yParity + 27);
      sigHex = `0x${r}${s}${v.toString(16).padStart(2, '0')}`;
    } else {
      throw new Error('Invalid signature format from Privy');
    }
    
    // Ensure signature is 65 bytes (130 hex chars + 0x)
    if (sigHex.length !== 132) {
      throw new Error(`Invalid signature length: expected 132 chars, got ${sigHex.length}`);
    }
    
    console.log('✅ Hash signed:', sigHex.substring(0, 20) + '...');
    return sigHex;
    
  } catch (error) {
    console.error('Failed to sign hash:', error);
    throw error;
  }
};

/**
 * Get injected wallet provider (MetaMask, etc.)
 */
export const getInjectedProvider = () => {
  if (typeof window !== 'undefined' && window.ethereum) {
    if (window.ethereum.isMetaMask) {
      console.log('🦊 MetaMask detected');
    }
    return window.ethereum;
  }
  throw new Error('No injected wallet found. Please install MetaMask.');
};

/**
 * Broadcast signed transaction using Privy embedded wallet
 * @param {string} signedTx - Signed transaction hex
 * @param {Object} embeddedWallet - Privy embedded wallet instance
 * @returns {string} Transaction hash
 */
export const broadcastWithPrivyWallet = async (signedTx: string, embeddedWallet: any) => {
  try {
    if (!embeddedWallet || !embeddedWallet.address) {
      throw new Error('Embedded wallet not available');
    }

    const provider = await embeddedWallet.getEthereumProvider();
    
    console.log('📡 Broadcasting transaction with Privy embedded wallet...');
    const txHash = await (provider.request as any)({
      method: 'eth_sendRawTransaction',
      params: [signedTx],
    });
    
    console.log('✅ Transaction broadcasted:', txHash);
    return txHash;
  } catch (error) {
    console.error('Failed to broadcast transaction:', error);
    
    if ((error as any).code === 4001) {
      throw new Error('Transaction rejected by user');
    } else if ((error as any).code === -32603) {
      throw new Error('Internal error - transaction may be malformed');
    }
    
    throw error;
  }
};

/**
 * Broadcast signed transaction using injected wallet (kept for fallback)
 * @param {string} signedTx - Signed transaction hex
 * @returns {string} Transaction hash
 */
export const broadcastWithInjectedWallet = async (signedTx: string) => {
  try {
    const provider = getInjectedProvider();
    
    console.log('📡 Broadcasting transaction with MetaMask...');
    const txHash = await (provider.request as any)({
      method: 'eth_sendRawTransaction',
      params: [signedTx],
    });
    
    console.log('✅ Transaction broadcasted:', txHash);
    return txHash;
  } catch (error) {
    console.error('Failed to broadcast transaction:', error);
    
    if ((error as any).code === 4001) {
      throw new Error('Transaction rejected by user');
    } else if ((error as any).code === -32603) {
      throw new Error('Internal error - transaction may be malformed');
    }
    
    throw error;
  }
};

/**
 * Check if injected wallet is connected
 */
export const isInjectedWalletConnected = async () => {
  try {
    const provider = getInjectedProvider();
    const accounts = await (provider.request as any)({ method: 'eth_accounts' });
    return accounts && accounts.length > 0;
  } catch {
    return false;
  }
};

/**
 * Connect injected wallet
 */
export const connectInjectedWallet = async () => {
  try {
    const provider = getInjectedProvider();
    const accounts = await (provider.request as any)({ method: 'eth_requestAccounts' });
    console.log('💳 Connected accounts:', accounts);
    return accounts;
  } catch (error) {
    console.error('Failed to connect wallet:', error);
    throw error;
  }
};

/**
 * Complete EIP-7702 transaction flow:
 * 1. Create unsigned transaction
 * 2. Sign the hash with Privy
 * 3. Compile signed transaction
 * 4. Broadcast with Privy embedded wallet
 */
export const signAndBroadcastEIP7702Transaction = async (params: any, privySignFunction: any, embeddedWallet: any) => {
  try {
    console.log('🚀 Starting EIP-7702 transaction flow...');
    
    if (privySignFunction) {
      // Full flow: makeUnsignTx -> sign -> compile -> broadcast
      
      // Step 1: Create unsigned transaction
      const { unsignedTx, signHash } = await makeUnsignedTransaction(params);
      
      // Step 2: Sign the hash with Privy
      const signature = await signHashWithPrivy(signHash, privySignFunction);
      
      // Step 3: Compile signed transaction
      const { signedTx, txHash } = await compileSignedTransaction(
        unsignedTx, 
        signature, 
        params.chainId
      );
      
      // Step 4: Broadcast with Privy embedded wallet
      const broadcastedTxHash = await broadcastWithPrivyWallet(signedTx, embeddedWallet);
      
      console.log('🎉 EIP-7702 transaction completed:', broadcastedTxHash);
      return {
        txHash: broadcastedTxHash,
        signedTx: signedTx
      };
    } else {
      // Simplified flow: just makeUnsignTx and broadcast (steps 2 and 5)
      console.log('📦 Step 2: Creating unsigned transaction with WASM...');
      const { unsignedTx, signHash } = await makeUnsignedTransaction(params);
      console.log('Generated signHash:', signHash);
      
      console.log('📡 Step 5: Broadcasting transaction...');
      const broadcastedTxHash = await broadcastWithPrivyWallet(unsignedTx, embeddedWallet);
      
      console.log('🎉 EIP-7702 transaction completed:', broadcastedTxHash);
      return {
        txHash: broadcastedTxHash,
        signedTx: unsignedTx
      };
    }
    
  } catch (error) {
    console.error('EIP-7702 transaction flow failed:', error);
    throw error;
  }
};