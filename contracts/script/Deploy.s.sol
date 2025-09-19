// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import "../src/MockUSDC.sol";
import "../src/RealEstateInvestment.sol";

contract DeployRealEstateScript is Script {
    function run() external {
        // Get private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Get delegated account address from env - REQUIRED
        address delegatedAccountImpl = vm.envAddress("DELEGATED_ACCOUNT_ADDRESS");
        address mockUSDC = vm.envAddress("MOCK_USDC_ADDRESS");
        require(delegatedAccountImpl != address(0), "DELEGATED_ACCOUNT_ADDRESS must be set");
        
        // Get property address from env (with default)
        string memory propertyAddress;
        try vm.envString("PROPERTY_ADDRESS") returns (string memory addr) {
            propertyAddress = addr;
        } catch {
            propertyAddress = "123 Main Street, San Francisco, CA 94105";
        }
        
        console.log("=== Deploying RealEstate Investment Platform ===");
        console.log("Deployer:", deployer);
        console.log("Delegated Account Impl:", delegatedAccountImpl);
        console.log("Property Address:", propertyAddress);
        
        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy MockUSDC first
        // MockUSDC mockUSDC = new MockUSDC();
        // console.log("MockUSDC deployed at:", address(mockUSDC));
        
        // Deploy RealEstateInvestment
        // Using deployer as auth key, recovery key, and owner for simplicity
        // In production, these should be separate secure addresses
        RealEstateInvestment realEstateInvestment = new RealEstateInvestment(
            deployer,                    // _authKey (master key for signing authorizations)
            deployer,                    // _recoveryKey (can update master key in emergency)
            deployer,                    // _owner (contract admin)
            delegatedAccountImpl,        // _delegatedAccountImpl (deployed Delegated7702Account)
            address(mockUSDC),          // _usdcToken
            propertyAddress             // _propertyAddress
        );
        console.log("RealEstateInvestment deployed at:", address(realEstateInvestment));
        
        // Stop broadcasting
        vm.stopBroadcast();
        
        // Log deployment summary
        console.log("\n=== Deployment Summary ===");
        console.log("Network: Sepolia");
        console.log("Deployer:", deployer);
        console.log("MockUSDC:", address(mockUSDC));
        console.log("RealEstateInvestment:", address(realEstateInvestment));
        console.log("Delegated Account:", delegatedAccountImpl);
        console.log("Property:", propertyAddress);
        console.log("========================\n");
        
        // Log instructions for updating .env files
        console.log("Add these to your frontend/.env file:");
        console.log(string.concat("VITE_MOCK_USDC_ADDRESS=", vm.toString(address(mockUSDC))));
        console.log(string.concat("VITE_REAL_ESTATE_INVESTMENT_ADDRESS=", vm.toString(address(realEstateInvestment))));
        
        console.log("\nDeployment complete! Remember to:");
        console.log("1. Update frontend .env with the addresses above");
        console.log("2. Verify contracts on block explorer");
        console.log("3. Test initialization and basic functions");
    }
}