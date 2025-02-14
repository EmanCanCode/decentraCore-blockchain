// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "./Escrow.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

// cryptographically secure escrow contract factory
contract EscrowFactory {
    address public owner;
    mapping(address => mapping(address => uint)) public nonce; // nonce[buyer][seller]
    mapping(bytes32 => address) public escrows; // escrows[k256(buyer, seller, nonce)] => escrow address

    constructor() {
        owner = msg.sender;
    }

    event EscrowCreated(
        address indexed escrow,
        bytes32 escrowId,
        address buyer,
        address seller,
        uint nonce
    );

    function createEscrow(
        address _nft_address,
        uint256 _nft_id,
        uint8 _nft_count,
        uint256 _purchase_price,
        uint256 _earnest_amount,
        address _seller,
        address _buyer,
        address _inspector,
        address _lender,
        address _appraiser,
        bytes memory _seller_sig,
        bytes memory _buyer_sig,
        bytes memory _lender_sig // if _lender == address(0), this should be empty
    ) public returns (address escrowAddress) {
        // Use local variable to get the nonce value to be used in the signed message
        uint currentNonce = nonce[_buyer][_lender] + 1;

        // Construct the message hash with all parameters and the current nonce
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                _nft_address,
                _nft_id,
                _nft_count,
                _purchase_price,
                _earnest_amount,
                _seller,
                _buyer,
                _inspector,
                _lender,
                _appraiser,
                currentNonce
            )
        );

        // Construct the Ethereum signed message hash (EIP-191)
        bytes32 signedMsg = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );

        // Verify seller signature
        (bytes32 r, bytes32 s, uint8 v) = _splitSignature(_seller_sig);
        require(
            ecrecover(signedMsg, v, r, s) == _seller,
            "Invalid seller signature"
        );

        // Verify buyer signature
        (r, s, v) = _splitSignature(_buyer_sig);
        require(
            ecrecover(signedMsg, v, r, s) == _buyer,
            "Invalid buyer signature"
        );

        // Verify lender signature (if applicable)
        if (_lender != address(0)) {
            (r, s, v) = _splitSignature(_lender_sig);
            require(
                ecrecover(signedMsg, v, r, s) == _lender,
                "Invalid lender signature"
            );
        } else {
            require(
                _lender_sig.length == 0,
                "Lender signature should be empty"
            );
        }

        // Update the nonce with the current value
        nonce[_buyer][_lender] = currentNonce;

        // Generate a unique escrow ID. Including NFT details helps differentiate escrows
        bytes32 escrowId = keccak256(
            abi.encodePacked(
                _buyer,
                _seller,
                _nft_address,
                _nft_id,
                currentNonce
            )
        );

        // Deploy the new Escrow contract
        Escrow escrow = new Escrow(
            _nft_address,
            _nft_id,
            _nft_count,
            _purchase_price,
            _earnest_amount,
            payable(_seller),
            payable(_buyer),
            _inspector,
            _lender,
            _appraiser
        );
        escrowAddress = address(escrow);
        escrows[escrowId] = escrowAddress;

        // Transfer the NFT from the seller to the newly deployed escrow contract
        IERC1155(_nft_address).safeTransferFrom(
            _seller,
            escrowAddress,
            _nft_id,
            _nft_count,
            ""
        );

        emit EscrowCreated(
            escrowAddress,
            escrowId,
            _buyer,
            _seller,
            currentNonce
        );
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
