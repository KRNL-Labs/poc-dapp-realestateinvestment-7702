import { useState, useEffect, useCallback } from 'react';
import { useWallets, useSign7702Authorization } from '@privy-io/react-auth';
import { getRequiredChainId } from '../utils/chains';
import { initializeWasm } from '../utils/transactionSerializer';

export const useSmartAccountAuth = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [smartAccountEnabled, setSmartAccountEnabled] = useState(false);
  const [waitingForTx, setWaitingForTx] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const { wallets } = useWallets();
  const { signAuthorization } = useSign7702Authorization();

  const embeddedWallet = wallets.find(wallet => 
    wallet.connectorType === 'embedded'
  ) || null;

  const smartContractAddress = import.meta.env.VITE_DELEGATED_ACCOUNT_ADDRESS as string;
  useEffect(() => {
    initializeWasm().catch(console.error);
  }, []);

  const checkAuthorizationStatus = useCallback(async () => {
    if (!embeddedWallet?.address || !smartContractAddress) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const provider = await embeddedWallet.getEthereumProvider();
      const authStatus = await checkEIP7702Authorization(provider, embeddedWallet.address, smartContractAddress);
      setIsAuthorized(authStatus.isAuthorized);
      setSmartAccountEnabled(authStatus.smartAccountEnabled);
      
    } catch (err) {
      console.error('Error checking authorization status:', err);
      setError((err as Error).message);
      setIsAuthorized(false);
      setSmartAccountEnabled(false);
    } finally {
      setIsLoading(false);
    }
  }, [embeddedWallet?.address, smartContractAddress]);

  const enableSmartAccount = useCallback(async () => {
    if (!embeddedWallet?.address || !smartContractAddress) return false;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const provider = await embeddedWallet.getEthereumProvider();
      const currentNonce = await provider.request({
        method: 'eth_getTransactionCount',
        params: [embeddedWallet.address, 'latest']
      });
      const authNonce = parseInt(currentNonce, 16);
      const authorization = await signAuthorization({
        contractAddress: smartContractAddress as `0x${string}`,
        chainId: getRequiredChainId(),
        nonce: authNonce + 1
      }, {
        address: embeddedWallet.address
      });
      
      const convertBigInts = (obj: any): any => {
        if (typeof obj === 'bigint') {
          return Number(obj);
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

      const signedAuth = {
        ...convertBigInts(authorization),
        userAddr: embeddedWallet.address
      };
      
      const params = {
        chainId: getRequiredChainId(),
        nonce: authNonce,
        to: '0x0000000000000000000000000000000000000000',
        gas: 50000,
        gasFeeCap: "20000000000",
        gasTipCap: "5000000000",
        authList: [
          { 
            chainId: signedAuth.chainId || getRequiredChainId(),
            address: signedAuth.contractAddress || smartContractAddress,
            nonce: signedAuth.nonce || authNonce,
            r: signedAuth.r,
            s: signedAuth.s,
            v: signedAuth.v && signedAuth.v >= 27 ? signedAuth.v - 27 : signedAuth.v
          }
        ]
      };
      
      const u = window.makeUnsignTx(JSON.stringify(params));
      
      if (u.error) {
        throw new Error(`WASM makeUnsignTx error: ${u.error}`);
      }
      
      if (!embeddedWallet) {
        throw new Error('Privy embedded wallet not found.');
      }
      
      const signingProvider = await embeddedWallet.getEthereumProvider();
      const hashSignature = await signingProvider.request({
        method: 'secp256k1_sign',
        params: [u.signHash]
      });
      
      const signature = hashSignature;
      
      const c = window.compileUnsignTxWithSignature(JSON.stringify({
        chainId: params.chainId,
        unsignedTx: u.unsignedTx,
        signature: signature,
      }));
      
      if (c.error) {
        throw new Error(`WASM compile error: ${c.error}`);
      }
      
      const broadcastTxHash = await (window.ethereum as any).request({
        method: 'eth_sendRawTransaction',
        params: [c.signedTx]
      });
      const result = { success: true, transactionHash: broadcastTxHash };
      
      if (result.success) {
        setWaitingForTx(true);
        setTxHash(result.transactionHash);
        const provider = await embeddedWallet.getEthereumProvider();
        const txHash = result.transactionHash;
        
        let receipt = null;
        let attempts = 0;
        
        while (!receipt) {
          try {
            receipt = await provider.request({
              method: 'eth_getTransactionReceipt',
              params: [txHash]
            });
            
            if (receipt) {
              const currentBlock = await provider.request({
                method: 'eth_blockNumber',
                params: []
              });
              const blocksDifference = parseInt(currentBlock, 16) - parseInt(receipt.blockNumber, 16);
              
              if (blocksDifference >= 1) {
                break;
              } else {
                receipt = null;
              }
            }
          } catch (err) {
            
          }
          
          await new Promise(resolve => setTimeout(resolve, 5000));
          attempts++;
          
          if (attempts % 12 === 0) {
            console.log(`Still waiting for transaction confirmation... (${Math.floor(attempts * 5 / 60)} minutes)`);
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        setWaitingForTx(false);
        setTxHash(null);
        setSmartAccountEnabled(true);
        await checkAuthorizationStatus();
        return true;
      } else {
        throw new Error('Transaction failed');
      }
      
    } catch (err) {
      console.error('Error enabling smart account:', err);
      setError((err as Error).message);
      setWaitingForTx(false);
      setTxHash(null);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [embeddedWallet?.address, smartContractAddress, signAuthorization, checkAuthorizationStatus]);


  useEffect(() => {
    if (embeddedWallet?.address && smartContractAddress) {
      checkAuthorizationStatus();
    }
  }, [embeddedWallet?.address, smartContractAddress, checkAuthorizationStatus]);

  return {
    isAuthorized,
    smartAccountEnabled,
    isLoading,
    error,
    enableSmartAccount,
    refreshStatus: checkAuthorizationStatus,
    smartContractAddress,
    waitingForTx,
    txHash
  };
};

async function checkEIP7702Authorization(provider: any, walletAddress: string, contractAddress: string) {
  try {
    const accountCode = await provider.request({
      method: 'eth_getCode',
      params: [walletAddress, 'latest']
    });
    
    const smartAccountEnabled = accountCode && accountCode !== '0x' && accountCode.length > 2;
    
    // Method 2: Try to detect delegation by checking if the account has delegated authority
    // This could involve checking storage slots or other delegation indicators
    let isAuthorized = false;
    
    if (smartAccountEnabled && contractAddress) {
      try {
        // Check if wallet code contains the contract address (without 0x prefix)
        const contractAddressWithoutPrefix = contractAddress.toLowerCase().slice(2);
        const accountCodeWithoutPrefix = accountCode.toLowerCase().slice(2);
        
        // Authorization is true if wallet code contains the contract address
        isAuthorized = accountCodeWithoutPrefix.includes(contractAddressWithoutPrefix);
        
        console.log('Authorization check results:');
        console.log('- Wallet address:', walletAddress);
        console.log('- Contract address:', contractAddress);
        console.log('- Wallet code:', accountCode);
        console.log('- Contract address in wallet code:', isAuthorized);
        
      } catch (authCheckError) {
        console.log('Authorization check failed:', authCheckError);
        isAuthorized = false;
      }
    }
    
    return {
      isAuthorized,
      smartAccountEnabled
    };
    
  } catch (error) {
    console.error('Error checking EIP-7702 status:', error);
    return {
      isAuthorized: false,
      smartAccountEnabled: false
    };
  }
}