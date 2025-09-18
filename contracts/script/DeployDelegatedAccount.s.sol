// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import "../src/Delegated7702Account.sol";

contract DeployDelegatedAccountScript is Script {
    function run() external {
        // Get private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Get EntryPoint address (default to v0.7 EntryPoint on Sepolia)
        address entryPointAddress = vm.envOr("ENTRY_POINT_ADDRESS", 0x0000000071727De22E5E9d8BAf0edAc6f37da032);
        
        // Get fee recipient address (defaults to deployer)
        address feeRecipient = vm.envOr("FEE_RECIPIENT_ADDRESS", deployer);
        
        console.log("=== Deploying Delegated7702Account ===");
        console.log("Deployer:", deployer);
        console.log("EntryPoint:", entryPointAddress);
        console.log("Fee Recipient:", feeRecipient);
        
        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy Delegated7702Account
        Delegated7702Account delegatedAccount = new Delegated7702Account(
            IEntryPoint(entryPointAddress),
            feeRecipient
        );
        
        console.log("Delegated7702Account deployed at:", address(delegatedAccount));
        
        // Stop broadcasting
        vm.stopBroadcast();
        
        // Log deployment summary
        console.log("\n=== Deployment Summary ===");
        console.log("Network: Sepolia");
        console.log("Deployer:", deployer);
        console.log("EntryPoint:", entryPointAddress);
        console.log("Fee Recipient:", feeRecipient);
        console.log("Delegated7702Account:", address(delegatedAccount));
        console.log("========================\n");
        
        // Log instructions for updating .env
        console.log("Add this to your frontend/.env file:");
        console.log(string.concat("VITE_DELEGATED_ACCOUNT_ADDRESS=", vm.toString(address(delegatedAccount))));
        
        console.log("\nAdd this to contracts/.env for RealEstate deployment:");
        console.log(string.concat("DELEGATED_ACCOUNT_ADDRESS=", vm.toString(address(delegatedAccount))));
    }
}