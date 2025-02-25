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
        EscrowParams memory _params,
        bytes memory _seller_sig,
        bytes memory _buyer_sig,
        bytes memory _lender_sig // must be empty if _params.lender == address(0)
    ) public returns (bytes32 escrowId) {
        // Get the nonce value that should be used (without updating state yet)
        uint currentNonce = nonce[_params.buyer][_params.seller] + 1;
        // Compute escrowId using key parameters (including nonce)
        escrowId = _computeEscrowId(_params, currentNonce);
        // make sure escrowId is not already verified
        require(!verifiedEscrowIds[escrowId], "Escrow parameters already verified");
        // Compute the message hash for signing using our struct and nonce
        bytes32 messageHash = _computeMessageHash(_params, currentNonce);
        // Apply the Ethereum Signed Message prefix (EIP-191)
        bytes32 signedMsg = _computeSignedMessage(messageHash);
        // Verify signatures
        _verifySignatures(signedMsg, _params, _seller_sig, _buyer_sig, _lender_sig);
        verifiedEscrowIds[escrowId] = true;
        emit EscrowVerified(escrowId, _params.buyer, _params.seller, currentNonce);
    }

    // accept ether to this contract
    receive() external payable {}

    fallback() external payable {
        revert("Invalid function call");
    }

    /// @notice Creates the escrow contract from verified parameters.
    function createEscrowFromVerified(
        EscrowParams memory _params,
        bytes32 _escrowId
    ) public returns (address _escrowAddress) {
        require(verifiedEscrowIds[_escrowId], "Escrow parameters not verified");
        // Recompute current nonce to ensure consistency
        uint currentNonce = nonce[_params.buyer][_params.seller] + 1;
        bytes32 computedEscrowId = _computeEscrowId(_params, currentNonce);
        require(_escrowId == computedEscrowId, "Escrow ID mismatch");
        // Update nonce and clear the verification flag
        nonce[_params.buyer][_params.seller] = currentNonce;
        verifiedEscrowIds[_escrowId] = false;

        // Deploy new Escrow contract
        Escrow escrow = new Escrow(
            _params.nft_address,
            _params.nft_id,
            _params.nft_count,
            _params.purchase_price,
            _params.earnest_amount,
            payable(_params.seller),
            payable(_params.buyer),
            _params.inspector,
            _params.lender,
            _params.appraiser
        );
        _escrowAddress = address(escrow);
        escrows[_escrowId] = _escrowAddress;

        // Transfer NFT from the seller to the new escrow contract
        IERC1155(_params.nft_address).safeTransferFrom(
            _params.seller,
            _escrowAddress,
            _params.nft_id,
            _params.nft_count,
            ""
        );

        emit EscrowCreated(_escrowAddress, _escrowId, _params.buyer, _params.seller, currentNonce);
    }


    // --- Helper functions ---

    function _computeMessageHash(
        EscrowParams memory _params,
        uint _currentNonce
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                _params.nft_address,
                _params.nft_id,
                _params.nft_count,
                _params.purchase_price,
                _params.earnest_amount,
                _params.seller,
                _params.buyer,
                _params.inspector,
                _params.lender,
                _params.appraiser,
                _currentNonce
            )
        );
    }

    function _computeSignedMessage(bytes32 _messageHash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _messageHash));
    }

    function _computeEscrowId(
        EscrowParams memory _params,
        uint _currentNonce
    ) public pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                _params.buyer,
                _params.seller,
                _params.nft_address,
                _params.nft_id,
                _currentNonce
            )
        );
    }

    function _verifySignatures(
        bytes32 _signedMsg,
        EscrowParams memory params,
        bytes memory _seller_sig,
        bytes memory _buyer_sig,
        bytes memory _lender_sig
    ) internal pure {
        (bytes32 r, bytes32 s, uint8 v) = _splitSignature(_seller_sig);
        require(ecrecover(_signedMsg, v, r, s) == params.seller, "Invalid seller signature");
        (r, s, v) = _splitSignature(_buyer_sig);
        require(ecrecover(_signedMsg, v, r, s) == params.buyer, "Invalid buyer signature");
        if (params.lender != address(0)) {
            (r, s, v) = _splitSignature(_lender_sig);
            require(ecrecover(_signedMsg, v, r, s) == params.lender, "Invalid lender signature");
        } else {
            require(_lender_sig.length == 0, "Lender signature should be empty");
        }
    }

    function withdraw() public {
        require(msg.sender == owner, "Only owner can withdraw");
        payable(owner).transfer(address(this).balance);
    }

    function _splitSignature(
        bytes memory _sig
    ) private pure returns (bytes32 _r, bytes32 _s, uint8 _v) {
        require(_sig.length == 65, "invalid signature length");
        assembly {
            _r := mload(add(_sig, 32))
            _s := mload(add(_sig, 64))
            _v := byte(0, mload(add(_sig, 96)))
        }
    }
}
