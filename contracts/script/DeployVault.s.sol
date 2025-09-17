// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import "../src/Vault.sol";

contract DeployVault is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address vaultAddress = vm.envOr("OWNER", address(0));
        uint256 nodeFee = vm.envUint("NODE_FEE");
        uint256 protocolFee = vm.envUint("PROTOCOL_FEE");    

        vm.startBroadcast(deployerPrivateKey);

        Vault vault = new Vault(vaultAddress, nodeFee, protocolFee);

        vm.stopBroadcast();

        console.log("VaultAddress:", address(vault));
    }
}