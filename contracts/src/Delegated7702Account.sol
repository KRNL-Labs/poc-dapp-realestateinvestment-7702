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
contract Delegated7702Account is Simple7702AccountV07 {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ============ Fee Structures ============

    /**
     * @notice Execution-specific fee with unique identifier
     * @param id Unique identifier for the execution type (e.g., keccak256("property_analysis"))
     * @param fee Fee amount in wei for this specific execution
     */
    struct ExecutionFee {
        bytes32 id; // Unique identifier for this execution fee
        uint256 fee; // Fee amount in wei
    }

    /**
     * @notice Comprehensive fee breakdown structure
     * @param protocolFee Base protocol operational fee
     * @param executionFees Array of execution-specific fees with identifiers
     * @param platformFee DApp/platform usage fee
     * @param reserved1 Reserved field for future fee type 1
     * @param reserved2 Reserved field for future fee type 2
     * @param reserved3 Reserved field for future fee type 3
     * @param totalFee Sum of all above fees (must equal sum of individual fees)
     */
    struct FeeBreakdown {
        uint256 protocolFee; // Base protocol fee
        ExecutionFee[] executionFees; // Array of execution-specific fees
        uint256 platformFee; // DApp/platform fee
        uint256 reserved1; // Reserved for future fee type 1
        uint256 reserved2; // Reserved for future fee type 2
        uint256 reserved3; // Reserved for future fee type 3
        uint256 totalFee; // Total of all fees
    }

    // ============ Configuration Structures ============

    /**
     * @notice Comprehensive initialization configuration for deployment
     * @param owner Account owner address
     * @param delegate Address authorized to sign UserOperations
     * @param minExchangeRate Minimum USDC per ETH exchange rate
     * @param maxExchangeRate Maximum USDC per ETH exchange rate
     * @param minRequiredFee Minimum fee required per transaction
     * @param maxFeePerTransaction Maximum fee allowed per transaction
     * @param initialDestinations Array of addresses to whitelist during deployment
     * @param destinationStatuses Array of whitelist statuses for initialDestinations
     */
    struct AccountConfig {
        address owner;
        address delegate;
        uint256 minExchangeRate;
        uint256 maxExchangeRate;
        uint256 minRequiredFee;
        uint256 maxFeePerTransaction;
        address[] initialDestinations;
        bool[] destinationStatuses;
    }

    // ============ State Variables ============

    address public delegate;
    address public immutable FEE_RECIPIENT;
    uint256 public minRequiredFee;
    uint256 public maxFeePerTransaction;
    uint256 public hardFeeCap;
    uint256 public minExchangeRate;
    uint256 public maxExchangeRate;
    mapping(address => bool) public isWhitelistedDestination;

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
    event DestinationWhitelistUpdated(address indexed destination, bool whitelisted);

    // ============ Custom Errors ============

    error OnlyEntryPointAllowed();
    error FeeTooLow(uint256 provided, uint256 required);
    error FeeTooHigh(uint256 provided, uint256 maximum);
    error DestinationNotWhitelisted(address destination);
    error OnlyOwnerFunction();
    error OnlyDelegateFunction();
    error MinFeeExceedsMaxFee(uint256 minFee, uint256 maxFee);
    error MaxFeeExceedsHardCap(uint256 maxFee, uint256 hardCap);
    error MaxFeeBelowMinFee(uint256 maxFee, uint256 minFee);
    error HardCapTooLow(uint256 hardCap);
    error InvalidExchangeRate(uint256 rate);

    // ============ Constructor ============

    /**
     * @notice Initialize with EntryPoint and service-level fee recipient
     * @param _entryPoint EntryPoint contract address
     * @param _feeRecipient Address to receive ETH fees
     */
    constructor(IEntryPoint _entryPoint, address _feeRecipient) Simple7702AccountV07(_entryPoint) {
        require(_feeRecipient != address(0), "Fee recipient cannot be zero address");
        FEE_RECIPIENT = _feeRecipient;
    }

    // ============ Initialization ============

    /**
     * @notice Initialize account with delegate and user-specific fee settings
     * @param _owner Account owner address
     * @param _delegate Address authorized to sign UserOperations
     * @param _minExchangeRate Minimum USDC per ETH exchange rate
     * @param _maxExchangeRate Maximum USDC per ETH exchange rate
     * @param _minRequiredFee Minimum fee required per transaction
     * @param _maxFeePerTransaction Maximum fee allowed per transaction
     */
    function initialize(
        address _owner,
        address _delegate,
        uint256 _minExchangeRate,
        uint256 _maxExchangeRate,
        uint256 _minRequiredFee,
        uint256 _maxFeePerTransaction
    ) public virtual {
        require(_maxExchangeRate > _minExchangeRate, "Max rate must be greater than min rate");
        require(_maxFeePerTransaction <= 10 * 10 ** 6, "Max fee cannot exceed 10 USDC hard cap");
        require(_minRequiredFee <= _maxFeePerTransaction, "Min fee must be less than or equal to max fee");

        // Initialize the owner directly since Simple7702AccountV07.initialize is disabled
        owner = _owner;
        delegate = _delegate;
        minRequiredFee = _minRequiredFee;
        maxFeePerTransaction = _maxFeePerTransaction;
        minExchangeRate = _minExchangeRate;
        maxExchangeRate = _maxExchangeRate;
        hardFeeCap = 10 * 10 ** 6;
    }

    /**
     * @notice Enhanced initialization with comprehensive deployment-time configuration
     * @param config Complete account configuration including destinations whitelist
     * @dev This eliminates the need for post-deployment setup transactions
     */
    function initializeWithConfig(AccountConfig calldata config) public virtual {
        require(config.maxExchangeRate > config.minExchangeRate, "Max rate must be greater than min rate");
        require(config.maxFeePerTransaction <= 10 * 10 ** 6, "Max fee cannot exceed 10 USDC hard cap");
        require(config.minRequiredFee <= config.maxFeePerTransaction, "Min fee must be less than or equal to max fee");
        require(
            config.initialDestinations.length == config.destinationStatuses.length,
            "Destinations and statuses arrays must have equal length"
        );

        // Initialize owner (EIP-7702 doesn't use initializer pattern)
        owner = config.owner;

        // Set account configuration
        delegate = config.delegate;
        minRequiredFee = config.minRequiredFee;
        maxFeePerTransaction = config.maxFeePerTransaction;
        minExchangeRate = config.minExchangeRate;
        maxExchangeRate = config.maxExchangeRate;
        hardFeeCap = 10 * 10 ** 6;

        // Configure destination whitelist during deployment
        for (uint256 i = 0; i < config.initialDestinations.length; i++) {
            isWhitelistedDestination[config.initialDestinations[i]] = config.destinationStatuses[i];
            emit DestinationWhitelistUpdated(config.initialDestinations[i], config.destinationStatuses[i]);
        }
    }

    // ============ Execution Functions ============

    /**
     * @notice Execute single transaction with ETH fee collection
     * @param dest Destination address for the transaction
     * @param value ETH value to send with the transaction
     * @param func Function call data to execute
     * @param feeUsdcAmount Fee amount in USDC
     * @param usdcPerEth Exchange rate for USDC per ETH
     */
    function execute(address dest, uint256 value, bytes calldata func, uint256 feeUsdcAmount, uint256 usdcPerEth)
        external
    {
        if (msg.sender != address(entryPoint())) {
            revert OnlyEntryPointAllowed();
        }

        if (feeUsdcAmount < minRequiredFee) {
            revert FeeTooLow(feeUsdcAmount, minRequiredFee);
        }
        if (feeUsdcAmount > maxFeePerTransaction) {
            revert FeeTooHigh(feeUsdcAmount, maxFeePerTransaction);
        }

        if (usdcPerEth < minExchangeRate || usdcPerEth > maxExchangeRate) {
            revert InvalidExchangeRate(usdcPerEth);
        }

        uint256 effectiveFeeUsdc = feeUsdcAmount;
        if (effectiveFeeUsdc > hardFeeCap) {
            effectiveFeeUsdc = hardFeeCap;
        }

        uint256 ethFee = (effectiveFeeUsdc * 10 ** 18) / usdcPerEth;

        if (!isWhitelistedDestination[dest]) {
            revert DestinationNotWhitelisted(dest);
        }

        // Calculate detailed fee breakdown
        FeeBreakdown memory feeBreakdown = _calculateFeeBreakdown(func, ethFee);
        emit FeeCalculated(msg.sender, dest, feeBreakdown);

        // Check if master key is sponsoring execution fee
        bool feeSponsored = _checkExecutionFeeSponsorship(dest, func);

        if (feeSponsored) {
            // Master key sponsors execution fee - only check transaction value
            require(address(this).balance >= value, "Insufficient ETH balance for value");
            emit FeeSponsored(msg.sender, dest, feeBreakdown);
            emit FeeSponsoredByMasterKey(FEE_RECIPIENT, ethFee);
        } else {
            // Normal flow - user pays execution fee
            require(address(this).balance >= value + ethFee, "Insufficient ETH balance for value and fee");
            if (ethFee > 0 && FEE_RECIPIENT != address(0)) {
                (bool success,) = FEE_RECIPIENT.call{value: ethFee}("");
                require(success, "ETH fee transfer failed");
                emit FeeTransferred(FEE_RECIPIENT, ethFee);
            }
        }

        _call(dest, value, func);
    }

    /**
     * @notice Execute multiple transactions in batch with ETH fee collection
     * @param dest Array of destination addresses
     * @param func Array of function call data
     * @param feeUsdcAmount Fee amount in USDC for the entire batch
     * @param usdcPerEth Exchange rate for USDC per ETH
     */
    function executeBatch(address[] calldata dest, bytes[] calldata func, uint256 feeUsdcAmount, uint256 usdcPerEth)
        external
    {
        if (msg.sender != address(entryPoint())) {
            revert OnlyEntryPointAllowed();
        }

        require(dest.length == func.length, "wrong array lengths");

        if (feeUsdcAmount < minRequiredFee) {
            revert FeeTooLow(feeUsdcAmount, minRequiredFee);
        }
        if (feeUsdcAmount > maxFeePerTransaction) {
            revert FeeTooHigh(feeUsdcAmount, maxFeePerTransaction);
        }

        if (usdcPerEth < minExchangeRate || usdcPerEth > maxExchangeRate) {
            revert InvalidExchangeRate(usdcPerEth);
        }

        uint256 effectiveFeeUsdc = feeUsdcAmount;
        if (effectiveFeeUsdc > hardFeeCap) {
            effectiveFeeUsdc = hardFeeCap;
        }

        uint256 ethFee = (effectiveFeeUsdc * 10 ** 18) / usdcPerEth;

        for (uint256 i = 0; i < dest.length; i++) {
            if (!isWhitelistedDestination[dest[i]]) {
                revert DestinationNotWhitelisted(dest[i]);
            }
        }

        require(address(this).balance >= ethFee, "Insufficient ETH balance for fee");

        // Calculate detailed fee breakdown for batch operation
        // Use first destination and function for fee breakdown calculation
        if (func.length > 0) {
            FeeBreakdown memory feeBreakdown = _calculateFeeBreakdown(func[0], ethFee);
            emit FeeCalculated(msg.sender, dest[0], feeBreakdown);
        } else {
            // For empty batch, create generic fee breakdown
            FeeBreakdown memory feeBreakdown;
            feeBreakdown.protocolFee = (ethFee * 30) / 100;
            feeBreakdown.platformFee = (ethFee * 20) / 100;
            feeBreakdown.executionFees = new ExecutionFee[](1);
            feeBreakdown.executionFees[0] =
                ExecutionFee({id: keccak256("batch_generic_execution"), fee: (ethFee * 50) / 100});
            feeBreakdown.totalFee = ethFee;
            emit FeeCalculated(msg.sender, address(0), feeBreakdown);
        }

        if (ethFee > 0 && FEE_RECIPIENT != address(0)) {
            (bool success,) = FEE_RECIPIENT.call{value: ethFee}("");
            require(success, "ETH fee transfer failed");
            emit FeeTransferred(FEE_RECIPIENT, ethFee);
        }

        for (uint256 i = 0; i < dest.length; i++) {
            _call(dest[i], 0, func[i]);
        }
    }

    // ============ Exchange Rate Management ============

    /**
     * @notice Update minimum exchange rate
     * @param _minRate New minimum exchange rate
     */
    function updateMinExchangeRate(uint256 _minRate) external {
        if (msg.sender != owner) {
            revert OnlyOwnerFunction();
        }
        require(_minRate < maxExchangeRate, "Min rate must be less than max rate");
        minExchangeRate = _minRate;
    }

    /**
     * @notice Update maximum exchange rate
     * @param _maxRate New maximum exchange rate
     */
    function updateMaxExchangeRate(uint256 _maxRate) external {
        if (msg.sender != owner) {
            revert OnlyOwnerFunction();
        }
        require(_maxRate > minExchangeRate, "Max rate must be greater than min rate");
        maxExchangeRate = _maxRate;
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
     * @notice Update destination whitelist status
     * @param destination Address to update whitelist status for
     * @param whitelisted Whether the destination should be whitelisted
     */
    function updateDestinationWhitelist(address destination, bool whitelisted) external {
        if (msg.sender != address(this)) {
            revert OnlyDelegateFunction();
        }

        isWhitelistedDestination[destination] = whitelisted;

        emit DestinationWhitelistUpdated(destination, whitelisted);
    }

    /**
     * @notice Update multiple destination whitelist statuses in batch
     * @param destinations Array of addresses to update
     * @param whitelisted Array of whitelist statuses corresponding to destinations
     */
    function batchUpdateDestinationWhitelist(address[] calldata destinations, bool[] calldata whitelisted) external {
        if (msg.sender != delegate) {
            revert OnlyDelegateFunction();
        }
        require(destinations.length == whitelisted.length, "Array length mismatch");

        for (uint256 i = 0; i < destinations.length; i++) {
            isWhitelistedDestination[destinations[i]] = whitelisted[i];
            emit DestinationWhitelistUpdated(destinations[i], whitelisted[i]);
        }
    }

    // ============ Internal Functions ============

    /**
     * @notice Calculate detailed fee breakdown based on transaction type
     * @param func Encoded function call data
     * @param totalFeeWei Total fee amount in wei to distribute
     * @return breakdown Detailed breakdown of all fees
     */
    function _calculateFeeBreakdown(bytes calldata func, uint256 totalFeeWei)
        internal
        pure
        returns (FeeBreakdown memory breakdown)
    {
        // Base protocol fee (30% of total)
        breakdown.protocolFee = (totalFeeWei * 30) / 100;

        // Platform fee (20% of total)
        breakdown.platformFee = (totalFeeWei * 20) / 100;

        // Calculate execution-specific fees (50% of total)
        breakdown.executionFees = _getExecutionFees(func, (totalFeeWei * 50) / 100);

        // Reserved fields (0 for now, ready for future expansion)
        breakdown.reserved1 = 0;
        breakdown.reserved2 = 0;
        breakdown.reserved3 = 0;

        breakdown.totalFee = totalFeeWei;

        return breakdown;
    }

    /**
     * @notice Get execution-specific fees based on transaction type
     * @param func Encoded function call data
     * @param executionBudget Total budget for execution fees
     * @return execFees Array of execution-specific fees
     */
    function _getExecutionFees(bytes calldata func, uint256 executionBudget)
        internal
        pure
        returns (ExecutionFee[] memory execFees)
    {
        if (func.length < 4) {
            // Generic transaction - single execution fee
            execFees = new ExecutionFee[](1);
            execFees[0] = ExecutionFee({id: keccak256("generic_execution"), fee: executionBudget});
            return execFees;
        }

        bytes4 selector = bytes4(func[:4]);

        // RealEstateInvestment.submitPropertyAnalysis
        if (selector == 0x832d7e69) {
            execFees = new ExecutionFee[](2);
            execFees[0] = ExecutionFee({
                id: keccak256("property_analysis"),
                fee: (executionBudget * 70) / 100 // 70% for main analysis
            });
            execFees[1] = ExecutionFee({
                id: keccak256("signature_validation"),
                fee: (executionBudget * 30) / 100 // 30% for signature validation
            });
            return execFees;
        }

        // RealEstateInvestment.purchaseTokens
        if (selector == 0x6f84329f) {
            execFees = new ExecutionFee[](3);
            execFees[0] = ExecutionFee({
                id: keccak256("token_purchase"),
                fee: (executionBudget * 50) / 100 // 50% for token purchase
            });
            execFees[1] = ExecutionFee({
                id: keccak256("signature_validation"),
                fee: (executionBudget * 30) / 100 // 30% for signature validation
            });
            execFees[2] = ExecutionFee({
                id: keccak256("token_transfer"),
                fee: (executionBudget * 20) / 100 // 20% for token transfer
            });
            return execFees;
        }

        // Default: single execution fee for unknown functions
        execFees = new ExecutionFee[](1);
        execFees[0] = ExecutionFee({id: keccak256("unknown_execution"), fee: executionBudget});
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
     * @notice Get current fee parameters
     * @return minFee Minimum required fee
     * @return maxFee Maximum fee per transaction
     * @return hardCap Hard fee cap limit
     */
    function getFeeParameters() external view returns (uint256 minFee, uint256 maxFee, uint256 hardCap) {
        return (minRequiredFee, maxFeePerTransaction, hardFeeCap);
    }

    /**
     * @notice Check if destination address is whitelisted
     * @param destination Address to check
     * @return whitelisted Whether the destination is whitelisted
     */
    function isDestinationWhitelisted(address destination) external view returns (bool whitelisted) {
        return isWhitelistedDestination[destination];
    }
}
