// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import "../src/Delegated7702AccountV2.sol";

contract DeployDelegatedAccountV2Script is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address entryPointAddress = vm.envOr("ENTRY_POINT_ADDRESS", 0x0000000071727De22E5E9d8BAf0edAc6f37da032);

        vm.startBroadcast(deployerPrivateKey);

        Delegated7702AccountV2 delegatedAccount = new Delegated7702AccountV2(
            IEntryPoint(entryPointAddress)
        );

        vm.stopBroadcast();

        console.log("Delegated7702AccountV2 deployed at:", address(delegatedAccount));
        console.log("  EntryPoint:", entryPointAddress);
        console.log("  VaultAddress (constant):", delegatedAccount.VaultAddress());
    }
}