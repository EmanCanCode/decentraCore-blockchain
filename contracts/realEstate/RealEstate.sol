// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";


contract RealEstate is ERC1155 {
    address public owner;
    // mapping from token ID to custom URI
    mapping(uint256 => string) private _tokenURIs;

    constructor() ERC1155("") {
        owner = msg.sender;
        _mint(msg.sender, 1, 1, "");
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can call this function");
        _;
    }

    // override the uri function to return a token-specific URI
    function uri(uint256 tokenId) public view override returns (string memory) {
        return _tokenURIs[tokenId];
    }

    // allows the owner to set a custom URI for a specific token id
    function setTokenURI(uint256 tokenId, string memory newuri) public onlyOwner {
        _tokenURIs[tokenId] = newuri;
    }

    function mint(
        address account,
        uint256 id,
        uint256 amount,
        string memory tokenURI,
        bytes memory data
    ) public onlyOwner {
        _mint(account, id, amount, data);
        setTokenURI(id, tokenURI);
    }

    function mintBatch(
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        string[] memory uris,
        bytes memory data
    ) public onlyOwner {
        require(ids.length == uris.length, "ids and uris length mismatch");
        _mintBatch(to, ids, amounts, data);
        for (uint i = 0; i < ids.length; i++) {
            setTokenURI(ids[i], uris[i]);
        }
    }
}
