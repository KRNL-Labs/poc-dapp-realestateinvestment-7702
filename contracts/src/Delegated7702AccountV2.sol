// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "./Simple7702AccountV07.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./TargetBase.sol";

/**
 * @title Delegated7702Account
 * @notice EIP-7702 + ERC-4337 smart account with delegate authorization and ETH fee collection
 * @dev Extends Simple7702AccountV07 with delegate signature validation and fee management
 */
contract Delegated7702AccountV2 is Simple7702AccountV07 {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ============ Fee Structures ============


    /**
     * @notice Simplified fee breakdown structure
     * @param protocolFee Base protocol operational fee
     * @param executionFee Execution-specific fee
     */
    struct FeeBreakdown {
        uint256 protocolFee; // Base protocol fee
        uint256 executionFee; // Execution fee
    }

    // ============ Configuration Structures ============

    /**
     * @notice Transaction intent structure for batch operations
     * @param destinations Target contracts (single or multiple)
     * @param values ETH values to send (single or multiple)
     * @param nonce Prevent replay attacks
     * @param deadline Expiry timestamp
     * @param id Unique identifier for intent-AuthData linking
     */
    struct TransactionIntent {
        address[] destinations;    // Target contracts (single or multiple)
        uint256[] values;          // ETH values to send (single or multiple)
        uint256 nonce;            // Prevent replay attacks
        uint256 deadline;         // Expiry timestamp
        bytes32 id;               // Unique identifier for intent-AuthData linking
    }


    // ============ State Variables ============

    address public delegate;
    address public immutable VaultAddress;
    uint256 public constant PROTOCOL_FEE = 0.001 ether; // Fixed protocol fee
    uint256 public minRequiredFee;
    uint256 public maxFeePerTransaction;
    uint256 public hardFeeCap;
    uint256 public currentNonce; // Current active nonce - all previous nonces are invalid

    // ============ Events ============

    event DelegateUsed(address indexed delegate, bytes32 userOpHash);
    event FeeTransferred(address indexed recipient, uint256 amount);
    event FeeSponsoredByMasterKey(address indexed feeRecipient, uint256 feeAmount);

    /**
     * @notice Emitted when fees are calculated with detailed breakdown
     * @param sender Address that initiated the transaction
     * @param destination Target contract address
     * @param feeBreakdown Detailed breakdown of all fees
     */
    event FeeCalculated(address indexed sender, address indexed destination, FeeBreakdown feeBreakdown);

    /**
     * @notice Emitted when execution fees are sponsored by master key
     * @param sender Address that initiated the transaction
     * @param destination Target contract address
     * @param sponsoredFees Detailed breakdown of sponsored fees
     */
    event FeeSponsored(address indexed sender, address indexed destination, FeeBreakdown sponsoredFees);

    event MinFeeUpdated(uint256 minFee, address indexed updatedBy);
    event MaxFeeUpdated(uint256 maxFee, address indexed updatedBy);
    event DelegateUpdated(address indexed oldDelegate, address indexed newDelegate);
    event TransactionIntentExecuted(bytes32 indexed intentId, uint256 nonce, address indexed executor);

    // ============ Custom Errors ============

    error OnlyEntryPointAllowed();
    error InvalidSignature();
    error InvalidNonce();
    error IntentExpired(uint256 deadline);
    error ArrayLengthMismatch();
    error FeeTooLow(uint256 provided, uint256 required);
    error FeeTooHigh(uint256 provided, uint256 maximum);
    error OnlyOwnerFunction();
    error OnlyDelegateFunction();
    error MinFeeExceedsMaxFee(uint256 minFee, uint256 maxFee);
    error MaxFeeExceedsHardCap(uint256 maxFee, uint256 hardCap);
    error MaxFeeBelowMinFee(uint256 maxFee, uint256 minFee);
    error HardCapTooLow(uint256 hardCap);

    // ============ Constructor ============

    /**
     * @notice Initialize with EntryPoint and service-level fee recipient
     * @param _entryPoint EntryPoint contract address
     * @param _feeRecipient Address to receive ETH fees
     */
    constructor(IEntryPoint _entryPoint, address _feeRecipient) Simple7702AccountV07(_entryPoint) {
        require(_feeRecipient != address(0), "Fee recipient cannot be zero address");
        VaultAddress = _feeRecipient;
    }

    // ============ Initialization ============



    // ============ Execution Functions ============

    /**
     * @notice Execute transaction with owner signature verification
     * @param intent Transaction intent containing destinations, values, nonce, deadline, and id
     * @param func Function call data to execute (for single destination)
     * @param signature Owner's signature of the transaction intent
     */
    function execute(
        TransactionIntent calldata intent,
        bytes calldata func,
        bytes calldata signature
    ) external {
        if (msg.sender != address(entryPoint())) {
            revert OnlyEntryPointAllowed();
        }

        // Verify deadline
        if (block.timestamp > intent.deadline) {
            revert IntentExpired(intent.deadline);
        }

        // Check nonce for replay protection
        if (intent.nonce != currentNonce) {
            revert InvalidNonce();
        }

        // Verify array lengths
        if (intent.destinations.length != intent.values.length || intent.destinations.length == 0) {
            revert ArrayLengthMismatch();
        }

        // Create hash of the transaction intent
        bytes32 intentHash = keccak256(
            abi.encodePacked(
                intent.destinations,
                intent.values,
                intent.nonce,
                intent.deadline,
                intent.id
            )
        );

        // Verify signature from owner (address(this))
        bytes32 ethSignedHash = intentHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(signature);

        require(signer == address(this), "Invalid signature");

        // Increment nonce
        currentNonce++;

        // For single destination execution
        require(intent.destinations.length == 1, "Use executeBatch for multiple destinations");

        address dest = intent.destinations[0];
        uint256 value = intent.values[0];

        // Check balance for transaction value and protocol fee
        require(address(this).balance >= value + PROTOCOL_FEE, "Insufficient ETH balance");

        _call(dest, value, func);

        // Collect protocol fee after successful execution
        _collectProtocolFee();

        emit TransactionIntentExecuted(intent.id, intent.nonce, msg.sender);
    }

    /**
     * @notice Execute multiple transactions in batch with owner signature verification
     * @param intent Transaction intent containing destinations, values, nonce, deadline, and id
     * @param funcs Array of function call data for each destination
     * @param signature Owner's signature of the transaction intent
     */
    function executeBatch(
        TransactionIntent calldata intent,
        bytes[] calldata funcs,
        bytes calldata signature
    ) external {
        if (msg.sender != address(entryPoint())) {
            revert OnlyEntryPointAllowed();
        }

        // Verify deadline
        if (block.timestamp > intent.deadline) {
            revert IntentExpired(intent.deadline);
        }

        // Check nonce for replay protection
        if (intent.nonce != currentNonce) {
            revert InvalidNonce();
        }

        // Verify array lengths
        if (intent.destinations.length != intent.values.length ||
            intent.destinations.length != funcs.length ||
            intent.destinations.length == 0) {
            revert ArrayLengthMismatch();
        }

        // Create hash of the transaction intent
        bytes32 intentHash = keccak256(
            abi.encodePacked(
                intent.destinations,
                intent.values,
                intent.nonce,
                intent.deadline,
                intent.id
            )
        );

        // Verify signature from owner (address(this))
        // personal_sign already adds the prefix, so we need toEthSignedMessageHash
        bytes32 ethSignedHash = intentHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(signature);

        if (signer != address(this)) {
            revert InvalidSignature();
        }

        // Increment nonce
        currentNonce++;

        // Calculate total value needed
        uint256 totalValue = 0;
        for (uint256 i = 0; i < intent.values.length; i++) {
            totalValue += intent.values[i];
        }

        require(address(this).balance >= totalValue + PROTOCOL_FEE, "Insufficient ETH balance");

        // Execute all transactions
        for (uint256 i = 0; i < intent.destinations.length; i++) {
            _call(intent.destinations[i], intent.values[i], funcs[i]);
        }

        // Collect protocol fee after successful execution
        _collectProtocolFee();

        emit TransactionIntentExecuted(intent.id, intent.nonce, msg.sender);
    }


    // ============ Signature Validation ============
    function _validateSignature(PackedUserOperation calldata userOp, bytes32 userOpHash)
        internal
        override
        returns (uint256 validationData)
    {
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        address recoveredSigner = hash.recover(userOp.signature);

        // If delegate is set, validate against delegate only
        if (delegate != address(0)) {
            if (recoveredSigner == delegate) {
                emit DelegateUsed(delegate, userOpHash);
                return SIG_VALIDATION_SUCCESS;
            }
            return SIG_VALIDATION_FAILED;
        }

        // Fallback to owner validation if no delegate set
        if (owner != address(0) && recoveredSigner == owner) {
            return SIG_VALIDATION_SUCCESS;
        }

        // If owner not set either, validate against account address (EOA after EIP-7702)
        if (owner == address(0) && recoveredSigner == address(this)) {
            return SIG_VALIDATION_SUCCESS;
        }

        return SIG_VALIDATION_FAILED;
    }

    // ============ Configuration Functions ============

    /**
     * @notice Update maximum fee per transaction
     * @param _maxFee New maximum fee amount
     */
    function updateMaxFee(uint256 _maxFee) external {
        if (msg.sender != delegate) {
            revert OnlyDelegateFunction();
        }

        if (_maxFee > hardFeeCap) {
            revert MaxFeeExceedsHardCap(_maxFee, hardFeeCap);
        }

        if (_maxFee < minRequiredFee) {
            revert MaxFeeBelowMinFee(_maxFee, minRequiredFee);
        }

        maxFeePerTransaction = _maxFee;

        emit MaxFeeUpdated(_maxFee, msg.sender);
    }

    /**
     * @notice Update hard fee cap
     * @param _hardCap New hard fee cap amount
     */
    function updateHardFeeCap(uint256 _hardCap) external {
        if (msg.sender != owner) {
            revert OnlyOwnerFunction();
        }

        require(_hardCap > 0, "Hard cap must be greater than zero");

        hardFeeCap = _hardCap;

        if (maxFeePerTransaction > _hardCap) {
            maxFeePerTransaction = _hardCap;
            emit MaxFeeUpdated(_hardCap, msg.sender);

            if (minRequiredFee > _hardCap) {
                minRequiredFee = _hardCap;
                emit MinFeeUpdated(_hardCap, msg.sender);
            }
        }
    }

    /**
     * @notice Update minimum required fee
     * @param _minFee New minimum fee amount
     */
    function updateMinFee(uint256 _minFee) external {
        if (msg.sender != delegate) {
            revert OnlyDelegateFunction();
        }

        if (_minFee > maxFeePerTransaction) {
            revert MinFeeExceedsMaxFee(_minFee, maxFeePerTransaction);
        }

        minRequiredFee = _minFee;

        emit MinFeeUpdated(_minFee, msg.sender);
    }



    /**
     * @notice Update delegate
     * @param _newDelegate New delegate address
     */
    function updateDelegate(address _newDelegate) external {
        if (msg.sender != address(this)) {
            revert OnlyOwnerFunction();
        }

        address oldDelegate = delegate;
        require(_newDelegate != oldDelegate, "New delegate must differ from current delegate");

        delegate = _newDelegate;

        emit DelegateUpdated(oldDelegate, _newDelegate);
    }


    /**
     * @notice Revoke the current delegate
     */
    function revokeDelegate() external {
        if (msg.sender != address(this)) {
            revert OnlyOwnerFunction();
        }

        address oldDelegate = delegate;
        delegate = address(0);

        emit DelegateUpdated(oldDelegate, address(0));
    }

    // ============ Internal Functions ============

    /**
     * @notice Collect fixed protocol fee after successful execution
     * @dev This is atomic with the main execution - if this fails, entire transaction reverts
     */
    function _collectProtocolFee() internal {
        require(address(this).balance >= PROTOCOL_FEE, "Insufficient balance for protocol fee");

        // Transfer protocol fee to vault
        (bool success, ) = VaultAddress.call{value: PROTOCOL_FEE}("");
        require(success, "Protocol fee transfer failed");

        emit FeeTransferred(VaultAddress, PROTOCOL_FEE);
    }

    /**
     * @notice Calculate simplified fee breakdown
     * @param totalFeeWei Total fee amount in wei to distribute
     * @return breakdown Simplified breakdown of fees
     */
    function _calculateFeeBreakdown(bytes calldata, uint256 totalFeeWei)
        internal
        pure
        returns (FeeBreakdown memory breakdown)
    {
        // Base protocol fee (30% of total)
        breakdown.protocolFee = (totalFeeWei * 30) / 100;

        // Execution fee (70% of total)
        breakdown.executionFee = (totalFeeWei * 70) / 100;

        return breakdown;
    }


    /**
     * @notice Check if master key is sponsoring execution fee for this transaction
     * @param func Encoded function call data
     * @return sponsored Whether execution fee is sponsored by master key
     */
    function _checkExecutionFeeSponsorship(
        address,
        /* dest */
        bytes calldata func
    ) internal view returns (bool sponsored) {
        // Only check for known target contracts that use AuthData
        if (func.length < 4) return false;

        bytes4 selector = bytes4(func[:4]);

        // Check RealEstateInvestment.submitPropertyAnalysis(AuthData)
        if (selector == 0x832d7e69) {
            // submitPropertyAnalysis selector
            try this._decodeSubmitPropertyAnalysis(func[4:]) returns (bool sponsorship) {
                return sponsorship;
            } catch {
                return false;
            }
        }

        // Check RealEstateInvestment.purchaseTokens(AuthData, uint256)
        if (selector == 0x6f84329f) {
            // purchaseTokens selector
            try this._decodePurchaseTokens(func[4:]) returns (bool sponsorship) {
                return sponsorship;
            } catch {
                return false;
            }
        }

        return false;
    }

    /**
     * @notice Helper to decode submitPropertyAnalysis parameters
     * @param data Encoded parameters after function selector
     * @return sponsorship Whether execution fee is sponsored
     */
    function _decodeSubmitPropertyAnalysis(bytes calldata data) external pure returns (bool sponsorship) {
        // Decode AuthData parameter
        TargetBase.AuthData memory authData = abi.decode(data, (TargetBase.AuthData));
        return authData.sponsorExecutionFee;
    }

    /**
     * @notice Helper to decode purchaseTokens parameters
     * @param data Encoded parameters after function selector
     * @return sponsorship Whether execution fee is sponsored
     */
    function _decodePurchaseTokens(bytes calldata data) external pure returns (bool sponsorship) {
        // Decode AuthData and uint256 parameters
        (TargetBase.AuthData memory authData,) = abi.decode(data, (TargetBase.AuthData, uint256));
        return authData.sponsorExecutionFee;
    }

    // ============ View Functions ============

    /**
     * @notice Validate a transaction intent signature without executing
     * @param intent Transaction intent to validate
     * @param signature Signature to verify
     * @return isValid Whether the signature is valid
     * @return signer The recovered signer address
     */
    function validateIntentSignature(
        TransactionIntent calldata intent,
        bytes calldata signature
    ) external view returns (bool isValid, address signer) {
        // Create hash of the transaction intent
        bytes32 intentHash = keccak256(
            abi.encodePacked(
                intent.destinations,
                intent.values,
                intent.nonce,
                intent.deadline,
                intent.id
            )
        );

        // Recover signer from signature
        bytes32 ethSignedHash = intentHash.toEthSignedMessageHash();
        signer = ethSignedHash.recover(signature);

        // Check if signer is valid (should be address(this))
        isValid = (signer == address(this));

        return (isValid, signer);
    }

    /**
     * @notice Get current fee parameters
     * @return minFee Minimum required fee
     * @return maxFee Maximum fee per transaction
     * @return hardCap Hard fee cap limit
     */
    function getFeeParameters() external view returns (uint256 minFee, uint256 maxFee, uint256 hardCap) {
        return (minRequiredFee, maxFeePerTransaction, hardFeeCap);
    }

    /**
     * @notice Get the current nonce that should be used for the next transaction
     * @return nonce The current nonce value
     */
    function getCurrentNonce() external view returns (uint256 nonce) {
        return currentNonce;
    }

}
