// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import "../src/MockUSDC.sol";

contract DeployMockUSDCScript is Script {
    function run() external returns (MockUSDC) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Optional: mint additional tokens to a recipient
        address recipientAddress = vm.envOr("RECIPIENT_ADDRESS", address(0));
        uint256 mintAmount = vm.envOr("MINT_AMOUNT", uint256(100000 * 10 ** 6)); // Default 100k USDC

        vm.startBroadcast(deployerPrivateKey);

        MockUSDC mockUSDC = new MockUSDC();

        // Mint additional tokens if recipient is specified
        if (recipientAddress != address(0) && recipientAddress != vm.addr(deployerPrivateKey)) {
            mockUSDC.mint(recipientAddress, mintAmount);
            console.log("Minted", mintAmount / 10 ** 6, "USDC to:", recipientAddress);
        }

        vm.stopBroadcast();

        console.log("=====================================");
        console.log("MockUSDC deployed at:", address(mockUSDC));
        console.log("Deployer address:", vm.addr(deployerPrivateKey));
        console.log("Deployer balance:", mockUSDC.balanceOf(vm.addr(deployerPrivateKey)) / 10 ** 6, "USDC");
        if (recipientAddress != address(0)) {
            console.log("Recipient balance:", mockUSDC.balanceOf(recipientAddress) / 10 ** 6, "USDC");
        }
        console.log("=====================================");

        return mockUSDC;
    }
}