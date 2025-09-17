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

    uint256 public NODE_FEE;

    uint256 public PROTOCOL_FEE;

    // Mappings for tracking node fees
    mapping(address => uint256) public nodeFees;

    uint256 public protocolFees;

    constructor(address _owner, uint256 _nodeFee, uint256 _protocolFee ) {
        require(_owner != address(0), "invalid owner");

        require(_nodeFee > 0, "Invalid node fee");

        require(_protocolFee > 0, "Invalid protocol fee");

        owner = _owner;
        NODE_FEE = _nodeFee;
        PROTOCOL_FEE = _protocolFee;
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

    function withdrawNodeFee() external {
        uint256 amount = nodeFees[msg.sender];
        require(amount > 0, "No fees to withdraw");
        nodeFees[msg.sender] = 0;
        (bool sent, ) = msg.sender.call{value: amount, gas: 2300}("");
        require(sent, "Failed to send Ether");
    }

    /// @notice Allows the owner to update the node fee
    function updateNodeFee(uint256 _nodeFee) external {
        require(msg.sender == owner, "Only owner can update node fee");
        NODE_FEE = _nodeFee;
    }

    /// @notice Allows the owner to update the protocol fee
    function updateProtocolFee(uint256 _protocolFee) external {
        require(msg.sender == owner, "Only owner can update protocol fee");
        PROTOCOL_FEE = _protocolFee;
    }

    receive() external payable {

    }
}