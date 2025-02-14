// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "./Escrow.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

contract EscrowFactory {
    address public owner;
    mapping(address => mapping(address => uint)) public nonce; // nonce[buyer][lender]
    mapping(bytes32 => address) public escrows; // escrows[escrowId] => escrow address
    mapping(bytes32 => bool) public verifiedEscrowIds; // escrowId => verified flag

    constructor() {
        owner = msg.sender;
    }

    event EscrowVerified(bytes32 escrowId, address buyer, address seller, uint nonce);
    event EscrowCreated(
        address indexed escrow,
        bytes32 escrowId,
        address buyer,
        address seller,
        uint nonce
    );

    // Group all escrow parameters into one struct
    struct EscrowParams {
        address nft_address;
        uint256 nft_id;
        uint8 nft_count;
        uint256 purchase_price;
        uint256 earnest_amount;
        address seller;
        address buyer;
        address inspector;
        address lender;
        address appraiser;
    }

    /// @notice Verifies escrow parameters and signatures, then marks escrowId as verified.
    function verifyEscrowData(
        EscrowParams memory params,
        bytes memory _seller_sig,
        bytes memory _buyer_sig,
        bytes memory _lender_sig // must be empty if params.lender == address(0)
    ) public returns (bytes32 escrowId) {
        // Get the nonce value that should be used (without updating state yet)
        uint currentNonce = nonce[params.buyer][params.lender] + 1;
        // Compute the message hash for signing using our struct and nonce
        bytes32 messageHash = _computeMessageHash(params, currentNonce);
        // Apply the Ethereum Signed Message prefix (EIP-191)
        bytes32 signedMsg = _computeSignedMessage(messageHash);
        // Verify signatures
        _verifySignatures(signedMsg, params, _seller_sig, _buyer_sig, _lender_sig);
        // Compute escrowId using key parameters (including nonce)
        escrowId = _computeEscrowId(params, currentNonce);
        verifiedEscrowIds[escrowId] = true;
        emit EscrowVerified(escrowId, params.buyer, params.seller, currentNonce);
    }

    /// @notice Creates the escrow contract from verified parameters.
    function createEscrowFromVerified(
        EscrowParams memory params,
        bytes32 escrowId
    ) public returns (address escrowAddress) {
        require(verifiedEscrowIds[escrowId], "Escrow parameters not verified");
        // Recompute current nonce to ensure consistency
        uint currentNonce = nonce[params.buyer][params.lender] + 1;
        bytes32 computedEscrowId = _computeEscrowId(params, currentNonce);
        require(escrowId == computedEscrowId, "Escrow ID mismatch");
        // Update nonce and clear the verification flag
        nonce[params.buyer][params.lender] = currentNonce;
        verifiedEscrowIds[escrowId] = false;

        // Deploy new Escrow contract
        Escrow escrow = new Escrow(
            params.nft_address,
            params.nft_id,
            params.nft_count,
            params.purchase_price,
            params.earnest_amount,
            payable(params.seller),
            payable(params.buyer),
            params.inspector,
            params.lender,
            params.appraiser
        );
        escrowAddress = address(escrow);
        escrows[escrowId] = escrowAddress;

        // Transfer NFT from the seller to the new escrow contract
        IERC1155(params.nft_address).safeTransferFrom(
            params.seller,
            escrowAddress,
            params.nft_id,
            params.nft_count,
            ""
        );

        emit EscrowCreated(escrowAddress, escrowId, params.buyer, params.seller, currentNonce);
    }

    // --- Helper functions ---

    function _computeMessageHash(
        EscrowParams memory params,
        uint currentNonce
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                params.nft_address,
                params.nft_id,
                params.nft_count,
                params.purchase_price,
                params.earnest_amount,
                params.seller,
                params.buyer,
                params.inspector,
                params.lender,
                params.appraiser,
                currentNonce
            )
        );
    }

    function _computeSignedMessage(bytes32 messageHash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
    }

    function _computeEscrowId(
        EscrowParams memory params,
        uint currentNonce
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                params.buyer,
                params.seller,
                params.nft_address,
                params.nft_id,
                currentNonce
            )
        );
    }

    function _verifySignatures(
        bytes32 signedMsg,
        EscrowParams memory params,
        bytes memory _seller_sig,
        bytes memory _buyer_sig,
        bytes memory _lender_sig
    ) internal pure {
        (bytes32 r, bytes32 s, uint8 v) = _splitSignature(_seller_sig);
        require(ecrecover(signedMsg, v, r, s) == params.seller, "Invalid seller signature");
        (r, s, v) = _splitSignature(_buyer_sig);
        require(ecrecover(signedMsg, v, r, s) == params.buyer, "Invalid buyer signature");
        if (params.lender != address(0)) {
            (r, s, v) = _splitSignature(_lender_sig);
            require(ecrecover(signedMsg, v, r, s) == params.lender, "Invalid lender signature");
        } else {
            require(_lender_sig.length == 0, "Lender signature should be empty");
        }
    }

    function withdraw() public {
        require(msg.sender == owner, "Only owner can withdraw");
        payable(owner).transfer(address(this).balance);
    }

    function _splitSignature(
        bytes memory sig
    ) private pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "invalid signature length");
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }
}
