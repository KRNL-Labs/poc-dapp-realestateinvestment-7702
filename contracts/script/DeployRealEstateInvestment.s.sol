// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import "../src/RealEstateInvestment.sol";

contract DeployRealEstateInvestment is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address authKey = vm.envAddress("AUTH_KEY");
        address recoveryKey = vm.envAddress("RECOVERY_KEY");
        address owner = vm.envOr("OWNER", vm.addr(deployerPrivateKey));
        address delegatedAccountImpl = vm.envAddress("DELEGATED_ACCOUNT_IMPL");
        address usdcToken = vm.envAddress("USDC_TOKEN");
        string memory propertyAddress = string("PROPERTY_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        RealEstateInvestment vault = new RealEstateInvestment(
            authKey,
            recoveryKey,
            owner,
            delegatedAccountImpl,
            usdcToken,
            propertyAddress
        );

        vm.stopBroadcast();

        console.log("  Vault deployed at:", address(vault));
        console.log("  Owner:", owner);
        console.log("  Auth Key:", authKey);
        console.log("  Recovery Key:", recoveryKey);
        console.log("  Delegated Account Impl:", delegatedAccountImpl);
        console.log("  USDC Token:", usdcToken);
        console.log("  Property Address:", propertyAddress);
    }
}