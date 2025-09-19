/**
 * WASM Initializer for EIP-7702 Transaction Building
 */

declare global {
  interface Window {
    Go: any;
    makeUnsignTx: (params: string) => { error?: string; signHash?: string; unsignedTx?: string };
    compileUnsignTxWithSignature: (params: string) => { error?: string; signedTx?: string };
  }
}

export interface WasmInstance {
  makeUnsignTx: (params: string) => { error?: string; signHash?: string; unsignedTx?: string };
  compileUnsignTxWithSignature: (params: string) => { error?: string; signedTx?: string };
  isInitialized: boolean;
}

class WasmLoader {
  private static instance: WasmLoader | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): WasmLoader {
    if (!WasmLoader.instance) {
      WasmLoader.instance = new WasmLoader();
    }
    return WasmLoader.instance;
  }

  async initialize(wasmPath = '/eip7702.wasm', execPath = '/wasm_exec.js'): Promise<WasmInstance> {
    if (this.initialized) {
      return this.getWasmInstance();
    }

    if (this.initPromise) {
      await this.initPromise;
      return this.getWasmInstance();
    }

    this.initPromise = this.loadWasm(wasmPath, execPath);
    await this.initPromise;
    this.initialized = true;

    return this.getWasmInstance();
  }

  private async loadWasm(wasmPath: string, execPath: string): Promise<void> {
    // Load wasm_exec.js if not already loaded
    if (typeof window !== 'undefined' && !window.Go) {
      await this.loadScript(execPath);
    }

    // Initialize Go runtime
    const go = new window.Go();

    // Fetch and instantiate WASM
    const wasmResponse = await fetch(wasmPath);
    const wasmBuffer = await wasmResponse.arrayBuffer();
    const wasmModule = await WebAssembly.instantiate(wasmBuffer, go.importObject);

    // Run the Go program
    go.run(wasmModule.instance);

    // Wait a bit for WASM functions to be available
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify functions are available
    if (!window.makeUnsignTx || !window.compileUnsignTxWithSignature) {
      throw new Error('WASM functions not available after initialization');
    }
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  private getWasmInstance(): WasmInstance {
    if (!window.makeUnsignTx || !window.compileUnsignTxWithSignature) {
      throw new Error('WASM not initialized');
    }

    return {
      makeUnsignTx: window.makeUnsignTx,
      compileUnsignTxWithSignature: window.compileUnsignTxWithSignature,
      isInitialized: true
    };
  }

  isReady(): boolean {
    return this.initialized;
  }
}

export const wasmInitializer = WasmLoader.getInstance();

/**
 * Initialize WASM for EIP-7702 transaction building
 *
 * @param wasmPath - Path to the WASM file (default: '/eip7702.wasm')
 * @param execPath - Path to the wasm_exec.js file (default: '/wasm_exec.js')
 * @returns Promise<WasmInstance> - WASM instance with transaction building functions
 *
 * @example
 * ```typescript
 * import { initializeWasm } from '@krnl/delegated-account';
 *
 * const wasm = await initializeWasm();
 * const unsignedTx = wasm.makeUnsignTx(JSON.stringify(params));
 * ```
 */
export async function initializeWasm(
  wasmPath = '/eip7702.wasm',
  execPath = '/wasm_exec.js'
): Promise<WasmInstance> {
  return wasmInitializer.initialize(wasmPath, execPath);
}

// Export hook interface for React usage
export interface UseWasmInitResult {
  wasm: WasmInstance | null;
  isLoading: boolean;
  error: string | null;
}