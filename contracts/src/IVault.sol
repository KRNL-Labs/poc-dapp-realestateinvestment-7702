// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;
import "forge-std/Script.sol";

interface IVault {
    function owner() external view returns (address);
    function depositFees(
        address nodeAddress,
        address targetContract,
        address targetOwner
    ) external payable;
}