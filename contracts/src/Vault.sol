// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title Vault
 * @notice Vault for fee collection
 */
contract Vault {
    event FeeCollected(address indexed sender, address indexed nodeAddress, address targetContract, address targetOwner, uint256 nodeFee, uint256 protocolFee);

    address public owner;

    uint256 public protocolFees;

    mapping(address => uint256) public NODE_FEE;
    uint256 public defaultNodeFee = 0.001 ether;
    uint256 public PROTOCOL_FEE = 0.001 ether;

    mapping(address => uint256) public nodeFees;

    constructor(address _owner, uint256 _nodeFee, uint256 _protocolFee ) {
        if (_owner == address(0))
        {
            owner = msg.sender;
        } else {
            owner = _owner;
        }

        if (_nodeFee > 0) {
            defaultNodeFee = _nodeFee;
        }
        
        if (_protocolFee > 0) {
            PROTOCOL_FEE = _protocolFee;
        }
    }

    function setNodeFee(address node, uint256 fee) external {
        require(msg.sender == owner, "Only owner can set node fee");
        NODE_FEE[node] = fee;
    }

    function setDefaultNodeFee(uint256 fee) external {
        require(msg.sender == owner, "Only owner can set default node fee");
        defaultNodeFee = fee;
    }

    function getNodeFee(address node) public view returns (uint256) {
        uint256 fee = NODE_FEE[node];
        if (fee == 0) {
            return defaultNodeFee;
        }
        return fee;
    }

    function depositFees(
        address nodeAddress,
        address targetContract,
        address targetOwner
    ) external payable {
        uint256 nodeFeeAmount = getNodeFee(nodeAddress);
        require(nodeFeeAmount + PROTOCOL_FEE == msg.value, "Invalid fee deposition");
        nodeFees[nodeAddress] += nodeFeeAmount;
        protocolFees += PROTOCOL_FEE;
        emit FeeCollected(msg.sender, nodeAddress, targetContract, targetOwner, nodeFeeAmount, PROTOCOL_FEE);
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

    /// @notice Allows the owner to update the protocol fee
    function updateProtocolFee(uint256 _protocolFee) external {
        require(msg.sender == owner, "Only owner can update protocol fee");
        PROTOCOL_FEE = _protocolFee;
    }

    receive() external payable {

    }
}