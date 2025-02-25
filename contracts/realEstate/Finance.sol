// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";



interface IERC1155 {
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) external;
}

// if i wanted to get fancy, i would implement this but this is a demo for the escrow not for financing a house
contract Finance is IERC1155Receiver {
    address public owner;
    address public nftAddress;
    mapping(address => uint) public idInFinance; // idInFinance[user address] => id

    constructor(
        address _nftAddress // address of the NFT contract from escrow
    ) {
        owner = msg.sender;
        nftAddress = _nftAddress;
    }

    function payOff(
        address actor,
        uint id
    ) external {
        if (msg.sender != owner) {
            require(msg.sender == actor, "Only the actor can pay off the finance");
        }
        // the id returned must be the same as the id of the finance.
        require(idInFinance[actor] == id, "Actor does not have a finance with this id");
        // remove the id from the mapping
        delete idInFinance[actor];
        // send the nft to the actor
        IERC1155(nftAddress).safeTransferFrom(address(this), actor, id, 1, "");
    }

    function setIdInFinance(
        address actor,
        uint id
    ) external {
        require(msg.sender == owner, "Only the owner can set the id in finance");
        idInFinance[actor] = id;
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external override returns (bytes4) {
        // You can add any custom logic here if needed
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external override returns (bytes4) {
        // You can add any custom logic here if needed
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) external pure override returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId;
    }
}