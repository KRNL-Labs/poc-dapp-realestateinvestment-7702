interface ScenarioConfig {
  senderAddress: string; // User's embedded wallet address (required parameter)
  executionFee?: string;
  propertyAddress?: string;
  propertyCityStateZip?: string;
  bundlerApiKey?: string;
  rpcUrl?: string;
  chainId?: number;
}

export function generateTestScenario(config: ScenarioConfig) {
  // Get required values from environment variables
  const targetContract = import.meta.env.VITE_REAL_ESTATE_INVESTMENT_ADDRESS; // RealEstate contract
  const zillowApiKey = import.meta.env.VITE_ZILLOW_API_KEY || "demo-api-key";
  const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!config.senderAddress) {
    throw new Error("senderAddress (user's embedded wallet) is required");
  }
  if (!targetContract) {
    throw new Error("VITE_REAL_ESTATE_INVESTMENT_ADDRESS environment variable is required");
  }
  if (!openaiApiKey) {
    throw new Error("VITE_OPENAI_API_KEY environment variable is required");
  }

  // Default values
  const defaults = {
    executionFee: "0.01",
    propertyAddress: "1234-Maple-Street",
    propertyCityStateZip: "Austin,TX",
    bundlerApiKey: "pim_AFZB7SRqytR4SQ7x7jpNxd",
    rpcUrl: "https://lb.drpc.org/sepolia/AnRM4mK1tEyphrn_jexSLbpLCWW7uMMR76KguivZK8k9",
    chainId: 11155111,
  };

  // Merge config with defaults
  const finalConfig = {
    ...defaults,
    ...config,
    targetContract,
    zillowApiKey,
    openaiApiKey
  };

  // Image hashes
  const images = {
    executorHttp: "ghcr.io/krnl-labs/executor-http@sha256:7ea7eae002f173aab994444e9e0863f8a8fd8255c7ed3a234218e66c3e1f3c60",
    executorEncoderEvm: "ghcr.io/krnl-labs/executor-encoder-evm@sha256:2f1cfef0107e4ff200539234d10bde2c3ba1f7982b75a806e3d38feacb1d4091",
    executorPrepareAuthdata: "ghcr.io/krnl-labs/executor-prepare-authdata@sha256:3a1c9c8828da07f1da367b91fbd0a41f47274af63bc521a6c2499aee04e02e30",
    executorDataBundle: "ghcr.io/krnl-labs/executor-data-bundle@sha256:ff49252428eb8adcb1462d0d8ab4c46e2bb2eb5576ec7d717430197597beba78",
  };

  const attestorUrl = "https://public.mypinata.cloud/ipfs/bafybeihxz6sjyhumjsgecuc74hedktbvbuinkstssql6ofivqrbg6omzxi";

  return {
    sender: finalConfig.senderAddress,
    executionFee: finalConfig.executionFee,
    workflow: {
      name: "real-estate-investment-submit-property-analysis",
      version: "v1.0.0",
      steps: [
        {
          type: 10,
          name: "property-data-fetcher",
          image: images.executorHttp,
          attestor: attestorUrl,
          next: "market-data-fetcher",
          config: {},
          inputs: {
            url: `https://poc.platform.lat/zillow/webservice/GetSearchResults.htm?zws-id=${finalConfig.zillowApiKey}&address=${finalConfig.propertyAddress}&citystatezip=${finalConfig.propertyCityStateZip}`,
            method: "GET"
          },
          outputs: [
            {
              name: "zpid",
              value: "response.body.searchResults.zpid",
              required: true,
              export: true
            },
            {
              name: "address.street",
              value: "response.body.searchResults.address.street",
              required: true,
              export: true
            },
            {
              name: "address.zipcode",
              value: "response.body.searchResults.address.zipcode",
              required: true,
              export: true
            },
            {
              name: "address.city",
              value: "response.body.searchResults.address.city",
              required: true,
              export: true
            },
            {
              name: "address.state",
              value: "response.body.searchResults.address.state",
              required: true,
              export: true
            }
          ]
        },
        {
          name: "market-data-fetcher",
          image: images.executorHttp,
          attestor: attestorUrl,
          next: "ai-property-analysis",
          config: {},
          inputs: {
            url: `https://poc.platform.lat/zillow/webservice/GetZestimate.htm?zws-id=${finalConfig.zillowApiKey}&zpid=\${property-data-fetcher.zpid}`,
            method: "GET"
          },
          outputs: [
            {
              name: "zestimate.amount.value",
              value: "response.body.zestimate.amount.value",
              required: true,
              export: true
            },
            {
              name: "zestimate.amount.currency",
              value: "response.body.zestimate.amount.currency",
              required: true,
              export: true
            },
            {
              name: "zestimate.rent.value",
              value: "response.body.zestimate.rentZestimate.value",
              required: true,
              export: true
            },
            {
              name: "zestimate.rent.currency",
              value: "response.body.zestimate.rentZestimate.currency",
              required: true,
              export: true
            },
            {
              name: "property.bedrooms",
              value: "response.body.property.bedrooms",
              required: true,
              export: true
            },
            {
              name: "property.bathrooms",
              value: "response.body.property.bathrooms",
              required: true,
              export: true
            },
            {
              name: "property.finishedSqFt",
              value: "response.body.property.finishedSqFt",
              required: true,
              export: true
            },
            {
              name: "property.yearBuilt",
              value: "response.body.property.yearBuilt",
              required: true,
              export: true
            },
            {
              name: "property.type",
              value: "response.body.property.propertyType",
              required: true,
              export: true
            }
          ]
        },
        {
          name: "ai-property-analysis",
          image: images.executorHttp,
          attestor: attestorUrl,
          next: "construct-property-analysis-evm",
          config: {},
          inputs: {
            url: "https://api.openai.com/v1/chat/completions",
            method: "POST",
            headers: {
              "Accept": "*/*",
              "Content-Type": "application/json",
              "Authorization": `Bearer ${finalConfig.openaiApiKey}`
            },
            body: {
              model: "gpt-4o-mini",
              temperature: 0,
              response_format: {
                type: "json_object"
              },
              messages: [
                {
                  role: "system",
                  content: "You are a professional real estate analyst. Only output valid JSON."
                },
                {
                  role: "user",
                  content: "You are a professional real estate investment analyst with 15 years of experience. You analyze property data objectively and provide structured investment recommendations. Analyze this property for investment potential. Property: ${property-data-fetcher.address.street}, ${property-data-fetcher.address.city}, ${property-data-fetcher.address.state} ${property-data-fetcher.address.zipcode}. With bedrooms: ${market-data-fetcher.property.bedrooms}, bathrooms: ${market-data-fetcher.property.bathrooms}, finished square feet: ${market-data-fetcher.property.finishedSqFt}, year built: ${market-data-fetcher.property.yearBuilt}, type: ${market-data-fetcher.property.type}. Zillow Estimate: ${market-data-fetcher.zestimate.amount.value}(${market-data-fetcher.zestimate.amount.currency}). Monthly rent Zillow estimate: ${market-data-fetcher.zestimate.rent.value}(${market-data-fetcher.zestimate.rent.currency}). Return analysis in this exact JSON format: { recommendation: INVEST/HOLD/PASS, property_value: number*10^20, investment_grade: A+/A/B+/B/C+/C/D, expected_annual_yield: number*10^18, confidence: number (1-100), invest_value: number * 10^18 }. Always return valid JSON in the exact format requested."
                }
              ]
            },
            timeout: 30
          },
          outputs: [
            {
              name: "result",
              value: "response.body.choices.0.message.content",
              type: "json",
              required: true,
              export: true
            }
          ]
        },
        {
          name: "construct-property-analysis-evm",
          image: images.executorEncoderEvm,
          attestor: attestorUrl,
          next: "prepare-authdata",
          config: {
            parameters: [
              {
                name: "propertyInfo",
                type: "tuple",
                components: [
                  {
                    name: "confidence",
                    type: "uint256"
                  },
                  {
                    name: "expectedAnnualYield",
                    type: "uint256"
                  },
                  {
                    name: "investmentGrade",
                    type: "string"
                  },
                  {
                    name: "propertyValue",
                    type: "uint256"
                  },
                  {
                    name: "recommendation",
                    type: "string"
                  }
                ]
              }
            ]
          },
          inputs: {
            value: {
              propertyInfo: {
                confidence: "${ai-property-analysis.result.confidence}",
                expectedAnnualYield: "${ai-property-analysis.result.expected_annual_yield}",
                investmentGrade: "${ai-property-analysis.result.investment_grade}",
                propertyValue: "${ai-property-analysis.result.property_value}",
                recommendation: "${ai-property-analysis.result.recommendation}"
              }
            }
          },
          outputs: [
            {
              name: "result",
              value: "result",
              required: true,
              export: true
            }
          ]
        },
        {
          name: "prepare-authdata",
          image: images.executorPrepareAuthdata,
          attestor: attestorUrl,
          next: "target-calldata",
          config: {
            rpc_url: finalConfig.rpcUrl,
            target_contract: finalConfig.targetContract,
            function_signature: "submitPropertyAnalysis((uint256,uint256,bytes32,(bytes32,bytes,bytes)[],bytes,bool,bytes))",
            sender: finalConfig.senderAddress,
            sponsor_execution_fee: true
          },
          inputs: {
            result: "${construct-property-analysis-evm.result}",
            executions: []
          },
          outputs: [
            {
              name: "nonce",
              value: "nonce",
              required: true,
              export: true
            },
            {
              name: "expiry",
              value: "expiry",
              required: true,
              export: true
            },
            {
              name: "id",
              value: "id",
              required: true,
              export: true
            },
            {
              name: "executions",
              value: "executions",
              required: true,
              export: true
            },
            {
              name: "result",
              value: "result",
              required: true,
              export: true
            },
            {
              name: "sponsor_execution_fee",
              value: "sponsor_execution_fee",
              required: true,
              export: true
            },
            {
              name: "signature",
              value: "signature",
              required: true,
              export: true
            }
          ]
        },
        {
          name: "target-calldata",
          image: images.executorEncoderEvm,
          attestor: attestorUrl,
          next: "sca-calldata",
          config: {
            function_signature: "submitPropertyAnalysis((uint256,uint256,bytes32,(bytes32,bytes,bytes)[],bytes,bool,bytes))",
            parameters: [
              {
                name: "authData",
                type: "tuple",
                components: [
                  {
                    name: "nonce",
                    type: "uint256"
                  },
                  {
                    name: "expiry",
                    type: "uint256"
                  },
                  {
                    name: "id",
                    type: "bytes32"
                  },
                  {
                    name: "executions",
                    type: "tuple[]",
                    components: [
                      {
                        name: "id",
                        type: "bytes32"
                      },
                      {
                        name: "request",
                        type: "bytes"
                      },
                      {
                        name: "response",
                        type: "bytes"
                      }
                    ]
                  },
                  {
                    name: "result",
                    type: "bytes"
                  },
                  {
                    name: "sponsorExecutionFee",
                    type: "bool"
                  },
                  {
                    name: "signature",
                    type: "bytes"
                  }
                ]
              }
            ]
          },
          inputs: {
            value: {
              authData: {
                nonce: "${prepare-authdata.nonce}",
                expiry: "${prepare-authdata.expiry}",
                id: "${prepare-authdata.id}",
                executions: [],
                result: "${prepare-authdata.result}",
                sponsorExecutionFee: "${prepare-authdata.sponsor_execution_fee}",
                signature: "${prepare-authdata.signature}"
              }
            }
          },
          outputs: [
            {
              name: "result",
              value: "result",
              required: true,
              export: true
            }
          ]
        },
        {
          name: "sca-calldata",
          image: images.executorEncoderEvm,
          attestor: attestorUrl,
          next: "bundle",
          config: {
            function_signature: "execute(address,uint256,bytes,uint256,uint256)",
            parameters: [
              {
                name: "dest",
                type: "address"
              },
              {
                name: "value",
                type: "uint256"
              },
              {
                name: "func",
                type: "bytes"
              },
              {
                name: "feeUsdcAmount",
                type: "uint256"
              },
              {
                name: "usdcPerEth",
                type: "uint256"
              }
            ]
          },
          inputs: {
            value: {
              dest: finalConfig.targetContract,
              value: "0",
              func: "${target-calldata.result}",
              feeUsdcAmount: "1000001",
              usdcPerEth: "3000000000"
            }
          },
          outputs: [
            {
              name: "result",
              value: "result",
              required: true,
              export: true
            }
          ]
        },
        {
          name: "bundle",
          image: images.executorDataBundle,
          attestor: attestorUrl,
          config: {
            chain_id: finalConfig.chainId,
            sender: finalConfig.senderAddress,
            bundler_url: `https://api.pimlico.io/v2/sepolia/rpc?apikey=${finalConfig.bundlerApiKey}`,
            paymaster_url: `https://api.pimlico.io/v2/sepolia/rpc?apikey=${finalConfig.bundlerApiKey}`,
            rpc_url: finalConfig.rpcUrl,
            entrypoint_address: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
            target_contract: finalConfig.targetContract,
            function_signature: "execute(address,uint256,bytes,uint256,uint256)",
            gas_limit: "100000",
            max_fee_per_gas: "20000000000",
            max_priority_fee_per_gas: "2000000000"
          },
          inputs: {
            calldata: "${sca-calldata.result}"
          },
          outputs: [
            {
              name: "user_op_hash",
              value: "user_op_hash",
              required: true,
              export: true
            },
            {
              name: "status",
              value: "status",
              required: true,
              export: true
            },
            {
              name: "error",
              value: "error",
              type: "string"
            }
          ]
        }
      ]
    },
    dapp: {
      name: "real-estate-investment",
      targetChainID: finalConfig.chainId,
      targetContractAddress: finalConfig.targetContract,
      targetFunctionSignature: "submitPropertyAnalysis((uint256,uint256,bytes32,(bytes32,bytes,bytes)[],bytes,bool,bytes))"
    }
  };
}

// Send test scenario directly to KRNL node
export async function sendTestScenario(config: ScenarioConfig) {
  const scenario = generateTestScenario(config);

  // Create KRNL JSON-RPC request structure
  const krnlRequest = {
    id: 1,
    jsonrpc: "2.0",
    method: "krnl_executeWorkflow",
    params: [scenario]
  };

  try {
    const response = await fetch("https://v0-1-0.node.lat/", {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.oci.image.manifest.v1+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(krnlRequest)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    // Check for JSON-RPC error response
    if (result.error) {
      throw new Error(`KRNL error: ${result.error.message || JSON.stringify(result.error)}`);
    }

    return result;
  } catch (error) {
    console.error('Error sending test scenario to KRNL:', error);
    throw error;
  }
}