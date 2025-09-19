// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@account-abstraction@v0.7.0/core/Helpers.sol";
import "@account-abstraction@v0.7.0/core/BaseAccount.sol";
import "@account-abstraction@v0.7.0/interfaces/IAccount.sol";
import "@account-abstraction@v0.7.0/interfaces/IEntryPoint.sol";
import "@account-abstraction@v0.7.0/interfaces/PackedUserOperation.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/**
 * @title Simple7702AccountV07
 * @notice EIP-7702 account compatible with EntryPoint v0.7.0
 * @dev A minimal account to be used with EIP-7702 (for batching) and ERC-4337 v0.7.0 (for gas sponsoring)
 */
contract Simple7702AccountV07 is BaseAccount, IERC165, IERC1271, ERC1155Holder, ERC721Holder, Initializable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    IEntryPoint private immutable _ENTRY_POINT;
    address public owner;

    event Simple7702AccountV07Initialized(IEntryPoint indexed entryPoint, address indexed owner);

    constructor(IEntryPoint anEntryPoint) {
        _ENTRY_POINT = anEntryPoint;
        _disableInitializers();
    }

    /**
     * @notice Initialize the account with owner
     * @param anOwner The owner of this account
     */
    function initialize(address anOwner) public virtual initializer {
        owner = anOwner;
        emit Simple7702AccountV07Initialized(_ENTRY_POINT, anOwner);
    }

    /**
     * @notice Returns the EntryPoint v0.7.0
     */
    function entryPoint() public view virtual override returns (IEntryPoint) {
        return _ENTRY_POINT;
    }

    /**
     * @notice Validate signature for ERC-4337 UserOperation
     */
    function _validateSignature(PackedUserOperation calldata userOp, bytes32 userOpHash)
        internal
        virtual
        override
        returns (uint256 validationData)
    {
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        if (owner != hash.recover(userOp.signature)) {
            return SIG_VALIDATION_FAILED;
        }
        return SIG_VALIDATION_SUCCESS;
    }

    /**
     * @notice EIP-1271 signature validation
     */
    function isValidSignature(bytes32 hash, bytes memory signature) public view returns (bytes4 magicValue) {
        return _isValidSignature(hash, signature) ? this.isValidSignature.selector : bytes4(0xffffffff);
    }

    function _isValidSignature(bytes32 hash, bytes memory signature) internal view returns (bool) {
        bytes32 ethSignedHash = hash.toEthSignedMessageHash();
        return owner == ethSignedHash.recover(signature);
    }

    /**
     * @notice Only allow execution from self or EntryPoint
     */
    function _requireFromEntryPointOrOwner() internal view {
        require(msg.sender == address(entryPoint()) || msg.sender == owner, "account: not Owner or EntryPoint");
    }

    /**
     * @notice Execute a transaction
     */
    function execute(address dest, uint256 value, bytes calldata func) external {
        _requireFromEntryPointOrOwner();
        _call(dest, value, func);
    }

    /**
     * @notice Execute a batch of transactions
     */
    function executeBatch(address[] calldata dest, bytes[] calldata func) external {
        _requireFromEntryPointOrOwner();
        require(dest.length == func.length, "wrong array lengths");
        for (uint256 i = 0; i < dest.length; i++) {
            _call(dest[i], 0, func[i]);
        }
    }

    /**
     * @notice Execute a batch of transactions with values
     */
    function executeBatch(address[] calldata dest, uint256[] calldata value, bytes[] calldata func) external {
        _requireFromEntryPointOrOwner();
        require(dest.length == func.length, "wrong array lengths");
        require(dest.length == value.length, "wrong array lengths");
        for (uint256 i = 0; i < dest.length; i++) {
            _call(dest[i], value[i], func[i]);
        }
    }

    /**
     * @notice Internal call function
     */
    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    /**
     * @notice Get the nonce from EntryPoint
     */
    function getNonce() public view virtual override returns (uint256) {
        return entryPoint().getNonce(address(this), 0);
    }

    /**
     * @notice Check if the account is initialized
     */
    function isInitialized() public view returns (bool) {
        return owner != address(0);
    }

    /**
     * @notice Support interfaces
     */
    function supportsInterface(bytes4 interfaceId) public pure override(ERC1155Holder, IERC165) returns (bool) {
        return interfaceId == type(IERC165).interfaceId || interfaceId == type(IAccount).interfaceId
            || interfaceId == type(IERC1271).interfaceId || interfaceId == type(IERC1155Receiver).interfaceId
            || interfaceId == type(IERC721Receiver).interfaceId;
    }

    /**
     * @notice Accept incoming calls (with or without value), to mimic an EOA
     */
    fallback() external payable {}

    receive() external payable {}
}
