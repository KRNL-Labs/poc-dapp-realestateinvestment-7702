// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "./Simple7702AccountV07.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./ITargetBase.sol";
import "./IVault.sol";

/// @title Delegated7702Account - EIP-7702 + ERC-4337 account with delegation
contract Delegated7702AccountV2 is Simple7702AccountV07 {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // Structures
    struct TransactionIntent {
        address target;
        uint256 value;
        bytes32 id;
        address nodeAddress;
        address delegate;
        bytes4 targetFunction;
        uint256 nonce;
        uint256 deadline;
    }

    // State
    address public constant VaultAddress = 0x5b3d977acBB96C66D3AE050dDF34A68bfd5027b5;

    // Events
    event DelegateUsed(address indexed delegate, bytes32 userOpHash);
    event FeeTransferred(address indexed recipient, uint256 amount);
    event TransactionIntentExecuted(bytes32 indexed intentId, address indexed executor);

    // Errors
    error OnlyEntryPointAllowed();
    error InvalidSignature();
    error IntentExpired(uint256 deadline);
    error OnlyOwnerFunction();
    error InvalidNonce();

    constructor(IEntryPoint _entryPoint) Simple7702AccountV07(_entryPoint) {}

    /// @notice Execute transaction with intent signature
    function execute(
        TransactionIntent calldata intent,
        bytes calldata func,
        bytes calldata signature
    ) external {
        if (msg.sender != address(entryPoint())) {
            revert OnlyEntryPointAllowed();
        }

        // Check deadline
        if (block.timestamp > intent.deadline) {
            revert IntentExpired(intent.deadline);
        }

        // Verify function selector matches intent
        require(func.length >= 4, "Invalid function data");
        bytes4 funcSelector = bytes4(func[0:4]);
        require(funcSelector == intent.targetFunction, "Function selector mismatch");

        // Check nonce if target supports it
        if (_implementsTargetBase(intent.target)) {
            try ITargetBase(intent.target).nonces(address(this)) returns (uint256 expectedNonce) {
                if (intent.nonce != expectedNonce) {
                    revert InvalidNonce();
                }
            } catch {
                // Skip on failure
            }
        }

        // Check signature
        (bool isValid, ) = _validateIntentSignature(intent, signature);
        if (!isValid) {
            revert InvalidSignature();
        }

        // Check balance
        uint256 totalFee = _getTotalFees();
        require(address(this).balance >= intent.value + totalFee, "Insufficient balance");

        _call(intent.target, intent.value, func);

        // Collect fees
        _collectFee(intent.nodeAddress, intent.target);

        emit TransactionIntentExecuted(intent.id, msg.sender);
    }

    // Internal functions

    function _validateSignature(PackedUserOperation calldata userOp, bytes32 userOpHash)
        internal
        override
        returns (uint256 validationData)
    {
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        address recoveredSigner = hash.recover(userOp.signature);

        // Decode the calldata to extract the delegate from TransactionIntent
        if (userOp.callData.length >= 4) {
            // Decode the execute function parameters
            (TransactionIntent memory intent, , ) = abi.decode(
                userOp.callData[4:],
                (TransactionIntent, bytes, bytes)
            );

            // Validate against the delegate specified in the intent
            if (intent.delegate != address(0) && recoveredSigner == intent.delegate) {
                emit DelegateUsed(intent.delegate, userOpHash);
                return SIG_VALIDATION_SUCCESS;
            }
        }

        // Fallback: Check owner
        if (owner != address(0) && recoveredSigner == owner) {
            return SIG_VALIDATION_SUCCESS;
        }

        // Check EOA address (when owner is not set)
        if (owner == address(0) && recoveredSigner == address(this)) {
            return SIG_VALIDATION_SUCCESS;
        }

        return SIG_VALIDATION_FAILED;
    }

    // Check ITargetBase support
    function _implementsTargetBase(address target) internal view returns (bool) {
        try ITargetBase(target).nonces(address(0)) returns (uint256) {
            return true;
        } catch {
            return false;
        }
    }

    // Get fees from vault
    function _getTotalFees() internal view returns (uint256) {
        IVault vault = IVault(VaultAddress);
        return vault.NODE_FEE() + vault.PROTOCOL_FEE();
    }

    // Send fees to vault
    function _collectFee(address nodeAddress, address targetContract) internal {
        uint256 totalFee = _getTotalFees();
        require(address(this).balance >= totalFee, "Insufficient fees");

        IVault vault = IVault(VaultAddress);
        vault.depositFees{value: totalFee}(nodeAddress, targetContract, address(this));

        emit FeeTransferred(VaultAddress, totalFee);
    }

    // View functions

    // Validate intent signature
    function _validateIntentSignature(
        TransactionIntent calldata intent,
        bytes calldata signature
    ) internal view returns (bool isValid, address signer) {
        bytes32 intentHash = keccak256(
            abi.encodePacked(
                intent.target,
                intent.value,
                intent.id,
                intent.nodeAddress,
                intent.delegate,
                intent.targetFunction,
                intent.nonce,
                intent.deadline
            )
        );

        bytes32 ethSignedHash = intentHash.toEthSignedMessageHash();
        signer = ethSignedHash.recover(signature);
        isValid = (signer == address(this));

        return (isValid, signer);
    }

    /// @notice Validate signature externally
    function validateIntentSignature(
        TransactionIntent calldata intent,
        bytes calldata signature
    ) external view returns (bool isValid, address signer) {
        return _validateIntentSignature(intent, signature);
    }
}