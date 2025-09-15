import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface WorkflowStep {
  title: string;
  description: string;
  details: string[];
}

export function TestWorkflowSection() {
  const workflowSteps: WorkflowStep[] = [
    {
      title: 'Fetch Property Data',
      description: 'Retrieve property information from Zillow API',
      details: [
        'Search for property by address',
        'Get property ID (zpid)',
        'Extract address components (street, city, state, zipcode)'
      ]
    },
    {
      title: 'Get Market Analysis',
      description: 'Fetch property valuation and market data',
      details: [
        'Get Zestimate (property value)',
        'Get rent estimate',
        'Extract property details (bedrooms, bathrooms, sqft, year built, type)'
      ]
    },
    {
      title: 'AI Property Analysis',
      description: 'Generate investment recommendation using OpenAI',
      details: [
        'Analyze property data with AI',
        'Generate investment recommendation (INVEST/HOLD/PASS)',
        'Calculate investment grade (A+ to D)',
        'Estimate expected annual yield and confidence score'
      ]
    },
    {
      title: 'Encode for Blockchain',
      description: 'Convert AI analysis to blockchain-compatible format',
      details: [
        'Encode property info as Solidity tuple',
        'Format numbers for smart contract (uint256 with proper decimals)',
        'Prepare data structure for contract call'
      ]
    },
    {
      title: 'Prepare Authorization',
      description: 'Generate authorization signature for secure execution',
      details: [
        'Create authorization nonce and expiry',
        'Generate execution signature',
        'Prepare sponsor execution fee data'
      ]
    },
    {
      title: 'Generate Contract Call Data',
      description: 'Create calldata for RealEstate contract function',
      details: [
        'Encode submitPropertyAnalysis function call',
        'Include authorization data',
        'Prepare transaction parameters'
      ]
    },
    {
      title: 'Smart Account Execution',
      description: 'Prepare call through user\'s smart account',
      details: [
        'Format for smart account execute function',
        'Set target contract and value',
        'Include fee parameters (USDC amount, ETH price)'
      ]
    },
    {
      title: 'Submit Transaction Bundle',
      description: 'Execute transaction through bundler with paymaster',
      details: [
        'Create UserOperation for ERC-4337',
        'Submit through Pimlico bundler',
        'Use paymaster for gas sponsorship',
        'Wait for transaction confirmation'
      ]
    }
  ];


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Property Analysis Workflow</CardTitle>
          <CardDescription>
            This workflow demonstrates the complete property analysis process from data fetching to blockchain submission.
            Use the "Test Workflow Execution" button in the dashboard to run the full workflow.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4">
        {workflowSteps.map((step, index) => (
          <Card key={index} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800">
                  <span className="text-sm font-medium">{index + 1}</span>
                </div>
                <div>
                  <CardTitle className="text-lg">{step.title}</CardTitle>
                  <CardDescription>{step.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="ml-11">
                <ul className="space-y-1 text-sm text-gray-600">
                  {step.details.map((detail, detailIndex) => (
                    <li key={detailIndex} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 text-blue-500 mt-0.5">ℹ️</div>
            <div>
              <h3 className="font-medium text-blue-900 mb-2">What happens when you click "Test Scenario"?</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Uses your connected embedded wallet as the sender</li>
                <li>• Generates a complete test scenario JSON with all workflow steps</li>
                <li>• Sent to KRNL Node for secure execution</li>
                <li>• Demonstrates the full property analysis and investment workflow</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default TestWorkflowSection;