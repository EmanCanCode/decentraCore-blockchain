// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "./Escrow.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

contract EscrowFactory {
    address public owner;
    mapping(address => mapping(address => address)) public nonce; // nonce[buyer][seller]
    constructor() {
        owner = msg.sender;
    }

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
        bytes memory _lender_sig // if lender == 0x0, then leave it empty (what is the best way to do this?)
    ) public returns (address) {
        // 1️⃣ verify params signed by all parties
        // create message that is signed by all parties
        bytes32 messageHash = keccak256(abi.encodePacked(
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
            nonce[_buyer][_lender]  // Prevents replay attacks
        ));

        // 2️⃣ create escrow
        // 3️⃣ transfer NFT to escrow
    }

    function withdraw() public {
        require(msg.sender == owner, "Only owner can withdraw");
        payable(owner).transfer(address(this).balance);
    }
}

