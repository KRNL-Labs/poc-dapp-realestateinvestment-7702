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
        uint256 nonce;
        uint256 deadline;
    }

    // State
    address public delegate;
    address public immutable VaultAddress;

    // Events
    event DelegateUsed(address indexed delegate, bytes32 userOpHash);
    event FeeTransferred(address indexed recipient, uint256 amount);
    event DelegateUpdated(address indexed oldDelegate, address indexed newDelegate);
    event TransactionIntentExecuted(bytes32 indexed intentId, address indexed executor);

    // Errors
    error OnlyEntryPointAllowed();
    error InvalidSignature();
    error IntentExpired(uint256 deadline);
    error OnlyOwnerFunction();
    error InvalidNonce();

    constructor(IEntryPoint _entryPoint, address _vaultAddress) Simple7702AccountV07(_entryPoint) {
        require(_vaultAddress != address(0), "Invalid vault");
        VaultAddress = _vaultAddress;
    }

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

    /// @notice Update delegate address
    function updateDelegate(address _newDelegate) external {
        if (msg.sender != address(this)) {
            revert OnlyOwnerFunction();
        }

        address oldDelegate = delegate;
        require(_newDelegate != oldDelegate, "Same delegate");

        delegate = _newDelegate;
        emit DelegateUpdated(oldDelegate, _newDelegate);
    }

    /// @notice Revoke delegate
    function revokeDelegate() external {
        if (msg.sender != address(this)) {
            revert OnlyOwnerFunction();
        }

        address oldDelegate = delegate;
        delegate = address(0);
        emit DelegateUpdated(oldDelegate, address(0));
    }

    // Internal functions

    function _validateSignature(PackedUserOperation calldata userOp, bytes32 userOpHash)
        internal
        override
        returns (uint256 validationData)
    {
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        address recoveredSigner = hash.recover(userOp.signature);

        // Check delegate first
        if (delegate != address(0)) {
            if (recoveredSigner == delegate) {
                emit DelegateUsed(delegate, userOpHash);
                return SIG_VALIDATION_SUCCESS;
            }
            return SIG_VALIDATION_FAILED;
        }

        // Check owner
        if (owner != address(0) && recoveredSigner == owner) {
            return SIG_VALIDATION_SUCCESS;
        }

        // Check EOA address
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