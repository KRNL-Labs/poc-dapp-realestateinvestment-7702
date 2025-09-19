// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;
import "forge-std/Script.sol";

interface IVault {
    function owner() external view returns (address);
    function NODE_FEE() external view returns (uint256);
    function PROTOCOL_FEE() external view returns (uint256);
    function depositFees(
        address nodeAddress,
        address targetContract,
        address targetOwner
    ) external payable;
}