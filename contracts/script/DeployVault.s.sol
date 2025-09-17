// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import "../src/Vault.sol";

contract DeployVault is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address owner = vm.envOr("OWNER", vm.addr(deployerPrivateKey));
        uint256 nodeFee = 0.000001 ether;
        uint256 protocolFee = 0.000002 ether;

        vm.startBroadcast(deployerPrivateKey);

        Vault vault = new Vault(owner, nodeFee, protocolFee);

        vm.stopBroadcast();

        console.log("Vault deployed at:", address(vault));
        console.log("  Owner:", owner);
        console.log("  Node Fee:", nodeFee / 1e18, "ETH");
        console.log("  Protocol Fee:", protocolFee / 1e18, "ETH");
    }
}