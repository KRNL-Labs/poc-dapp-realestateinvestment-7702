// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title Vault
 * @notice Vault for fee collection
 */
contract Vault {
    // Event for fee deposits
    event FeeCollected(address indexed sender, address indexed nodeAddress, address targetContract, address targetOwner, uint256 nodeFee, uint256 protocolFee);

    address public owner;

    uint256 public protocolFees;

    uint256 public NODE_FEE = 0.001 ether;
    uint256 public PROTOCOL_FEE = 0.001 ether;

    // Mappings for tracking node fees
    mapping(address => uint256) public nodeFees;

    constructor(address _owner, uint256 _nodeFee, uint256 _protocolFee ) {
        if (_owner == address(0))
        {
            owner = msg.sender;
        }
        if (_nodeFee > 0) {
            NODE_FEE = _nodeFee;
        }
        if (_protocolFee > 0) {
            PROTOCOL_FEE = _protocolFee;
        }
        owner = _owner;
    }

    function depositFees(
        address nodeAddress,
        address targetContract,
        address targetOwner
    ) external payable {
        require(NODE_FEE + PROTOCOL_FEE == msg.value, "Invalid fee deposition");
        nodeFees[nodeAddress] += NODE_FEE;
        protocolFees += PROTOCOL_FEE;
        emit FeeCollected(msg.sender, nodeAddress, targetContract, targetOwner, NODE_FEE, PROTOCOL_FEE);
    }

    function withdraw(address recipient, uint256 value) external {
        require(msg.sender == owner, "Only owner can withdraw");
        require(address(this).balance >= value, "Insufficient balance");
        (bool success, ) = recipient.call{value: value, gas: 2300}("");
        require(success, "Withdraw failed");
    }

    function changeOwner(address newOwner) external {
        require(msg.sender == owner, "Only owner can change owner");
        require(newOwner != address(0), "New owner cannot be zero address");
        owner = newOwner;
    }

    receive() external payable {

    }
}