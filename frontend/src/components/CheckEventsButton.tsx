import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ethers } from 'ethers';
import { Search, Loader2 } from 'lucide-react';
import { logger } from '@/utils/logger';
import { CONTRACT_ADDRESSES, BLOCK_LOOKBACK, DEFAULT_CHAIN } from '@/utils/constants';

const REAL_ESTATE_INVESTMENT_ADDRESS = CONTRACT_ADDRESSES.REAL_ESTATE_INVESTMENT;

// ABI for the events we want to listen to
const REAL_ESTATE_ABI = [
  "event PropertyAnalyzed(address indexed caller, uint256 indexed nonce, bytes32 indexed id, string propertyAddress, uint256 totalValue, string investmentGrade, uint256 expectedYield, uint256 confidence, string recommendation)",
  "event TokensPurchased(address indexed caller, uint256 indexed nonce, bytes32 indexed id, address investor, uint256 tokenAmount, uint256 usdcAmount, uint256 ownershipPercentage, uint256 timestamp)",
  "event InvestmentOpened(address indexed caller, uint256 indexed nonce, bytes32 indexed id, string propertyAddress, uint256 totalValue, uint256 totalTokenSupply, uint256 pricePerToken)"
];

interface CheckEventsButtonProps {
  onEventsFound?: (events: any[]) => void;
  onError?: (error: Error) => void;
}

export function CheckEventsButton({ onEventsFound, onError }: CheckEventsButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [events, setEvents] = useState<any[]>([]);

  const checkEvents = async () => {
    setIsLoading(true);
    setEvents([]);

    try {
      // Connect to default chain using public RPC
      const provider = new ethers.JsonRpcProvider(DEFAULT_CHAIN.rpcUrl);

      // Create contract interface
      const contract = new ethers.Contract(REAL_ESTATE_INVESTMENT_ADDRESS, REAL_ESTATE_ABI, provider);

      // Get current block number
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - BLOCK_LOOKBACK);

      logger.log(`Checking events from block ${fromBlock} to ${currentBlock}`);
      logger.log(`Contract address: ${REAL_ESTATE_INVESTMENT_ADDRESS}`);

      // Fetch all events
      const allEvents: any[] = [];

      // Get PropertyAnalyzed events
      try {
        const propertyAnalyzedFilter = contract.filters.PropertyAnalyzed();
        const propertyAnalyzedEvents = await contract.queryFilter(propertyAnalyzedFilter, fromBlock, currentBlock);

        for (const event of propertyAnalyzedEvents) {
          // Type guard to ensure we have EventLog with args
          if ('args' in event && event.args) {
            const decoded = {
              type: 'PropertyAnalyzed',
              blockNumber: event.blockNumber,
              transactionHash: event.transactionHash,
              caller: event.args[0],
              nonce: event.args[1]?.toString(),
              id: event.args[2],
              propertyAddress: event.args[3],
              totalValue: event.args[4]?.toString(),
              investmentGrade: event.args[5],
              expectedYield: event.args[6]?.toString(),
              confidence: event.args[7]?.toString(),
              recommendation: event.args[8]
            };
            allEvents.push(decoded);
            logger.debug('PropertyAnalyzed Event:', decoded);
          }
        }
      } catch (err) {
        logger.debug('No PropertyAnalyzed events found or error:', err);
      }

      // Get TokensPurchased events
      try {
        const tokensPurchasedFilter = contract.filters.TokensPurchased();
        const tokensPurchasedEvents = await contract.queryFilter(tokensPurchasedFilter, fromBlock, currentBlock);

        for (const event of tokensPurchasedEvents) {
          // Type guard to ensure we have EventLog with args
          if ('args' in event && event.args) {
            const decoded = {
              type: 'TokensPurchased',
              blockNumber: event.blockNumber,
              transactionHash: event.transactionHash,
              caller: event.args[0],
              nonce: event.args[1]?.toString(),
              id: event.args[2],
              investor: event.args[3],
              tokenAmount: event.args[4]?.toString(),
              usdcAmount: event.args[5]?.toString(),
              ownershipPercentage: event.args[6]?.toString(),
              timestamp: event.args[7]?.toString()
            };
            allEvents.push(decoded);
            logger.debug('TokensPurchased Event:', decoded);
          }
        }
      } catch (err) {
        logger.debug('No TokensPurchased events found or error:', err);
      }

      // Get InvestmentOpened events
      try {
        const investmentOpenedFilter = contract.filters.InvestmentOpened();
        const investmentOpenedEvents = await contract.queryFilter(investmentOpenedFilter, fromBlock, currentBlock);

        for (const event of investmentOpenedEvents) {
          // Type guard to ensure we have EventLog with args
          if ('args' in event && event.args) {
            const decoded = {
              type: 'InvestmentOpened',
              blockNumber: event.blockNumber,
              transactionHash: event.transactionHash,
              caller: event.args[0],
              nonce: event.args[1]?.toString(),
              id: event.args[2],
              propertyAddress: event.args[3],
              totalValue: event.args[4]?.toString(),
              totalTokenSupply: event.args[5]?.toString(),
              pricePerToken: event.args[6]?.toString()
            };
            allEvents.push(decoded);
            logger.debug('InvestmentOpened Event:', decoded);
          }
        }
      } catch (err) {
        logger.debug('No InvestmentOpened events found or error:', err);
      }

      // Sort events by block number
      allEvents.sort((a, b) => (a.blockNumber || 0) - (b.blockNumber || 0));

      logger.log(`Total events found: ${allEvents.length}`);
      logger.debug('All events:', allEvents);

      setEvents(allEvents);
      onEventsFound?.(allEvents);

      if (allEvents.length === 0) {
        logger.log('No events found. The contract might be newly deployed or no transactions have been made yet.');
      }

    } catch (error) {
      logger.error('Error checking events:', error);
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={checkEvents}
        disabled={isLoading}
        variant="outline"
        className="w-full flex items-center justify-center"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Checking Events...
          </>
        ) : (
          <>
            <Search className="mr-2 h-4 w-4" />
            Check Events
          </>
        )}
      </Button>

      {events.length > 0 && (
        <div className="text-sm text-green-600 text-center">
          Found {events.length} event(s) - Check console for details
        </div>
      )}
    </div>
  );
}

export default CheckEventsButton;